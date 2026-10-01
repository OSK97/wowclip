"""
The finder call.

Deliberately thin. Everything that decides quality already happened -- in the
transcript, in the prompt, in the payload order. This sends it, gets JSON back,
and reports what it actually cost.

Three notes on the call:

  * The whole payload goes in as ONE user message. It is already a single
    ordered document; splitting it into system + user would break the Cognitive
    Priming ordering the whole architecture is built around.

  * reasoning.effort is "xhigh" -- this model's maximum. A 3-hour podcast at
    ~90K input costs about one rupee even with 40K thinking tokens. There is no
    version of this product where saving fifty paise is worth a worse clip.

  * The cost printed at the end is the REAL number OpenRouter charged, read
    from usage.cost in the response, not an estimate multiplied out from a
    price table that goes stale. The estimate is a fallback only.
"""

import json
import re
import time
import urllib.error
import urllib.request

from .config import (
    LLM_API_KEY_NAME,
    LLM_APP_NAME,
    LLM_APP_URL,
    LLM_MODEL,
    LLM_REASONING_EFFORT,
    LLM_TIMEOUT_S,
    LLM_URL,
    PRICE_IN_HIT,
    PRICE_IN_MISS,
    PRICE_OUT,
    USD_TO_INR,
    get_key,
)

IS_OPENROUTER = "openrouter.ai" in LLM_URL


def call(payload_text, model=None, effort=None, timeout=None):
    """Returns a result dict. Never raises for network or API errors."""
    model = model or LLM_MODEL
    effort = effort or LLM_REASONING_EFFORT
    api_key = get_key(LLM_API_KEY_NAME)

    body = {
        "model": model,
        "messages": [{"role": "user", "content": payload_text}],
    }
    if IS_OPENROUTER:
        # OpenRouter's unified reasoning parameter. Works across providers, so
        # swapping the model later does not mean rewriting this.
        body["reasoning"] = {"effort": effort, "enabled": True}
    else:
        body["reasoning_effort"] = effort

    headers = {"Authorization": f"Bearer {api_key}",
               "Content-Type": "application/json"}
    if IS_OPENROUTER:
        headers["HTTP-Referer"] = LLM_APP_URL
        headers["X-Title"] = LLM_APP_NAME

    req = urllib.request.Request(
        LLM_URL, data=json.dumps(body).encode("utf-8"), headers=headers)

    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout or LLM_TIMEOUT_S) as r:
            raw = r.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        detail = ""
        try:
            detail = e.read().decode("utf-8")[:600]
        except Exception:
            pass
        return _fail(f"HTTP {e.code}: {detail or e.reason}", t0, model)
    except Exception as e:
        return _fail(f"{type(e).__name__}: {e}", t0, model)

    elapsed = round(time.time() - t0, 1)

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        return _fail(f"API did not return JSON: {e}", t0, model, raw[:2000])

    if data.get("error"):
        return _fail(f"provider error: {json.dumps(data['error'])[:500]}",
                     t0, model)
    if not data.get("choices"):
        return _fail(f"unexpected API response: {json.dumps(data)[:600]}",
                     t0, model)

    msg = data["choices"][0].get("message") or {}
    content = msg.get("content") or ""
    # OpenRouter returns thinking as `reasoning`; DeepSeek direct calls it
    # `reasoning_content`. Take whichever is there.
    reasoning = msg.get("reasoning") or msg.get("reasoning_content") or ""
    if not reasoning:
        for d in msg.get("reasoning_details") or []:
            if isinstance(d, dict) and d.get("text"):
                reasoning += d["text"]

    verdict, note = extract_json(content)

    return {
        "ok": verdict is not None,
        "error": "" if verdict is not None else f"could not parse output: {note}",
        "verdict": verdict,
        "content": content,
        "reasoning": reasoning,
        "usage": cost(data.get("usage") or {}),
        "seconds": elapsed,
        "model": data.get("model") or model,
        "provider": data.get("provider") or ("openrouter" if IS_OPENROUTER else ""),
        "effort": effort,
        "finish_reason": data["choices"][0].get("finish_reason", ""),
    }


def _fail(error, t0, model, raw=""):
    return {"ok": False, "error": error, "verdict": None, "content": "",
            "reasoning": "", "usage": cost({}), "raw": raw,
            "seconds": round(time.time() - t0, 1), "model": model,
            "provider": "", "effort": "", "finish_reason": ""}


def extract_json(text):
    """Models wrap JSON in prose or fences about half the time. Dig it out
    rather than failing a paid run over punctuation."""
    if not text or not text.strip():
        return None, "empty response"

    candidates = []
    fenced = re.search(r"```(?:json)?\s*(.+?)```", text, re.DOTALL)
    if fenced:
        candidates.append(fenced.group(1))
    candidates.append(text)

    for cand in candidates:
        cand = cand.strip()
        try:
            return json.loads(cand), ""
        except json.JSONDecodeError:
            pass
        a, b = cand.find("{"), cand.rfind("}")
        if a != -1 and b > a:
            try:
                return json.loads(cand[a:b + 1]), ""
            except json.JSONDecodeError:
                continue
    return None, "no valid JSON object in the response"


def cost(usage):
    """
    Prefer the provider's own billed figure. OpenRouter always returns
    usage.cost now (real credits charged); an estimate from a hardcoded price
    table is only a fallback, and it is labelled as one so a report never
    quietly presents a guess as a fact.
    """
    prompt = usage.get("prompt_tokens", 0)
    out = usage.get("completion_tokens", 0)
    pd = usage.get("prompt_tokens_details") or {}
    cd = usage.get("completion_tokens_details") or {}

    cached = pd.get("cached_tokens", 0) or usage.get("prompt_cache_hit_tokens", 0)
    fresh = usage.get("prompt_cache_miss_tokens")
    if fresh is None:
        fresh = max(prompt - cached, 0)

    billed = usage.get("cost")
    if billed is not None:
        usd, source = float(billed), "billed"
    else:
        usd = (cached * PRICE_IN_HIT + fresh * PRICE_IN_MISS + out * PRICE_OUT)
        source = "estimated"

    return {
        "input_tokens": prompt,
        "input_cache_hit": cached,
        "input_cache_miss": fresh,
        "cache_write_tokens": pd.get("cache_write_tokens", 0),
        "output_tokens": out,
        "thinking_tokens": cd.get("reasoning_tokens", 0),
        "answer_tokens": max(out - cd.get("reasoning_tokens", 0), 0),
        "total_tokens": usage.get("total_tokens", prompt + out),
        "usd": round(usd, 6),
        "inr": round(usd * USD_TO_INR, 4),
        "upstream_usd": (usage.get("cost_details") or {}).get(
            "upstream_inference_cost"),
        "source": source,
    }
