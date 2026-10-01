import argparse
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

_HERE = os.path.dirname(os.path.abspath(__file__))

# ══════════════════════════════════════════════════════════════════════════
#  CONFIG
# ══════════════════════════════════════════════════════════════════════════

# --- YouTube Data API ----------------------------------------------------
FETCH_TARGET = 1000          # how many comments to pull, at most
PAGE_SIZE = 100              # commentThreads.list max per page
FINAL_CAP = 400              # how many survive into the output file

# --- per-comment cleanup ---------------------------------------------------
COMMENT_CHAR_CAP = 220        # truncate any single comment past this, add "..."
MIN_WORDS = 3                 # anything shorter than this is noise, drop it

# --- LLM (OpenRouter) --------------------------------------------------
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "nvidia/nemotron-3.5-lightning"
# OpenRouter's listed price for nemotron-3.5-lightning (checked live):
# $0.08 / $0.20 per 1M tokens (in / out). Fallback only -- whenever
# OpenRouter's response includes a real "cost" field, that number wins.
MODEL_PRICE_IN = 0.08 / 1_000_000
MODEL_PRICE_OUT = 0.20 / 1_000_000
LLM_TEMPERATURE = 0.1
LLM_MAX_TOKENS = 4000          # output is just index numbers -- this is plenty
LLM_TIMEOUT_S = 120
# How many pre-filtered candidates we're willing to hand the LLM. Nemotron's
# context is 1M so this isn't a context limit -- it's an efficiency cap, so a
# viral video with thousands of clean comments doesn't balloon the prompt for
# no real benefit past this point.
LLM_CANDIDATE_CAP = 700

TIMESTAMP_RE = re.compile(r"\b\d{1,2}:\d{2}(:\d{2})?\b")
URL_RE = re.compile(r"https?://|www\.|\.com\b|\.ly\b|\.gg\b", re.IGNORECASE)
PROMO_RE = re.compile(
    r"\b(subscribe|check out my|my channel|follow me|dm me|whatsapp|"
    r"telegram|click here|link in bio|giveaway|promo code)\b", re.IGNORECASE)
EMOJI_ONLY_RE = re.compile(
    r"^[\s\U0001F300-\U0001FAFF☀-➿!?.,]+$")
STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "this", "that", "and",
    "or", "but", "to", "of", "in", "on", "at", "for", "with", "it", "he",
    "she", "they", "you", "i", "we", "his", "her", "their", "your", "my",
    "so", "if", "not", "just", "very", "really", "like", "video", "guy",
}


def get_key(name):
    keys_path = os.path.join(_HERE, "api_keys.json")
    try:
        with open(keys_path) as f:
            keys = json.load(f)
    except Exception:
        print(f"Failed to load api_keys.json")
        sys.exit(1)
    val = keys.get(name)
    if not val:
        print(f"{name} missing from api_keys.json")
        sys.exit(1)
    return val


def extract_video_id(video_id_or_url):
    if "youtu" not in video_id_or_url:
        return video_id_or_url
    parsed = urllib.parse.urlparse(video_id_or_url)
    if parsed.hostname in ("youtu.be",):
        return parsed.path.lstrip("/")
    qs = urllib.parse.parse_qs(parsed.query)
    if "v" in qs:
        return qs["v"][0]
    parts = [p for p in parsed.path.split("/") if p]
    return parts[-1] if parts else video_id_or_url


# ══════════════════════════════════════════════════════════════════════════
#  PHASE 1  --  FETCH  (YouTube Data API, order=relevance, paginated)
# ══════════════════════════════════════════════════════════════════════════

def fetch_comments(video_id, api_key):
    """Up to FETCH_TARGET comments, most-relevant first. Stops early if the
    video simply doesn't have that many -- never pads, never fakes a count."""
    out = []
    page_token = None
    quota_units = 0
    pages = 0

    while len(out) < FETCH_TARGET:
        params = {
            "part": "snippet",
            "videoId": video_id,
            "order": "relevance",
            "maxResults": PAGE_SIZE,
            "textFormat": "plainText",
            "key": api_key,
        }
        if page_token:
            params["pageToken"] = page_token

        url = f"https://www.googleapis.com/youtube/v3/commentThreads?{urllib.parse.urlencode(params)}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=12) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf-8", errors="replace")[:300]
            if e.code == 403 and "commentsDisabled" in body:
                break  # not an error -- this creator turned comments off
            print(f"[{video_id}] Data API error (HTTP {e.code}): {body}")
            break
        except Exception as e:
            print(f"[{video_id}] Network error fetching comments: {e}")
            break

        quota_units += 1
        pages += 1

        for item in data.get("items", []):
            sn = item.get("snippet", {}).get("topLevelComment", {}).get("snippet", {})
            text = (sn.get("textOriginal") or sn.get("textDisplay") or "").strip()
            if not text:
                continue
            out.append({
                "text": text,
                "like_count": sn.get("likeCount", 0),
                "published_at": sn.get("publishedAt", ""),
                "author": sn.get("authorDisplayName", ""),
            })

        page_token = data.get("nextPageToken")
        if not page_token:
            break  # video genuinely has fewer comments than FETCH_TARGET

    return out[:FETCH_TARGET], {"quota_units": quota_units, "pages": pages}


# ══════════════════════════════════════════════════════════════════════════
#  PHASE 2  --  CLEAN  (cheap, deterministic, no LLM cost)
# ══════════════════════════════════════════════════════════════════════════

def _normalize(text):
    return re.sub(r"\s+", " ", text.strip().lower())


def clean_comments(raw):
    """Strip spam/links/promo/emoji-only/too-short, dedupe near-identical
    text, truncate long ones. Every drop is counted so nothing disappears
    silently."""
    seen = set()
    kept = []
    dropped = {"spam_or_link": 0, "emoji_only": 0, "too_short": 0, "duplicate": 0}

    for c in raw:
        text = c["text"]
        norm = _normalize(text)

        if URL_RE.search(text) or PROMO_RE.search(text):
            dropped["spam_or_link"] += 1
            continue
        if EMOJI_ONLY_RE.match(text):
            dropped["emoji_only"] += 1
            continue
        if len(norm.split()) < MIN_WORDS:
            dropped["too_short"] += 1
            continue
        if norm in seen:
            dropped["duplicate"] += 1
            continue
        seen.add(norm)

        if len(text) > COMMENT_CHAR_CAP:
            text = text[:COMMENT_CHAR_CAP].rstrip() + "..."

        c2 = dict(c)
        c2["text"] = text
        kept.append(c2)

    return kept, dropped


# ══════════════════════════════════════════════════════════════════════════
#  PHASE 3  --  SIGNAL  (timestamp / content-reference / generic)
# ══════════════════════════════════════════════════════════════════════════

def load_transcript_words(video_id):
    """Pulls the word set from step_02's saved transcript, if it exists.
    Used only to detect comments that reference something specific said in
    the video, even without an explicit timestamp. Missing transcript just
    means content-reference detection is skipped -- never a hard failure."""
    path = os.path.join(_HERE, "transcripts", f"{video_id}.json")
    if not os.path.exists(path):
        return set()
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        words = set()
        for w in data.get("words", []):
            token = re.sub(r"[^\w]", "", w.get("text", "").lower())
            if len(token) >= 4 and token not in STOPWORDS:
                words.add(token)
        return words
    except Exception:
        return set()


def classify_signal(text, transcript_words):
    if TIMESTAMP_RE.search(text):
        return "TIMESTAMP"
    if transcript_words:
        tokens = [re.sub(r"[^\w]", "", w.lower()) for w in text.split()]
        overlap = sum(1 for t in tokens if len(t) >= 4 and t not in STOPWORDS
                     and t in transcript_words)
        if overlap >= 3:
            return "CONTENT_REF"
    return "GENERIC"


SIGNAL_RANK = {"TIMESTAMP": 0, "CONTENT_REF": 1, "GENERIC": 2}


def tag_and_rank(comments, transcript_words):
    for c in comments:
        c["signal"] = classify_signal(c["text"], transcript_words)
    comments.sort(key=lambda c: (SIGNAL_RANK[c["signal"]], -c["like_count"]))
    return comments


# ══════════════════════════════════════════════════════════════════════════
#  PHASE 4  --  LLM TRIAGE  (nemotron-3.5-lightning, numbers in -> numbers out)
# ══════════════════════════════════════════════════════════════════════════

TRIAGE_SYSTEM_PROMPT = """You triage YouTube comments for a clip-selection pipeline.
You will get a numbered list of comments, each tagged TIMESTAMP, CONTENT_REF,
or GENERIC, with its like count.

Pick the comments that would genuinely help someone find the best moments in
this video: comments pointing at a specific moment (TIMESTAMP), comments that
clearly reference something specific that was said or shown (CONTENT_REF),
and only the most telling GENERIC ones (strong agreement/disagreement,
memorable reactions) -- not generic praise like "nice video".

Output ONLY a raw JSON object, nothing else:
{"picks": [3, 17, 42, ...]}

"picks" is a list of the index numbers you selected, most useful first,
capped at the number requested. Do not repeat the comment text. Numbers only."""


def build_triage_payload(comments, limit):
    lines = []
    for i, c in enumerate(comments, start=1):
        lines.append(f"{i}. [{c['signal']}] (+{c['like_count']}) {c['text']}")
    header = f"Pick up to {limit} of the following {len(comments)} comments.\n\n"
    return header + "\n".join(lines)


def extract_json(text):
    if not text:
        return None
    t = text.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t)
    t = re.sub(r"\s*```$", "", t).strip()
    try:
        v = json.loads(t)
        return v if isinstance(v, dict) else None
    except Exception:
        pass
    start, end = t.find("{"), t.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        v = json.loads(t[start:end + 1])
        return v if isinstance(v, dict) else None
    except Exception:
        return None


def call_llm_triage(comments, limit):
    key = get_key("OPENROUTER_API_KEY")
    payload = build_triage_payload(comments, limit)

    body = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": TRIAGE_SYSTEM_PROMPT},
            {"role": "user", "content": payload},
        ],
        "temperature": LLM_TEMPERATURE,
        "max_tokens": LLM_MAX_TOKENS,
        "response_format": {"type": "json_object"},
        "usage": {"include": True},
    }
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/wowclip",
        "X-Title": "wowClip Comment Triage",
    }

    t0 = time.time()
    try:
        req = urllib.request.Request(
            OPENROUTER_URL, data=json.dumps(body).encode("utf-8"),
            headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=LLM_TIMEOUT_S) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}",
                "picks": None, "usage": {}, "seconds": round(time.time() - t0, 2)}

    if isinstance(data.get("error"), dict):
        return {"ok": False, "error": data["error"].get("message", ""),
                "picks": None, "usage": {}, "seconds": round(time.time() - t0, 2)}

    choices = data.get("choices") or []
    if not choices:
        return {"ok": False, "error": "no choices in response", "picks": None,
                "usage": {}, "seconds": round(time.time() - t0, 2)}

    content = (choices[0].get("message") or {}).get("content") or ""
    parsed = extract_json(content)
    usage = data.get("usage") or {}
    seconds = round(time.time() - t0, 2)

    if not parsed or not isinstance(parsed.get("picks"), list):
        return {"ok": False, "error": f"non-JSON or malformed reply: {content[:150]!r}",
                "picks": None, "usage": usage, "seconds": seconds}

    picks = [p for p in parsed["picks"] if isinstance(p, int)]
    return {"ok": True, "error": "", "picks": picks, "usage": usage, "seconds": seconds}


# ══════════════════════════════════════════════════════════════════════════
#  PHASE 5  --  OUTPUT
# ══════════════════════════════════════════════════════════════════════════

def write_output(video_id, final_comments, stats, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"{video_id}.txt")
    with open(path, "w", encoding="utf-8") as f:
        f.write(f"=== COMMENTS -- {video_id} ===\n")
        f.write(f"fetched: {stats['fetched']}   after cleanup: {stats['cleaned']}   "
                f"final: {len(final_comments)}\n")
        f.write(f"selection: {stats['selection_method']}\n\n")
        for c in final_comments:
            f.write(f"[{c['signal']}] (+{c['like_count']})\n")
            f.write(f'"{c["text"]}"\n\n')
    return path


# ══════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════

def run(link, no_llm=False):
    total_start = time.time()
    video_id = extract_video_id(link)
    yt_key = get_key("YOUTUBE_API_KEY")

    print("Fetching comments...")
    t0 = time.time()
    raw, fetch_stats = fetch_comments(video_id, yt_key)
    fetch_time = round(time.time() - t0, 2)
    print(f"  {len(raw)} comments in {fetch_stats['pages']} page(s), "
          f"{fetch_stats['quota_units']} quota units, {fetch_time}s")

    if not raw:
        print("-" * 50)
        print("RESULT       : NO COMMENTS (disabled, none, or fetch failed)")
        print(f"Total time   : {round(time.time() - total_start, 2)}s")
        print("-" * 50)
        return 1

    cleaned, dropped = clean_comments(raw)
    print(f"  cleanup: {len(cleaned)} kept -- dropped "
          f"{dropped['spam_or_link']} spam/link, {dropped['emoji_only']} emoji-only, "
          f"{dropped['too_short']} too short, {dropped['duplicate']} duplicate")

    transcript_words = load_transcript_words(video_id)
    if not transcript_words:
        print("  [no transcript found -- CONTENT_REF detection skipped, "
              "TIMESTAMP/GENERIC only]")
    ranked = tag_and_rank(cleaned, transcript_words)

    counts = {}
    for c in ranked:
        counts[c["signal"]] = counts.get(c["signal"], 0) + 1
    print(f"  signals: {counts.get('TIMESTAMP', 0)} timestamp, "
          f"{counts.get('CONTENT_REF', 0)} content-ref, "
          f"{counts.get('GENERIC', 0)} generic")

    stats = {"fetched": len(raw), "cleaned": len(cleaned)}

    if len(ranked) <= FINAL_CAP:
        final = ranked
        stats["selection_method"] = "kept everything -- under the cap already"
        llm_usage, llm_time = {}, 0.0
    elif no_llm:
        final = ranked[:FINAL_CAP]
        stats["selection_method"] = "deterministic rank cutoff (--no-llm)"
        llm_usage, llm_time = {}, 0.0
    else:
        candidates = ranked[:LLM_CANDIDATE_CAP]
        print(f"  sending {len(candidates)} candidates to {MODEL} for triage...")
        result = call_llm_triage(candidates, FINAL_CAP)
        llm_time = result["seconds"]
        if result["ok"] and result["picks"]:
            idx = [i - 1 for i in result["picks"] if 1 <= i <= len(candidates)]
            seen_idx = []
            for i in idx:
                if i not in seen_idx:
                    seen_idx.append(i)
            final = [candidates[i] for i in seen_idx[:FINAL_CAP]]
            stats["selection_method"] = f"{MODEL} triage ({len(final)} picked)"
            llm_usage = result["usage"]
        else:
            print(f"  [LLM triage failed: {result['error']} -- "
                  f"falling back to deterministic rank cutoff]")
            final = ranked[:FINAL_CAP]
            stats["selection_method"] = "deterministic rank cutoff (LLM failed)"
            llm_usage = {}

    out_dir = os.path.join(_HERE, "comments")
    out_path = write_output(video_id, final, stats, out_dir)

    total_time = round(time.time() - total_start, 2)
    print("-" * 50)
    print("RESULT       : COMMENTS SAVED")
    print(f"Video ID     : {video_id}")
    print(f"Final count  : {len(final)}")
    print(f"Method       : {stats['selection_method']}")
    if llm_usage:
        pt, ct = llm_usage.get("prompt_tokens"), llm_usage.get("completion_tokens")
        cost = llm_usage.get("cost")
        exact = cost is not None
        if cost is None and pt is not None:
            cost = pt * MODEL_PRICE_IN + (ct or 0) * MODEL_PRICE_OUT
        if cost is not None:
            label = "actual billed" if exact else "estimated, list price"
            print(f"LLM cost     : ${cost:.6f} ({label}) -- in {pt} / out {ct}  "
                  f"[{llm_time}s]")
    print(f"Total time   : {total_time}s")
    print(f"Saved to     : {out_path}")
    print("-" * 50)
    return 0


def main(argv=None):
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser()
    parser.add_argument("input", help="YouTube link or video ID")
    parser.add_argument("--no-llm", action="store_true",
                        help="Skip the LLM triage pass, use rank cutoff only")
    args = parser.parse_args(argv)
    return run(args.input, no_llm=args.no_llm)


if __name__ == "__main__":
    sys.exit(main())
