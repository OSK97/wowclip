# OMNI-SCOUT v5

One command decides whether a YouTube link is worth running through wowClip.

```bash
cd C:\Users\DP\Desktop\App\wowClip
python omni_bouncer.py https://youtu.be/VIDEOID
```

---

## Files

| File | What it is |
|---|---|
| `omni_bouncer.py` | The whole thing. Run this. |
| `omni_bouncer_prompt_v4.md` | The LLM prompt. Edit this to change judgement — no code changes needed. |
| `api_keys.json` | `YOUTUBE_API_KEY`, `GPROXY_PASS`, `OPENROUTER_API_KEY` |
| `selftest.py` | 60+ offline checks. No network, no cost. |

**You can delete** `step_01_validate_link.py`, `step_02_download_transcript.py`, `step_03_download_heatmap.py`, `step_04_download_metadata.py` once you've confirmed this works. Nothing imports them — all four are absorbed. Keep them one more day if you want a fallback.

---

## Check it works

```bash
python selftest.py                          # offline, instant, must print ALL PASSED
python omni_bouncer.py <link> --no-llm       # fetch + forensics, no LLM cost
python omni_bouncer.py <link>                # the real thing
python omni_bouncer.py <link> --save-payload # dumps payload_<id>.txt for prompt work
```

Links worth trying: a normal podcast, a music video (should block), a gaming VOD (should block), a Short (rejected offline in 0.000s), a video with a long music intro (should warn with the exact range), and something with no captions.

---

## Flags

| Flag | Effect |
|---|---|
| `--debug` | Forensics, vetoed model claims, score internals. |
| `--json` | Machine-readable only. Feed straight into the next pipeline stage. |
| `--no-llm` | Fetch + forensics, skip the LLM. Free. |
| `--save-payload` | Write the exact LLM input to `payload_<id>.txt`. |
| `--quiet` | User-facing verdict only, no diagnostics. |
| `--keep` | Write the full run record to `runs/<id>.json`. |

Exit codes: `0` = GO / GO_WITH_WARNINGS, `1` = NO_GO or bad link, `2` = cancelled, `3` = unexpected crash.

---

## What it does

```
PHASE 0  parse the link offline                          0.000s   free
PHASE 1  ├─ A: YouTube Data API → validate + metadata     ~0.3s   1 quota unit
         └─ B: GProxy → yt-dlp extract → json3 download    ~4s    ~1 MB proxy
PHASE 2  transcript forensics in Python                   0.02s   free
PHASE 3  build payload → OpenRouter                        ~4s    ~$0.0002
PHASE 4  merge LLM verdict with hard invariants
```

**Two things made it fast.** `step_02` and `step_03` each ran their own `yt_dlp.extract_info()` — the single most expensive call in the pipeline, paid for twice. The heatmap ships inside the same blob as the caption track list, so it's now one call. Same for `step_01` and `step_04`, which each made their own Data API call for overlapping fields.

**The proxy handshake runs first inside track B on purpose.** It costs no bandwidth, and by the time it returns, the Data API has already said whether the video is real. A deleted, private, or currently-live video is rejected before a single byte of GProxy bandwidth is spent.

---

## Blocks vs warnings

Only five things block. Everything else passes with a score and honest warnings.

**Blocks:** `MUSIC`, `GAMING`, `MOVIE`, `TRAILER`, `SPORTS_BROADCAST`, plus `NO_USABLE_TRANSCRIPT` when there's genuinely nothing to read.

**Not blocks** — these all pass: tutorials, screen recordings with no face at all (centre-crop handles it), lectures, news, vlogs, reactions, documentaries, foreign languages, amateur production, low views, boring. A video with 25 minutes of music followed by 10 good minutes passes with a `DEAD_ZONE` warning naming the exact range.

To stop blocking live sports, delete `"SPORTS_BROADCAST"` from `VALID_BLOCKS` in the code and remove section 5 from the prompt.

---

## The reliability trick

A cheap model cannot count minutes of silence across a 3-hour transcript, so it isn't asked to. Python measures everything countable — coverage %, dead zones with exact ranges, words-per-minute, a density map, the lyrics fingerprint — and hands them over as facts. The LLM only does judgement and language.

Then code enforces what must never depend on the model having a good day:

- A measured dead zone **always** produces a warning, whether or not the LLM noticed.
- An empty transcript **always** blocks, even if the LLM said GO with score 95.
- A `NO_GO` always carries a block object; a block always clears the warnings.
- Invalid decisions, scores, block codes and warning codes from the model are dropped, not trusted.
- If the LLM fails entirely, you still get a complete verdict built from measurements — flagged as degraded, never a stack trace.

**The lyrics check is deliberately cautious.** Repetition alone is not a song — chants, mantras, guided meditation, language drills and sales scripts all repeat heavily while being perfectly good speech. `STRONG` (blockable) needs repetition *plus* music tags or fragmentary lines. Anything else returns `MODERATE` and the prompt explicitly forbids blocking on it.

Verified: real song → `STRONG`; mantra → `MODERATE`; repetitive podcast → `MODERATE`; normal conversation → `NONE`.

---

## v5 — it now judges the content, not just the transcript

The model reads the transcript and reports **3-8 actual candidate moments** with real timestamps, verbatim quotes, a flavour (COMEDY / SAVAGE / SIGMA / DEBATE / FEELING / FACT / STORY) and a strength 1-10. Those moments *are* the reasoning behind the score — a 90 with four strong quotes is believable, a 90 with nothing listed is not.

**Scoring is peak-based, not average-based.** This is the whole design:

- A flat 3-hour podcast with **one** devastating story scores well. The boring 176 minutes cost nothing — the pipeline skips them.
- A dense, articulate, utterly boring lecture scores **low**, even at 99% coverage. Nothing in it survives being cut to 40 seconds.

That asymmetry is enforced in code. A strong moment (strength ≥7) unlocks the measurement floor; without one the floor drops away entirely. Tested: a boring lecture whose measured floor was **85** correctly scores **16**, while a flat podcast with one strength-9 story rises to **78**. A density-only floor — what v4.1 had — would have rescued exactly the lectures that deserve to sink.

The prompt is told to **lean generous**: when torn between two bands, take the higher one. The five downstream finders are far more thorough and will find things the scout skims past, and a false "bad" costs you a video that would have been a hit, while a false "good" costs ₹0.03.

**`category_outlook`** predicts which of your five specialist finders is worth running — motivational, emotional, entertainment, audience_favourite, general — each HIGH/MEDIUM/LOW/NONE. Skip the ones that will come back empty.

**Heatmap peaks now carry their words.** The payload includes the actual transcript text at each "most replayed" point, not just a timestamp. Thousands of viewers already voted; handing the model the words turns that vote into something it can judge, and it's what makes the "one great moment in a flat video" case score correctly.

**Score-down rules** the prompt applies: screen-dependent tutorials (capped ~45 — "click Export" is not a reel), faceless voiceover (−10), flat monologue, straight bulletin reading, promo content. **Score-up:** conflict, personal stories with a turn, strong opinions, money talk, audible crowd energy, masala. Never down for language, production quality, niche topic, or a subject the model finds dull.

**Invented quotes are dropped.** Every quote is checked against the transcript; cheap models paraphrase from memory when they can't find a real line. `--debug` reports how many were dropped.

## v4.1 changes

- **No retries.** One attempt. If the model 429s or replies non-JSON you get the error and it stops.
- **Terminal output is minimal** — timings, total, verdict. Everything else moved behind `--debug`.
- **Captions download direct, not through GProxy.** That file is the biggest download in the run (1.6 MB on an 84-min video) and the proxy was adding ~25s and eating bandwidth you pay for by the megabyte.
- **Transcript chunked into ~22s blocks** before it goes in the payload. YouTube ships one ASR event every ~2s; at 2,104 lines the timestamps cost more tokens than the speech. ~57% smaller.
- **Score floor computed from measurements.** The model scored your 98.7%-coverage Raj Shamani podcast at 55. It is now 82. The model can argue a video is better than the numbers suggest, not worse.
- **Model claims that contradict arithmetic are dropped.** It said "35% of the video is silent" about a video measured at 98.7% coverage with zero gaps, and cited the forensics block as its own evidence. `LOW_COVERAGE` above 55% coverage, `DEAD_ZONE` with no measured gap, `LOW_DENSITY` above 110 wpm, and a `MUSIC` block on a `NONE` lyrics signal are all now vetoed in code. `--debug` lists what was dropped.
- **Max 3 warnings**, measured ones first. Best regions under 15s discarded.

## Two things I couldn't test from here

My sandbox blocks `openrouter.ai` and `googleapis.com`, so every network path ran against mocks. Logic, forensics math, payload assembly, retry ladders and all failure paths are tested; the live calls are not. On your machine, watch for:

1. **Does `inclusionai/ling-2.6-flash` honour `response_format: json_object`?** If it returns prose, the code already retries with a stricter instruction and then digs the JSON out of the text — but check the `LLM retries` line in the diagnostics. If it retries every time, that's why.
2. **Does it obey the schema at 30K tokens?** A 3-hour podcast builds a ~28K-token payload. Cheap models drift on long inputs. If `content_type` or warning codes come back malformed, the code drops them silently — the `--json` output will show fewer warnings than the diagnostics suggest.

If the model turns out to be too weak, change `MODEL` at the top of the file. Nothing else needs to move.

---

## Cost

At $0.01/$0.03 per 1M tokens, a 3-hour podcast costs roughly **$0.0003 (₹0.03)** per check. The payload budget exists for latency, not money — it caps at 110K chars and samples *evenly across the whole timeline* rather than truncating, because the exact case this tool exists to catch (20 minutes of music, then the good part) lives at the end of the video.
