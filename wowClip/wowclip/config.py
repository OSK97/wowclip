"""
Every tunable number in the pipeline, in one place, with the reasoning attached.

Rule of thumb used throughout: when a threshold protects the LLM from noise,
be strict. A false `((crying))` tag on a motivational line is worse than a
missed one, because the LLM will build a story around it.
"""

import json
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
PKG_ROOT = os.path.dirname(_HERE)          # .../wowClip
CACHE_ROOT = os.path.join(PKG_ROOT, "cache")
PROMPT_DIR = os.path.join(PKG_ROOT, "prompts")
KEYS_PATH = os.path.join(PKG_ROOT, "api_keys.json")


# ══════════════════════════════════════════════════════════════════════════
#  KEYS
# ══════════════════════════════════════════════════════════════════════════

_keys_cache = None


def get_key(name, required=True):
    """Read a key from api_keys.json, falling back to the environment."""
    global _keys_cache
    if _keys_cache is None:
        try:
            with open(KEYS_PATH, encoding="utf-8") as f:
                _keys_cache = json.load(f)
        except Exception:
            _keys_cache = {}
    val = _keys_cache.get(name) or os.environ.get(name)
    if not val and required:
        raise RuntimeError(
            f"{name} not found in {KEYS_PATH} or the environment.")
    return val


def proxy_url():
    user = get_key("GPROXY_USER")
    pw = get_key("GPROXY_PASS")
    host = get_key("GPROXY_HOST", required=False) or "proxy.gproxy.net"
    port = get_key("GPROXY_PORT", required=False) or "1000"
    return f"http://{user}:{pw}@{host}:{port}"


# ══════════════════════════════════════════════════════════════════════════
#  TRANSCRIPT LINES
# ══════════════════════════════════════════════════════════════════════════

# There is nothing to tune here any more, and that is the point.
#
# The lines are YouTube's own ASR chunks, verbatim. No sentence rebuilding, no
# merging, no splitting -- except where a measured silence falls inside a chunk,
# which splits it so the tag can sit in the right place. Every knob that used to
# live here was a knob that invented a boundary the source did not have, and
# every clip start and end inherited those invented boundaries.

# A word's end is the next word's start, capped -- a big gap is silence, not a
# long word. The cap is what makes silences findable: an uncapped word would
# swallow the pause after it and the tag would land inside the word.
MAX_WORD_DURATION = 1.2
FALLBACK_WORD_DURATION = 0.35


# ══════════════════════════════════════════════════════════════════════════
#  PAUSES  --  detected from timestamp gaps (no audio needed)
# ══════════════════════════════════════════════════════════════════════════

PAUSE_MIN_S = 1.5       # below this it is a breath, not a beat
PAUSE_GAP_S = 8.0       # above this it is an edit or section break, not drama


# ══════════════════════════════════════════════════════════════════════════
#  COMMENTS / HEATMAP
# ══════════════════════════════════════════════════════════════════════════

COMMENTS_MAX = 350
COMMENT_MAX_CHARS = 400      # one 4000-word summary comment is not 10x the signal
HEATMAP_MIN_SCORE = 0.50     # below this viewers were skipping, not replaying


# ══════════════════════════════════════════════════════════════════════════
#  FINDER LLM
# ══════════════════════════════════════════════════════════════════════════

# Routed through OpenRouter, not DeepSeek's own API, and that is a deliberate
# cost decision rather than a preference:
#
#   deepseek-v4-flash, 90K in / 40K out, one run
#     OpenRouter                        Rs 1.02
#     DeepSeek direct, old flat price   Rs 2.09
#     DeepSeek direct, new off-peak     Rs 4.07
#     DeepSeek direct, new PEAK         Rs 8.13
#
# From 16 Aug 2026 DeepSeek charges peak rates 01:00-04:00 and 06:00-10:00 UTC
# (06:30-09:30 and 11:30-15:30 IST). Eighteen third-party providers serve the
# same open weights through OpenRouter and none of them followed that rise.
#
# The 0731 build specifically: it is the one Artificial Analysis benchmarked at
# Intelligence Index 52 at max reasoning effort, and it is also the cheapest of
# the three published builds.
LLM_URL = "https://openrouter.ai/api/v1/chat/completions"
LLM_MODEL = "deepseek/deepseek-v4-flash-0731"
LLM_API_KEY_NAME = "OPENROUTER_API_KEY"

# OpenRouter effort ladder: none | minimal | low | medium | high | xhigh | max.
# xhigh maps to this model's maximum reasoning capacity.
LLM_REASONING_EFFORT = "xhigh"
LLM_TIMEOUT_S = 1800

# Fallback prices, used ONLY if the API does not report an actual cost.
# OpenRouter now always returns usage.cost (real credits charged), so these
# should almost never be reached -- they exist so a run still reports something
# sane if you point LLM_URL at a provider that does not.
PRICE_IN_MISS = 0.06846 / 1_000_000
PRICE_IN_HIT = 0.06846 / 1_000_000
PRICE_OUT = 0.1369 / 1_000_000
USD_TO_INR = 88.0

# Optional site attribution -- OpenRouter shows these on your activity page.
LLM_APP_NAME = "wowClip"
LLM_APP_URL = "https://github.com/"

# Clip boundary resolution, done in code after the model answers.
CLIP_LEAD_IN_S = 0.25        # start a hair before the first word
CLIP_TAIL_S = 0.45           # let the last word finish before cutting
CLIP_MAX_S = 180.0           # Instagram Reels hard cap
CLIP_MIN_S = 6.0
