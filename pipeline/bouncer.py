"""Omni Bouncer — the gatekeeper verdict.

Design decision: there is no rule engine here. The only mechanical rejection
left is "this video has no captions at all", which is a fact, not a judgement —
with no transcript there is literally nothing to analyse.

Everything else goes to the model, because every threshold we tried had a
counterexample:

  - YouTube's categoryId said Gaming for a Samsung gaming-phone launch event,
    which is a stage presentation with a visible speaker and dense speech:
    perfectly usable. Category is the uploader's tag, not evidence about the
    content, so it is no longer consulted at all.
  - "Coverage below 50% = reject" kills prank videos and sketch comedy, where
    long silent setups surround the exact lines that go viral.
  - "Under N lines = reject" kills short speeches that are wall-to-wall
    quotable.

So the pipeline measures (analytics.py) and the model judges. The prompt below
gets the real transcript, the real numbers, and explicit instructions for the
ambiguous cases.
"""

import json
import re
import time
import urllib.error
import urllib.request

import events
from config import (
    FALLBACK_MODELS,
    INPUT_PRICE_PER_1M,
    INR_PER_USD,
    LLM_MAX_TOKENS,
    LLM_TIMEOUT,
    MODEL,
    OPENROUTER_API_KEY,
    OPENROUTER_URL,
    OUTPUT_PRICE_PER_1M,
)

SYSTEM_PROMPT = """You are OMNI-BOUNCER, the gatekeeper for an automated podcast-to-reel pipeline.

A video you approve goes through this machine:
1. TalkNet Active Speaker Detection crops 16:9 widescreen into 9:16 vertical by tracking a visible, moving human mouth.
2. A clip-finder LLM reads the transcript and extracts complete spoken moments, from a short one-liner to a longer story.
3. Those clips get captions and overlays, then render as reels.

You answer ONE question: is this video's available material technically usable by the clip-finding pipeline?

That question decomposes into two hard requirements:
- FACE: is there a visible human talking on camera for ASD to track and crop around?
- SPEECH: does the available transcript contain recoverable spoken content that the finders can examine? There is no minimum clip duration or requirement to demonstrate a viral moment at this gate.

Both must hold. Everything else is commentary.

## HOW TO DECIDE: EVIDENCE, NOT LABELS

Judge from the actual transcript text and the measurements given to you. Do NOT decide from the title, the channel name, or any category tag. Titles lie and categories are uploader-chosen. A video tagged "Gaming" may be a phone launch keynote with a speaker on stage. A video titled like a music video may be an interview. Read what is actually being said.

Ask yourself as you read the transcript: does this read like a human talking to other humans, or to a camera? Or does it read like lyrics, narration over footage, or nothing at all?

## WHAT DECIDES FACE FEASIBILITY

There is no video frame available to you, so infer from speech patterns and context:

These are clues, not visual verification. Never claim that you saw a face or a moving mouth. A conversational transcript suggests an interview but cannot prove anyone is on camera. Explain that face feasibility is inferred. Ordinary uncertainty is not a reason to block the video.

Strong signals FOR a trackable face:
- Conversational turn-taking, interruptions, "you know", direct address
- Someone reacting to another person in the room
- Audience laughter, applause, crowd response, heckling
- Interview question-and-answer rhythm
- A host addressing viewers directly

Strong signals AGAINST:
- Pure narration over footage with no interlocutor and no audience
- Sung lyrics with verse/chorus structure
- Commentary describing on-screen action moment to moment ("he's going for it, and there it is") which indicates the camera is on the action, not the speaker
- Step-by-step instruction with no conversational rhythm, typical of screen recordings

## WHAT DECIDES SPEECH USABILITY

The question is NOT "is most of the video interesting?" It is "is there recoverable spoken material for the finders to read?" Overall dullness says nothing about whether one excellent moment is hidden inside it.

One 45-second stretch of gold in a 30-minute video is a PASS. The pipeline only needs to find clips; it does not need the whole video to be usable.

Use the "Continuous speech" measurement as a pointer, not a gate. A long stretch with no silence in it tells you where to look first; it does not tell you whether a clip is there, and a short figure does not tell you one is absent. Read the transcript at those stretches and judge the words. A conversation that breaks every ten seconds because two people are trading short lines is a dialogue, not an absence of speech — and short exchanges are where comebacks and one-liners live. Decide from the words.

## EDGE CASES — READ THIS CAREFULLY

These are the situations that matter most. Get them right.

**Roughly half the video has speech.** PASS, assuming the spoken half contains real conversation. Pranks, sketch comedy, reality TV, vlogs and social experiments all have long silent stretches for setup, reactions, B-roll and transitions. The silence is production, not absence of content. Judge the spoken parts on their own merit.

**Little speech overall, but what exists is strong.** PASS. This is the most important case to get right. A short speech, a single devastating answer, or one viral exchange inside an otherwise quiet video is exactly what this pipeline exists to find. Low coverage with a high-quality burst beats high coverage of rambling filler.

**Lots of speech, but much of it seems dull or repetitive.** PASS when the speech is technically usable. Give a lower clip-potential score if appropriate, but do not turn a quality judgement into a rejection. A dull conversation can contain one excellent sentence; the full finders, not this gate, decide which passages deserve clips. Even if you cannot identify a strong moment in the material you reviewed, report that uncertainty rather than declaring the whole video empty.

**Manually uploaded captions that stop early or skip sections.** You will be told whether captions are auto-generated or human-uploaded, and what fraction of the runtime they cover. Human-uploaded captions are often partial: someone captions the first few minutes, or only the segments they cared about, then stops. Think carefully here:
- If the covered portion itself contains a solid clip-worthy stretch, PASS. We only need what we can see, and the pipeline can work inside the captioned region.
- If the covered portion is a thin sliver of a long video but contains readable speech, PASS with lower confidence and say only that portion can be examined. FAIL for missing or unrecoverable speech, not because the readable portion seems uninteresting. Do not invent content in an uncaptioned gap.
- Say explicitly in your reason that the captions are partial, so the user understands the limitation rather than thinking the video was bad.

**High repeated-line ratio.** Repetition can be song lyrics, caption stutter, rhetorical emphasis, or a recited poem. Check the words and context; repetition or rhyme alone does not establish singing. Reject lyrics-only content only when no usable spoken passage exists. Spoken poetry, shayari, and an interview with some music remain eligible.

**Transcript full of errors and nonsense words.** Expected, NOT a reason to fail. This transcript came from automatic speech recognition on Hindi, Gujarati and Hinglish code-switching audio. It will contain misheard words, wrong proper nouns, missing punctuation and stretches of garbage. Read through the noise for the conversation underneath. Only fail for corruption when there is no recoverable structure at all: random characters, no sentence shape, nothing parseable as language.

**Speech clustered entirely in one part of the video.** Fine. An interview that starts 6 minutes in after a long intro montage is normal. Use the distribution numbers to locate the real content, not to penalise the video.

## YOUR BIAS: APPROVE WHEN UNCERTAIN

You are a technical feasibility check, not a taste critic. Never reject because the content seems boring, niche, academic, amateur or poorly produced. A dull lecture with a visible speaker and a usable transcript is a PASS. What is interesting is the user's call.

When genuinely torn, PASS with lower confidence and a lower score. The asymmetry matters: a wrong rejection blocks the user completely and makes the product look broken, while a wrong approval just produces weaker clips they can ignore. Reserve FAIL for a clearly unsupported format or no recoverable speech. Lack of a quotable line, a quiet delivery, short exchanges, absent audience data, and an uncertain face inference are not hard failures.

## SCORING, SEPARATE FROM PASS/FAIL

Score 0-100 for how much clip potential the video actually has. A video can PASS with a low score, meaning usable but thin.

- 85-100: dense quotable conversation, strong emotional or savage moments, clear audience signals
- 70-84: solid talking-head content, several good clips likely
- 55-69: usable, a few decent moments, some digging required
- 40-54: thin — one workable stretch surrounded by filler
- 20-39: technically passable, very weak material
- 0-19: little apparent clip potential, or a failed hard requirement; a low score alone does not mean FAIL

Judge the score on the best moments you can actually point to, not on the average quality of the whole runtime.

## OUTPUT

Return ONE raw JSON object. No markdown fences, no text before or after.

{
  "status": "PASS" or "FAIL",
  "score": 0-100,
  "confidence": 0.0-1.0,
  "face_feasibility": "HIGH" | "MEDIUM" | "LOW" | "NONE",
  "transcript_quality": "DENSE" | "USABLE" | "SPARSE" | "PARTIAL" | "BROKEN" | "LYRICS",
  "content_type": "what this actually is, judged from the transcript, e.g. Podcast, Stand-up, Product keynote, Street interview",
  "reason": "two or three sentences: what this video is, why the face and speech requirements are or are not met, and any limitation the user should know about",
  "evidence": [
    {"at": seconds_as_integer, "quote": "a short real quote from the transcript that supports your decision"}
  ],
  "clip_potential": "one sentence on the kind of clips this would yield"
}

Put 2-4 items in "evidence", quoting the transcript verbatim with its timestamp. If you are failing the video, quote the parts that show why. Evidence is what makes your verdict checkable, so never invent a quote."""


def precheck(captions: dict) -> dict | None:
    """The only mechanical rejection: nothing to read.

    Note what is deliberately NOT here: no category filter, no line-count
    threshold, no coverage threshold. Those are judgements and they belong to
    the model, which can see the actual words.
    """
    if captions.get("needs_asr"):
        return {
            "status": "FAIL",
            "score": 0,
            "confidence": 0.95,
            "face_feasibility": "UNKNOWN",
            "transcript_quality": "BROKEN",
            "content_type": "Unknown",
            "reason": (
                "This video has no caption track at all, so there is no "
                "transcript to analyse. Running speech-to-text on the audio is "
                "a separate step that is not wired up yet."
            ),
            "evidence": [],
            "clip_potential": "Would need a speech-to-text pass first.",
            "decided_by": "precheck",
        }
    return None


def build_payload(
    metadata: dict,
    captions: dict,
    stats_brief: str,
    transcript_lines: str,
    comment_lines: str,
    comment_summary: str,
    heatmap_lines: str,
) -> str:
    """Assemble the prompt.

    Ordering follows the Cognitive Priming idea from the clip finder:
    measurements and audience signals first, then a hard separator, then the
    transcript last so it lands in the model's strongest recency window.
    """
    duration = int(metadata.get("durationSeconds") or 0)
    caption_kind = (
        "auto-generated by YouTube (full coverage expected)"
        if captions.get("kind") == "auto"
        else "MANUALLY UPLOADED by the creator (may be partial — check coverage)"
    )

    blocks = [
        "## VIDEO",
        f"Title    : {metadata.get('title', '')}",
        f"Channel  : {metadata.get('channel', '')}",
        f"Views    : {metadata.get('viewCount') or 'unknown'}",
        f"Likes    : {metadata.get('likeCount') or 'unknown'}",
        f"Comments : {metadata.get('commentCount') or 'unknown'}",
        "",
        "Title and channel are context only. Do not decide from them.",
        "",
        "## CAPTION SOURCE",
        caption_kind,
        f"Language: {captions.get('language', 'unknown')}",
        "",
        "## TRANSCRIPT MEASUREMENTS",
        stats_brief,
        "",
    ]

    if comment_lines:
        blocks += [
            "## AUDIENCE COMMENTS",
            comment_summary,
            "Comments containing timestamps mark moments the audience replayed.",
            "",
            comment_lines,
            "",
        ]
    else:
        blocks += [
            "## AUDIENCE COMMENTS",
            "None available (disabled or none fetched). Not a reason to fail.",
            "",
        ]

    if heatmap_lines:
        blocks += [
            "## MOST REPLAYED PEAKS ([seconds] score 0-1)",
            "Where viewers rewatched. Strong corroboration when it lines up with",
            "a dense speech stretch.",
            heatmap_lines,
            "",
        ]
    else:
        blocks += [
            "## MOST REPLAYED PEAKS",
            "Not available. YouTube only computes this above a view threshold.",
            "Common and NOT a reason to fail.",
            "",
        ]

    blocks += [
        "=" * 70,
        "EVERYTHING BELOW IS THE ACTUAL TRANSCRIPT OF THIS VIDEO.",
        "Everything above was measurements and audience signals about the same",
        "video. The transcript is machine-generated and will contain recognition",
        "errors, especially across Hindi, Gujarati and English code-switching.",
        "Read through the errors for the real conversation.",
        "=" * 70,
        "",
        f"## TRANSCRIPT ([seconds] text) — {duration}s runtime",
        transcript_lines,
        "",
        "=" * 70,
        "Now return your verdict as one raw JSON object, exactly matching the",
        "output schema. Quote real transcript lines in the evidence array.",
    ]

    return "\n".join(blocks)


def _parse_verdict(content: str) -> dict:
    """Pull the JSON object out of the model's reply."""
    text = content.strip()

    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    start = text.find("{")
    if start == -1:
        raise RuntimeError(f"model returned no JSON: {text[:300]}")

    depth = 0
    in_string = False
    escape = False

    for i, ch in enumerate(text[start:], start):
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return json.loads(text[start : i + 1])

    raise RuntimeError(f"model returned unbalanced JSON: {text[:300]}")


def _normalise(verdict: dict) -> dict:
    """Clamp and default fields so the UI can trust them."""
    status = str(verdict.get("status", "")).upper()
    if status not in ("PASS", "FAIL"):
        status = "PASS"  # matches the approve-when-uncertain bias

    try:
        score = int(round(float(verdict.get("score", 50))))
    except (TypeError, ValueError):
        score = 50
    score = max(0, min(100, score))

    try:
        confidence = float(verdict.get("confidence", 0.5))
    except (TypeError, ValueError):
        confidence = 0.5
    confidence = max(0.0, min(1.0, confidence))

    evidence = []
    raw_evidence = verdict.get("evidence")
    if isinstance(raw_evidence, list):
        for item in raw_evidence[:6]:
            if not isinstance(item, dict):
                continue
            try:
                at = int(float(item.get("at", 0)))
            except (TypeError, ValueError):
                at = 0
            quote = str(item.get("quote", "")).strip()
            if quote:
                evidence.append({"at": at, "quote": quote[:300]})

    return {
        "status": status,
        "score": score,
        "confidence": round(confidence, 2),
        "face_feasibility": str(verdict.get("face_feasibility", "MEDIUM")).upper(),
        "transcript_quality": str(verdict.get("transcript_quality", "USABLE")).upper(),
        "content_type": str(verdict.get("content_type", "Unknown"))[:80],
        "reason": str(verdict.get("reason", "")).strip(),
        "evidence": evidence,
        "clip_potential": str(verdict.get("clip_potential", "")).strip(),
        "decided_by": "llm",
    }


def ask(payload_text: str) -> dict:
    """Send the payload to a model and return a normalised verdict.

    Tries the primary, then each fallback, but only for failures a different
    model could actually fix: the provider being rate-limited or briefly down.
    A bad request or a rejected key fails on the first model, because asking a
    second one the same broken question wastes time and money.
    """
    if not OPENROUTER_API_KEY:
        raise RuntimeError("OPENROUTER_API_KEY is not set")

    attempts = [MODEL] + [m for m in FALLBACK_MODELS if m and m != MODEL]
    last: Exception | None = None

    for index, model in enumerate(attempts):
        try:
            return _ask_one(payload_text, model)
        except _Retryable as exc:
            last = exc
            remaining = attempts[index + 1 :]
            if not remaining:
                break
            events.note(
                f"{model} is rate-limited upstream, so the check is falling "
                f"back to {remaining[0]}. Nothing is wrong with the video."
            )
            events.log(f"[bouncer] {model} unavailable: {exc}")

    raise RuntimeError(
        f"every model was unavailable ({len(attempts)} tried). Last error: {last}"
    )


class _Retryable(RuntimeError):
    """A failure another model might not have. Never a bad request."""


# Provider is rate-limited, overloaded, or briefly gone. Another model is
# worth trying. Anything else (400 bad request, 401 bad key, 402 no credit)
# would fail identically on every model.
_TRY_ANOTHER_MODEL = {429, 502, 503, 504}


def _ask_one(payload_text: str, model: str) -> dict:
    body = json.dumps(
        {
            "model": model,
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": payload_text},
            ],
            "temperature": 0.3,
            # An explicit, generous ceiling. This call used to send none at all,
            # so the provider applied its own default and the verdict was cut off
            # mid-sentence: measured, a real run returned
            # '"reason": "The recording captures a live stage performance with
            # two clear speakers addressing an audience, ensuring reliable face
            # track' and stopped there, which the parser then reported as
            # "unbalanced JSON" -- a parse error for what was really a budget.
            #
            # The gate reasons before it answers (measured: 1,206 reasoning
            # tokens against 272 of actual JSON), and reasoning is billed out of
            # the same budget as the answer. So the ceiling has to fit BOTH. At
            # mercury-2.5's output rate the worst case here is about 12 paise and
            # the normal case bills ~1,500 tokens, so there is no reason to be
            # tight about it.
            "max_tokens": LLM_MAX_TOKENS,
            # OpenRouter returns the real charge for this call, which beats
            # estimating from token counts and listed rates.
            "usage": {"include": True},
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        OPENROUTER_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://wowclip.local",
            "X-Title": "wowClip Ingestion",
        },
        method="POST",
    )

    started = time.time()

    try:
        with urllib.request.urlopen(request, timeout=LLM_TIMEOUT) as res:
            result = json.loads(res.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")[:300]
        message = f"OpenRouter {e.code}: {detail}"
        if e.code in _TRY_ANOTHER_MODEL:
            raise _Retryable(message) from e
        raise RuntimeError(message) from e
    except urllib.error.URLError as e:
        # Timeout or a dropped connection. Worth trying the next model.
        raise _Retryable(f"{model} did not respond: {e.reason}") from e

    elapsed = time.time() - started

    # OpenRouter reports some upstream failures as a 200 with an error body.
    if "choices" not in result:
        detail = str(result.get("error") or result)[:300]
        raise _Retryable(f"{model} returned no answer: {detail}")

    content = result["choices"][0]["message"].get("content", "") or ""
    if not content.strip():
        raise _Retryable(f"{model} returned an empty answer")

    usage = result.get("usage", {}) or {}
    prompt_tokens = int(usage.get("prompt_tokens", 0) or 0)
    completion_tokens = int(usage.get("completion_tokens", 0) or 0)

    # Prefer OpenRouter's own figure; fall back to listed rates.
    reported = usage.get("cost", usage.get("total_cost"))
    if reported is not None:
        cost_usd = float(reported)
        cost_source = "openrouter"
    else:
        cost_usd = (
            prompt_tokens * INPUT_PRICE_PER_1M
            + completion_tokens * OUTPUT_PRICE_PER_1M
        ) / 1_000_000.0
        cost_source = "estimated"

    verdict = _normalise(_parse_verdict(content))
    verdict.update(
        {
            "model": model,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": int(usage.get("total_tokens", 0) or 0),
            "cost_usd": round(cost_usd, 8),
            "cost_inr": round(cost_usd * INR_PER_USD, 6),
            "cost_source": cost_source,
            "llm_seconds": round(elapsed, 2),
        }
    )
    return verdict
