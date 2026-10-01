# -*- coding: utf-8 -*-
"""OpenRouter client. Cheap fast model used ONLY as a filter, never as an editor.

The one rule: an LLM may decide WHICH data survives and may write a summary
clearly labelled as a summary. It may never rewrite a comment, a transcript
word, or a timestamp -- that is how "there is a gay" becomes "there is a way".
"""

import concurrent.futures
import json
import os
import re
import time
import urllib.error
import urllib.request
import datetime

URL = "https://openrouter.ai/api/v1/chat/completions"

# The filter model, used for comment triage, theme grouping and summaries.
#
# Was inception/mercury-2. Measured on one real run of 17 calls: mercury-2 cost
# 3.09 rupees and spent 32,533 of its 33,348 output tokens -- 98% -- on
# reasoning, to answer questions whose entire output is a list of integer ids.
# Nine calls across one day's billing hit the token ceiling with 100% reasoning
# and returned NOTHING AT ALL, at a cost of 5.48 rupees for zero output.
#
# mercury-2.5 is both cheaper ($0.04/$0.15 per 1M against $0.25/$0.75) and,
# per its own model card, a 10+ point jump in capability, so this is not a
# quality tradeoff. The reasoning is switched off separately -- see chat().
MODEL = "inception/mercury-2.5"
_CANDIDATE_KEYS = [
    os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "wowClip", "api_keys.json")),
    os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "api_keys.json")),
    os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "wowClip", "api_keys.json")),
    os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "api_keys.json")),
]
KEYS = next((k for k in _CANDIDATE_KEYS if os.path.exists(k)), _CANDIDATE_KEYS[0])

TIMEOUT_S = 120
RETRIES = 3
WORKERS = 8

# Price ceiling for the small comment-filter calls, in dollars per 1M tokens.
MAX_PRICE = {"prompt": 0.1, "completion": 0.2}


def provider_block(model=None):
    """Prefer the currently fastest eligible endpoint, with provider fallback.

    OpenRouter checks context/output capacity against the request. Do not pin
    GLM to a stale provider order or exclude faster endpoints by filter pricing.
    require_parameters prevents silently ignoring requested reasoning/JSON modes.
    """
    if model and ("glm" in model.lower() or "z-ai" in model.lower()):
        return {"sort": "throughput", "allow_fallbacks": True,
                "require_parameters": True}
    return {"sort": "throughput", "max_price": dict(MAX_PRICE),
            "allow_fallbacks": True}


def get_key(name="OPENROUTER_API_KEY", path=None):
    """The API key, from the environment first and the key file second.

    The environment comes first because it is the only source that exists
    everywhere: KEYS points outside the project (`../wowClip/api_keys.json`), so
    a container, a CI job or a checkout without that sibling directory could not
    run any of this from the command line at all. The website never hit it
    because it passes keys in explicitly.
    """
    import base64
    env = os.environ.get(name)
    if env and env.strip():
        val = env.strip()
        if val.startswith("b64:"):
            try:
                return base64.b64decode(val[4:]).decode("utf-8")
            except Exception:
                pass
        return val
    p = path or KEYS
    try:
        with open(p, encoding="utf-8") as f:
            key = json.load(f).get(name)
        if key and isinstance(key, str) and key.startswith("b64:"):
            try:
                key = base64.b64decode(key[4:]).decode("utf-8")
            except Exception:
                pass
    except (OSError, json.JSONDecodeError) as ex:
        raise RuntimeError(
            f"no {name}: it is not in the environment and {p} could not be read "
            f"({type(ex).__name__}). Set {name}= in the environment."
        ) from None
    if not key:
        raise RuntimeError(f"no {name}: not in the environment, and {p} has no "
                           f"such entry.")
    return key


class StreamError(RuntimeError):
    """A provider stream error with its status retained for retry decisions."""

    def __init__(self, message, code=None):
        super().__init__(message)
        self.code = int(code) if str(code).isdigit() else None


def post_stream(body, key, url=None, timeout=1200):
    """POST a chat completion as SSE and reassemble it.

    -> (content, reasoning, usage)

    Streaming is not a nicety for this pipeline. A finder emits 20-40k output
    tokens and a refine batch more, so a single answer can take several
    minutes, and a plain request spends all of it on a silent socket that
    anything in the path is entitled to drop. OpenRouter sends periodic
    `: OPENROUTER PROCESSING` comment lines during a stream purely to keep
    that connection alive, and a non-streaming caller never sees them.
    Measured on one real finder call, the same request took 129s unstreamed
    and 66s streamed.

    Both OpenRouter and DeepSeek's own API speak this same SSE dialect, so
    this is used for both."""
    b = dict(body)
    b["stream"] = True
    # Ask for the usage totals; OpenRouter puts them on the final chunk.
    b.setdefault("stream_options", {"include_usage": True})
    req = urllib.request.Request(
        url or URL, data=json.dumps(b).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}",
                 "Content-Type": "application/json",
                 "Accept": "text/event-stream"})

    out, think, usage = [], [], {}
    provider = generation_id = finish_reason = mid_error = None
    mid_error_code = None
    started = time.perf_counter()
    first_token = first_content = last_token = None
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            for raw in r:
                line = raw.decode("utf-8", errors="replace").strip()
                # ": OPENROUTER PROCESSING" and friends. Skipping every line that
                # is not a data line is the documented requirement -- feeding one
                # to json.loads is how a stream reader dies three minutes in.
                if not line or line.startswith(":") or not line.startswith("data:"):
                    continue
                chunk = line[5:].strip()
                if chunk == "[DONE]":
                    break
                try:
                    d = json.loads(chunk)
                except Exception:
                    continue
                if d.get("usage"):
                    usage = d["usage"]
                if d.get("provider"):
                    provider = d["provider"]
                if d.get("id"):
                    generation_id = d["id"]
                # An error arriving mid-stream matches none of the shapes below,
                # so it used to be skipped, the loop ended, and the caller saw
                # empty content -- which find_clips.call diagnoses as the model
                # having spent its budget on thinking, and answers by DOUBLING
                # the token budget. A provider fault was being treated as an
                # over-thinking fault and billed accordingly.
                if d.get("error"):
                    err = d["error"]
                    mid_error = (err.get("message") if isinstance(err, dict)
                                 else str(err)) or "provider sent an error"
                    mid_error_code = err.get("code") if isinstance(err, dict) else None
                    break
                choice = (d.get("choices") or [{}])[0] or {}
                finish_reason = choice.get("finish_reason") or finish_reason
                delta = choice.get("delta") or {}
                details = delta.get("reasoning_details") or []
                text_parts = [x.get("text", "") for x in details
                              if isinstance(x, dict) and x.get("type") == "reasoning.text"]
                if delta.get("content") or delta.get("reasoning") or delta.get("reasoning_content") or any(text_parts):
                    last_token = time.perf_counter() - started
                    if first_token is None:
                        first_token = last_token
                if delta.get("content"):
                    if first_content is None:
                        first_content = time.perf_counter() - started
                    out.append(delta["content"])
                # OpenRouter calls it `reasoning`, DeepSeek `reasoning_content`.
                # Some providers expose text only through reasoning_details.
                # Choose one representation per chunk, without losing a chunk
                # if the representation changes partway through the stream.
                reasoning_text = delta.get("reasoning") or delta.get("reasoning_content")
                if reasoning_text:
                    think.append(reasoning_text)
                else:
                    think.extend(t for t in text_parts if t)
    except Exception as ex:
        if isinstance(ex, urllib.error.HTTPError):
            # Keep the status code for retry decisions, and report the API's
            # short error message rather than an opaque "Forbidden".
            try:
                error = json.loads(ex.read(8192)).get("error") or {}
                message = error.get("message") if isinstance(error, dict) else None
                if message:
                    safe_message = re.sub(r"https?://\S+", "[OpenRouter dashboard]", str(message))
                    ex.msg = f"{ex.reason}: {safe_message[:300]}"
            except (ValueError, OSError, AttributeError):
                pass
        # Everything received so far was paid for and may be a complete answer
        # missing only its last chunk. Raising here discarded all of it, which
        # made a connection that died at 59k tokens indistinguishable from one
        # that never opened. Keep the text; only give up if there is none.
        if not out:
            raise
        mid_error = f"{type(ex).__name__}: {ex}"
    if provider:
        usage["provider"] = provider
    if generation_id:
        usage["generation_id"] = generation_id
    if finish_reason:
        usage["finish_reason"] = finish_reason
    usage["stream_metrics"] = {
        "elapsed_s": round(time.perf_counter() - started, 3),
        "first_token_s": round(first_token, 3) if first_token is not None else None,
        "first_content_s": round(first_content, 3) if first_content is not None else None,
        "last_token_s": round(last_token, 3) if last_token is not None else None,
    }
    usage.setdefault("reasoning_tokens",
                     (usage.get("completion_tokens_details")
                      or {}).get("reasoning_tokens", 0))
    if mid_error:
        usage["stream_error"] = str(mid_error)[:300]
        if not out:
            raise StreamError(f"stream failed: {str(mid_error)[:200]}", mid_error_code)
    return "".join(out), "".join(think), usage


def chat(messages, key, model=MODEL, temperature=0.0, max_tokens=4000,
         reasoning=False):
    """One filter answer. `reasoning=False` means do not think, just answer.

    Every caller of this function asks a question whose answer is a list of ids
    or a short label -- "which of these 60 comments are about the content",
    "group these into themes". None of it is a reasoning problem, and leaving
    reasoning on had three measured costs:

      it was 98% of the bill. 32,533 reasoning tokens against 815 tokens of
      actual answer, across 17 calls on one video.
      it silently destroyed answers. Nine calls in one day's billing hit the
      max_tokens ceiling with the whole budget inside the reasoning block and
      returned an empty content field -- which map_batches reads as "this batch
      had nothing worth keeping", so sixty comments were dropped by a billing
      artifact, not by a judgement.
      it was most of the latency. 87 seconds of model time for a filter.

    The ceiling is raised at the same time, because the two failures compound:
    a reply that has no reasoning block cannot overrun on reasoning, but a
    tight ceiling can still truncate a long list of ids."""
    body = {"model": model, "messages": messages, "temperature": temperature,
            "max_tokens": max_tokens}
    if not reasoning:
        # Both spellings: `reasoning` is OpenRouter's own field, and some
        # upstreams only honour the OpenAI-style `reasoning_effort`.
        body["reasoning"] = {"enabled": False, "effort": "none"}
        body["reasoning_effort"] = "none"
    last = None
    for a in range(1, RETRIES + 1):
        try:
            req = urllib.request.Request(
                URL, data=json.dumps(body).encode("utf-8"),
                headers={"Authorization": f"Bearer {key}",
                         "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=TIMEOUT_S) as r:
                d = json.loads(r.read().decode("utf-8", errors="replace"))
            txt = ((d.get("choices") or [{}])[0].get("message") or {}).get("content")
            if not txt:
                # A 200 with no content at all. Measured on mercury-2 through
                # OpenRouter, occasionally and without a stated reason. It used
                # to sail through as an empty answer, which every caller here
                # reads as "the model chose to keep nothing" -- so a hiccup
                # quietly deleted sixty comments or the whole theme block.
                # Retrying is the honest reading; failing loudly is the fallback.
                raise RuntimeError("empty completion")
            return txt, d.get("usage", {})
        except urllib.error.HTTPError as ex:
            last = ex
            # A provider that will not accept "do not think" must still be
            # usable. Strip the fields and try again rather than failing the
            # batch, which would silently cost real comments.
            if ex.code == 400 and "reasoning" in body:
                body.pop("reasoning", None)
                body.pop("reasoning_effort", None)
                continue
            if a < RETRIES:
                time.sleep(1.5 * a)
        except Exception as ex:
            last = ex
            if a < RETRIES:
                time.sleep(1.5 * a)
    raise RuntimeError(f"openrouter failed after {RETRIES}: {last}")


_FENCE = re.compile(r"```(?:json)?\s*(.*?)\s*```", re.S)


def _unfence(text):
    """The JSON inside a fenced answer, when there is one.

    Takes the LARGEST fenced block rather than the first. A reasoning model
    sometimes opens with a small illustrative fence ("```json\n{...}\n```" as a
    reminder of the shape it was asked for) and puts the real answer in a second
    one; taking the first discarded the entire answer and every salvage path
    below inherited the same mistake, because all three call this."""
    blocks = _FENCE.findall(text or "")
    if not blocks:
        return text
    return max(blocks, key=len)


def parse_json(text, default=None):
    """Small models wrap JSON in prose or fences often enough that a bare
    json.loads is not a real parser. Falls back to the outermost {...} or
    [...] before giving up, and returns `default` rather than raising --
    a filter that dies on one malformed batch is worse than one that keeps
    the batch."""
    if not text:
        return default
    text = _unfence(text)
    try:
        return json.loads(text)
    except Exception:
        pass
    # Objects first. Every caller in this pipeline asks for an object, and
    # trying brackets first meant a prose-wrapped object got sliced from its
    # first '[' (usually `"clips": [`) to its last ']' -- which sometimes
    # parses, returning a bare list and throwing away video_read, near_misses
    # and skipped, then filing the whole answer as "not JSON".
    for op, cl in (("{", "}"), ("[", "]")):
        i, j = text.find(op), text.rfind(cl)
        if i >= 0 and j > i:
            try:
                return json.loads(text[i:j + 1])
            except Exception:
                pass
    return default


def salvage_field(text, key):
    """Recover one top-level string field the array-salvage above cannot reach.

    salvage_list only rescues objects inside a named array. Everything else in
    a broken reply -- video_read, a single string -- was being silently lost,
    which is why a finder whose JSON broke reported an EMPTY video_read and an
    EMPTY skipped list even when the model had written both. That is not a
    fact about what the model read; it is a hole in what the parser can save.

    Regex, not a JSON parser, because the surrounding document is exactly the
    thing that failed to parse. Looks for "key": "value" and returns the value
    with its escapes undone, or None if the key is not found as a plain string.
    """
    if not text:
        return None
    text = _unfence(text)
    found = re.search(r'"%s"\s*:\s*"((?:[^"\\]|\\.)*)"' % re.escape(key), text)
    if not found:
        return None
    try:
        return json.loads('"' + found.group(1) + '"')
    except Exception:
        return found.group(1)


def salvage_list(text, key):
    """Recover the well-formed objects from a JSON array the model broke.

    A reasoning model emits one answer of 15k characters and a single stray
    character in it makes json.loads reject the whole thing. Measured: a
    finder returned nine good clips and wrote `"rank": 9",` on the tenth,
    and the entire call was discarded as 'response was not JSON'.

    This does not repair anything and never edits a value -- editing is how a
    parser starts inventing content. It walks the array, takes each balanced
    {...} block, and keeps the ones that parse on their own. A malformed
    object is dropped and the rest of the answer survives.
    """
    if not text:
        return []
    text = _unfence(text)
    i = text.find('"%s"' % key)
    if i < 0:
        return []
    i = text.find('[', i)
    if i < 0:
        return []
    out, depth, start, instr, esc = [], 0, None, False, False
    for j in range(i, len(text)):
        ch = text[j]
        if esc:
            esc = False
            continue
        if ch == '\\':
            esc = True
            continue
        if ch == '"':
            instr = not instr
            continue
        if instr:
            continue
        if ch == '{':
            if depth == 0:
                start = j
            depth += 1
        elif ch == '}':
            # Clamped at zero. One extra '}' -- or a badly escaped quote that
            # flips `instr` the wrong way -- used to drive depth negative, and
            # because `start` is only set while depth == 0, EVERY remaining
            # object in the array was then skipped in silence. The salvage
            # existed to stop one bad clip costing nine good ones; unclamped it
            # did exactly that for any stray brace.
            if depth > 0:
                depth -= 1
                if depth == 0 and start is not None:
                    try:
                        out.append(json.loads(text[start:j + 1]))
                    except Exception:
                        pass
                    start = None
        elif ch == ']' and depth == 0:
            break
    return out


def map_batches(items, batch_size, build, parse, key, model=MODEL,
                workers=WORKERS, log=None, max_tokens=4000, reasoning=False):
    """Run one LLM call per batch, in parallel, and merge the results.

    A batch that fails or returns garbage yields nothing instead of killing
    the run -- with 20 batches over 1000 comments, one bad response must not
    cost the other 950."""
    batches = [items[i:i + batch_size] for i in range(0, len(items), batch_size)]
    out, cost, failed = [], 0.0, 0

    def one(b):
        txt, usage = chat(build(b), key, model=model, max_tokens=max_tokens,
                          reasoning=reasoning)
        return parse(txt, b), usage

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        futs = [ex.submit(one, b) for b in batches]
        for f in concurrent.futures.as_completed(futs):
            try:
                res, usage = f.result()
                if res:
                    out.extend(res)
                cost += float(usage.get("cost") or 0)
            except Exception as e:
                failed += 1
                if log:
                    log(f"batch failed ({type(e).__name__}) -- skipped", "WARN")
    return out, {"batches": len(batches), "failed": failed, "cost_usd": round(cost, 5)}


def calculate_deepseek_cost(usage, model):
    if not model or "deepseek-v4-flash" not in model.lower():
        return
    now = datetime.datetime.utcnow()
    is_peak = False
    if now.weekday() < 5:
        h = now.hour
        if (1 <= h < 4) or (6 <= h < 10):
            is_peak = True
            
    cache_hit = usage.get("prompt_cache_hit_tokens", 0)
    cache_miss = usage.get("prompt_cache_miss_tokens", max(0, usage.get("prompt_tokens", 0) - cache_hit))
    out_tokens = usage.get("completion_tokens", 0)
    
    if is_peak:
        hit_price = 0.014 / 1e6
        miss_price = 0.44 / 1e6
        out_price = 1.32 / 1e6
    else:
        hit_price = 0.007 / 1e6
        miss_price = 0.22 / 1e6
        out_price = 0.66 / 1e6
        
    cost = (cache_hit * hit_price) + (cache_miss * miss_price) + (out_tokens * out_price)
    usage["cost"] = cost
    
    details = usage.get("completion_tokens_details", {})
    usage["reasoning_tokens"] = details.get("reasoning_tokens", 0)
