"""Shared configuration for the ingestion pipeline.

Keys come from the environment. The Next.js route handler that spawns this
pipeline passes them down from .env.local, so there is no second copy of the
secrets sitting in this folder.
"""

import os

YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")

GPROXY_USER = os.environ.get("GPROXY_USER", "")
GPROXY_PASS = os.environ.get("GPROXY_PASS", "")
GPROXY_HOST = os.environ.get("GPROXY_HOST", "")
GPROXY_PORT = os.environ.get("GPROXY_PORT", "")

GPROXY_URL = (
    f"http://{GPROXY_USER}:{GPROXY_PASS}@{GPROXY_HOST}:{GPROXY_PORT}"
    if all([GPROXY_USER, GPROXY_PASS, GPROXY_HOST, GPROXY_PORT])
    else ""
)

# -- Currency --
INR_PER_USD = 96.0

# -- LLM (Omni Bouncer verdict) --
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL = "inception/mercury-2.5"

# Used when the primary is rate-limited upstream. Mercury is cheap enough that
# everyone is pointed at it, so 429 from the provider is routine rather than a
# sign of anything wrong with our own usage. Tried in order.
FALLBACK_MODELS = ["poolside/laguna-xs-2.1"]

# Listed rate per 1M tokens. Used only as a fallback estimate: OpenRouter
# reports the real charge in usage.cost and we prefer that number.
INPUT_PRICE_PER_1M = 0.04
OUTPUT_PRICE_PER_1M = 0.15

# -- GProxy (residential proxy, billed by bandwidth) --
# Only small requests go through it: the subtitle JSON and the watch-page
# fetch yt-dlp needs to find that JSON. Never audio or video.
GPROXY_USD_PER_GB = 0.9

# -- Comments --
# commentThreads.list returns up to 100 threads per call and costs 1 quota unit
# against a 10,000/day budget. Three pages = 300 comments for 3 units, which is
# 0.03% of the daily allowance. Effectively free.
COMMENT_PAGES = 3
COMMENTS_PER_PAGE = 100

# Stop paging after this many seconds and use what arrived. Comments are a
# supporting signal; three slow pages at the 45s socket timeout could otherwise
# hold the whole verdict hostage for over two minutes.
COMMENT_TIME_BUDGET = 20

# Cap handed to the LLM. Past a couple hundred the signal flattens and the long
# tail of zero-like comments is noise that costs input tokens.
MAX_COMMENTS_FOR_LLM = 200

# Heatmap points below this are sections viewers skipped — no useful signal.
HEATMAP_MIN_SCORE = 0.50

# -- Transcript formatting for the prompt --
# json3 already carries per-word timings, so the transcript can be regrouped at
# any granularity for free. Fixed-size chunks beat YouTube's irregular caption
# events because every timestamp then covers a comparable span of speech, which
# is what makes them comparable against heatmap peaks and timestamped comments.
# Set to 0 to keep YouTube's own grouping.
TRANSCRIPT_WORDS_PER_LINE = 6

NETWORK_TIMEOUT = 45
LLM_TIMEOUT = 180
