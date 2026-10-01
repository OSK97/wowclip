# wowClip

Paste a YouTube link, get the moments worth posting.

```bash
cd C:\Users\DP\Desktop\App\wowClip
python -m wowclip run https://youtu.be/VIDEOID
```

That is the whole interface. Everything else is a flag on it.

---

## First-time setup

Add your DeepSeek key to `api_keys.json` (everything else is already there):

```json
{
  "DEEPSEEK_API_KEY": "sk-...",
  "YOUTUBE_API_KEY": "...",
  "GPROXY_USER": "...",
  "GPROXY_PASS": "..."
}
```

Then check nothing is broken. This costs nothing and touches no network:

```bash
python selftest_wowclip.py          # must print "84 passed, 0 failed"
```

You need `yt-dlp` (nightly), `ffmpeg`, and `modal` on PATH. You already have all three.

---

## The commands

```bash
python -m wowclip run <link>                # everything
python -m wowclip run <link> --build-only   # stop before the LLM. Free.
python -m wowclip run <link> --note "focus on the failure stories"
python -m wowclip run <link> --skip-bouncer # ignore the gate
python -m wowclip run <link> --refresh all  # ignore the cache

python -m wowclip show <video_id>           # what's already cached
python -m wowclip compose <video_id>        # rebuild transcript only. Instant.
```

**The one you will use most is `compose`.** Once a video is cached, rebuilding
the transcript with new settings takes about a second and costs nothing — no
download, no GPU, no API. Change a threshold in `config.py`, run `compose`, look
at `cache/<id>/build/transcript.txt`, repeat.

---

## What happens when you run it

```
FETCH          bouncer gate → metadata → captions + heatmap → comments → audio
AUDIO          ffmpeg loudness  +  Modal T4 (PANNs CNN14 + Silero VAD)
TRANSCRIPT     words → sentences → audio markers merged in
PAYLOAD        one text document, ordered for how attention actually works
FINDER         DeepSeek, then code fixes the boundaries it was never good at
```

Output lands in `cache/<video_id>/build/`:

| file | what it is |
|---|---|
| `transcript.txt` | what the model reads. **Look at this one.** |
| `<title>__motivational.txt` | the full payload that was sent |
| `motivational_report.md` | clips, cost, and the model's full thinking block |

---

## Caching

Nothing expensive ever happens twice.

```
cache/<video_id>/
  raw/         captions.json3, audio.m4a, API responses   never refetched
  derived/     words.json, audio_modal.json (the GPU run)  never recomputed
  build/       transcript.txt, payload, report             always rebuilt
  runs/        one JSON per LLM call, kept forever
  manifest.json
```

The split is the point. `raw` and `derived` cost money, bandwidth or GPU time —
they are written once and then treated as permanent. `build` is free, so it is
thrown away and regenerated every single run, which means a code change always
shows up and you never debug a stale file.

To force one stage to refetch: `--refresh captions`, `--refresh audio_modal`,
`--refresh all`.

---

## Changing what the model sees

**The prompt** is `prompts/motivational.md`. Edit it directly. It is split by
`<<<SECTION:NAME>>>` markers, and the payload builder assembles those sections
in a specific order:

```
MINDSET        who you are, what a viral clip is        ← read first
SIGNALS        how to read comments and the heatmap
CATEGORIES     the landscape, explicitly not a cage
EXAMPLES       your 60 real reels + 15 synthetic
ANTIEXAMPLES   your 30 failures
                 ↓ then the actual video data
               metadata → comments → heatmap → grounding block
               → FULL TRANSCRIPT
OUTPUT         what JSON to return                      ← read last
```

Instructions first, real data last, output format at the very end. The
transcript sits closest to where generation begins because that is what needs
the most attention.

Adding a category later — emotional, entertainment, audience favourite, general
— means writing `prompts/<name>.md` with those six section markers and running
`--category <name>`. No code changes.

**The transcript format** is `config.py`. Every threshold is there with the
reasoning next to it. The ones worth touching:

| setting | effect |
|---|---|
| `LINE_MAX_SECONDS` | how long a line can get before it splits anyway |
| `ENERGY_MIN_DELTA_DB` | how loud is loud enough to be worth marking |
| `PACE_MIN_DELTA_WPM` | same for speaking speed |
| `EVENT_MIN_SCORE` | per-sound confidence floors for PANNs |
| `PAUSE_MIN_S` | shortest silence worth calling a dramatic pause |

Change one, run `compose <video_id>`, read the transcript. One second per loop.

---

## What the transcript looks like now

```
[0]  ((music 5s))
[7]  ((big applause 4s))
[11] Wow. What an audience.
[14] But if I'm being honest, I don't care what you think of my talk.
[18] -3dB I don't. I care what the internet thinks of my talk.
[24] +90wpm And I think that's where most people get it wrong.
[34] -9dB Thanks for the click.
[61] Why are balloons so expensive?
[64] ((pause 1.7s))
[65] Inflation.
[68] ((applause 2s))
```

That is real output from your TEDx sample. You can *see* the joke: setup, beat,
punchline, laugh. So can the model.

Compare the old format for the same content:

```
[11]|-15|360| second third generation who's not good
[12]|-14|210| at keeping secrets the wealth will go
[14]|-15|210| away. Were you good at keeping secrets
```

Three things changed and each fixed a real problem:

1. **One line = one sentence.** The model can only pick boundaries at line
   starts, so lines have to *be* legitimate places to start and end. Two-second
   ASR fragments never were.
2. **The numbers are relative to this video.** `+5dB` means "5 dB louder than
   this speaker normally is". Absolute dB meant nothing across videos — the
   Kunal Shah interview sits at −14 to −16 throughout, and the old prompt's
   legend said that range was shouting, so a calm three-hour conversation read
   as three hours of screaming.
3. **Markers only appear when they mean something.** No marker = normal
   delivery. About 70% of the old numeric noise is gone, and every number left
   carries information.

---

## What runs where

| stage | where | cost |
|---|---|---|
| bouncer | OpenRouter | ~₹0.03 |
| captions + heatmap | yt-dlp via GProxy, captions direct | ~1 MB proxy |
| metadata + comments | YouTube Data API | free tier quota |
| audio | GProxy for the CDN URL, bytes direct from your IP | bandwidth only |
| loudness | ffmpeg, your machine | free |
| PANNs + VAD | Modal T4 | ~₹0.40 |
| finder | DeepSeek V4 Flash | ~₹1.00 |

About ₹1.50 a video, all in, and almost all of it is the one-time part. Re-running
the finder on a cached video is roughly ₹1, and rebuilding the transcript is free.

Audio is uploaded to Modal as 32 kHz mono Opus, not the original m4a — both
models downsample and downmix anyway, so a 175 MB podcast becomes about 40 MB
with nothing lost that either model could see.

---

## What the code does that the model doesn't have to

Everything here is work the model would otherwise spend reasoning tokens on:

- comment timestamps converted to seconds, so `1:18:28` and `[4708]` compare by eye
- heatmap peaks printed **with the words spoken there**, so a peak is judgeable
  instead of something to go hunting for
- clip end times resolved from word-level timings — the model names the last
  *line* it wants, code carries the cut to the end of that line's final word
- clip starts snapped to a quarter-second before the first word
- quoted anchor words checked against the transcript; if the words are real but
  the timestamp is wrong, the boundary moves to where the words actually are
- if the anchor words appear nowhere, the clip is flagged as invented

That last pair is the hallucination check, and it costs nothing.

---

## Files

```
wowclip/
  cli.py          the commands
  cache.py        the artifact store
  fetch.py        wraps omni_bouncer / step_05 / step_06
  words.py        json3 → word-level
  lines.py        words → sentences
  audio_local.py  ffmpeg loudness
  audio_modal.py  the Modal GPU app
  events.py       PANNs + VAD → trustworthy events
  compose.py      the transcript. the heart.
  payload.py      CPA assembly
  finder.py       DeepSeek call
  verify.py       boundary snapping + anchor checking
  config.py       every threshold, with reasoning
prompts/
  motivational.md
selftest_wowclip.py  84 offline checks
```

`omni_bouncer.py`, `step_05_fetch_comments.py` and `step_06_download_audio.py`
are imported, not replaced. They hold real knowledge about how YouTube behaves
and duplicating them would mean two copies drifting apart.

Your older experimental files are untouched. Nothing in `wowclip/` reads them.
