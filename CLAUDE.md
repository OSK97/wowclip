8# SYSTEM CONTEXT — What This Project Is

I am Laksh Diyora and I am building an automated YouTube-to-Reel pipeline — a tool where a user pastes a YouTube link and gets back real, polished, viral-quality short-form reels. Think OpusClip, QuickReel, Klap — but better at the one thing that actually matters: finding the best clip.

---

## The Problem I Am Solving

Tools like OpusClip are very, very costly. We are talking ₹900 for just 200 minutes of video processing — that is insane for any Indian creator, any middle-class person starting their first channel, anyone who just wants to experiment. And beyond cost, these tools give a confusing, generic experience. You upload a video, get 10 mediocre clips, and none of them feel like a real viral reel. The overlays are basic, the clip selection is average, and there is no unique creative touch.

What I want is the opposite — a system where the user pastes one YouTube link and gets back the absolute best clips imaginable, with real dynamic editing (B-roll, infographics, live images from scrapers, animated overlays from my Remotion template library), not some generic subtitle-on-video output. A reel that looks like a professional editor spent 2 hours on it, but was generated in under 2 minutes for under ₹10.

The core feature — the thing that beats everyone — is clip selection. If my system finds even 10% better clips than OpusClip, I win. Everything else (UI, speed, editing) is important but secondary. The clip quality is what makes or breaks a reel tool.

---

## The Pipeline Overview (End to End)

Here is how the full system works, step by step:

### Step 0: Video Validation (Omni Bouncer)

Before anything runs, the video goes through the Omni Bouncer — a gatekeeper AI that checks two things:
1. Does the video have a visible, trackable talking human face? (Required for TalkNet Active Speaker Detection to work — it will crash on faceless content, gaming, sports, music videos, screen recordings)
2. Is the transcript dense enough to extract viral spoken clips from? (A video with 80% singing or a near-empty transcript is useless)

Both conditions must be true. The Omni Bouncer checks metadata, transcript, and heatmap data, then outputs PASS/FAIL with confidence and reasoning.

**What PASSES:** Podcasts, interviews, speeches, presentations, vlogs with visible face, sitcoms, stand-up comedy, pranks/social experiments, reality shows, talk shows.

**What FAILS:** Faceless tutorials, screen recordings, live sports (stadium wide-shots), gaming VODs, full movies, movie trailers, music videos, cinematic/ambient footage, POV faceless vlogs, near-empty or lyrics-only transcripts.

The key principle: if a human watching the video would hear multiple stretches of natural conversation, it has extractable viral content. Content preference (boring vs interesting) is NOT a rejection reason — that is the user's choice.

---

### Step 1: Data Fetching

When a YouTube link comes in, the system fetches 5 types of data:

**1. TRANSCRIPT (most important)**
- Fetches YouTube's auto-generated subtitles (YouTube already runs its own ASR model on every video — no need to run Whisper on 2 hours of audio just to get a transcript)
- Primary method: yt-dlp (nightly build, not stable — YouTube keeps changing things) routed through GProxy residential proxy, downloads subtitle in json3 format
- Before fetching, calls the official YouTube Data API to discover which language track exists (Hindi, English, etc) so we fetch the correct one
- Fallbacks: ~9 Apify scraper actors that try one by one, plus ScrapeCreators API as last resort
- No Whisper at this stage — Whisper is only used later for the final selected 1-minute clip

**2. METADATA**
- Fetches: title, channel name, views, likes, comment count, duration, upload date, tags, description
- Primary: official YouTube Data API (free tier, uses API key)
- Fallbacks: Scrappa API → Apify scrapers → yt-dlp --dump-json through GProxy

**3. COMMENTS (top 350)**
- Fetches YouTube comments and sorts by a viral score where comments containing timestamps get a 5x weight boost (timestamp comments are gold — they point directly to moments the audience loved)
- Primary: official YouTube Data API with pagination (up to 600 comments)
- Fallbacks: yt-dlp Python API through GProxy → yt-dlp direct → Scrappa API
- Filters out links and empty comments, calculates viral score, sorts, keeps top 350

**4. HEATMAP (YouTube "Most Replayed" data)**
- Fetches viewer replay intensity — shows how much viewers replayed each section (score 0 to 1, where 1 = most replayed)
- Not all videos have this data — YouTube only generates it for videos with enough views
- Primary: Apify scraper actors (8 different fallback scrapers)
- yt-dlp is disabled for heatmap because of GProxy bandwidth limits
- Raw points are interpolated to every 5 seconds

**5. AUDIO (for energy/emotion detection)**
- Fetches the actual audio stream of the video
- Primary: yt-dlp through GProxy extracts only the CDN URL (few KB), then downloads audio DIRECTLY from YouTube CDN without proxy using parallel chunked download (16 threads async)
- Fallbacks: Apify actors for CDN URL → yt-dlp direct
- After download, uses ffmpeg to remux (no transcoding, just container copy)

**Important context about tools:**
- GProxy is a cheap residential proxy (~₹200 for ~200MB bandwidth). STRICTLY only used for small lightweight requests (subtitle JSON, metadata, CDN URL extraction). NEVER for downloading actual audio/video — the bandwidth is too limited.
- yt-dlp must be the nightly build because YouTube changes frequently and the stable version breaks often.
- Official YouTube Data API is free tier with daily quota limits.
- Apify actors are third-party scrapers on Apify platform with their own residential proxies, used as fallbacks.
- No Whisper or heavy model is used at the fetch stage.

---

### Step 2: Audio Analysis

After fetching, the system runs audio analysis on the downloaded audio to enhance the transcript with energy signals and tags. There are two levels:

**LOCAL AUDIO ANALYSIS (runs on my machine, no GPU needed)**
- Uses FFmpeg + lightweight YAMNet ONNX model (CPU only)
- What it does:
  - **Loudness detection:** FFmpeg's ebur128 filter gives per-second volume levels in dB (0 = shouting, -10 = normal loud, -25 = whispering). Tells the LLM where the speaker is getting emotional, angry, or whispering dramatically.
  - **Silence/Pause detection:** FFmpeg's silencedetect filter (threshold -40dB, minimum 1.5s) finds dramatic pauses. Tagged as [PAUSE 2.5s] etc in the transcript.
  - **Emotion/Event detection:** YAMNet ONNX model detects laughter, clapping, cheering, applause. Tagged as [LAUGHTER], [APPLAUSE] etc inline in transcript.
- Final output: enhanced transcript where each line is `[StartSec]|Vol(dB)|WPM| text with [PAUSE] and [LAUGHTER] tags`
- If audio download failed, transcript still works but without the Vol(dB) column — the prompt automatically adapts

**MODAL GPU ANALYSIS (runs on Modal cloud GPU, for heavy analysis)**
- **PANNs CNN14 (Modal T4 GPU):** Deep audio neural network trained on Google's AudioSet (527 classes). Detects per-second: laughter, giggle, belly laugh, applause, clapping, cheering, crowd noise, shouting, screaming, crying, sobbing, sighing, gasping, groaning, music, singing — all with confidence scores. Also detects "silence zones" (emotional dramatic pauses). Way more accurate than local YAMNet for comedy and emotional content. Costs ~₹1-2 per video.
- **WhisperX (Modal A10G GPU):** Precision pass using Whisper large-v3 with word-level alignment and speaker diarization (identifies who is speaking). Only used for the final selected 1-minute clip, not the full video. Exact word-level timestamps + speaker identification. Float16 for fast inference.

---

### Step 3: Payload Building (Cognitive Priming Architecture)

After gathering all data (transcript, metadata, comments, heatmap, audio signals), the payload builder combines everything into a single massive TXT file — the thing that gets sent to DeepSeek for clip finding.

**What the payload builder does:**
- Loads the prompt template (system prompt with instructions, examples, anti-examples)
- Loads metadata, formats it compact
- Loads comments, deduplicates, cleans unicode/emoji, converts all timestamps from human format (1:18:28) to machine format ([4708s]) so the LLM does not waste thinking tokens on time math
- Loads heatmap, compresses to only peaks above 0.50 (below = viewers skipped, not useful)
- Loads enhanced transcript, strips YouTube's own ASR tags ([LAUGHTER] etc) because my PANNs CNN14 and YAMNet are better quality
- Removes >> speaker prefixes from transcript to save tokens
- If audio failed, automatically removes all volume-related instructions from the prompt so the LLM does not get confused by instructions about data that does not exist
- Assembles everything in a specific order called **Cognitive Priming Architecture (CPA)**

**The CPA order matters because LLMs have attention biases** — they pay more attention to what they read first and last, and lose focus in the middle. The order is designed around this:

1. **SYSTEM PROMPT** — role, mindset, what makes a viral reel, 6 non-negotiable qualities (perfect start, perfect end, self-contained meaning, dopamine trigger, not boring, worth saving), rejection criteria
2. **HOW TO USE THE DATA** — explains transcript format, heatmap format, comments format, cross-signal validation rules
3. **CATEGORIES** — content subcategories as a GUIDE not a CAGE (e.g., 15 motivational subcategories: hustle, money, failure, self-belief, reality check, loneliness, shayari, sarcasm, women empowerment, question-hook, scientific, spiritual, one-liner, celebrity, anti-society)
4. **60 REAL VIRAL EXAMPLES** — actual transcripts of real Instagram reels that went viral, with WHY IT WORKS explanations. These train the LLM's taste.
5. **30 ANTI-EXAMPLES** — real clips that LOOK good but are actually trash, with WHY IT FAILS explanations. These train the LLM's rejection instinct.
6. **VIDEO METADATA** — title, channel, duration, views
7. **AUDIENCE REACTIONS (COMMENTS)** — top comments sorted by likes, with note that timestamp-containing comments are HIGH VALUE signals
8. **HEATMAP** — viewer attention data, only peaks
9. **GROUNDING BLOCK** — critical separator: "EVERYTHING above was CALIBRATION — examples, anti-examples, instructions. They are NOT from this video. Do NOT confuse them with the actual content below."
10. **FULL TRANSCRIPT** — placed LAST because of recency bias (LLM remembers most recent content best, and this is what it needs to analyze most carefully)
11. **ANALYSIS PROCESS & OUTPUT FORMAT** — placed at the very end so the LLM remembers the format when generating

Note: PANNs CNN14 audio event tags (inline laughter, applause, crying detection in transcript) are not fully integrated into the payload builder yet — the local analysis (loudness, silence, WPM) is working, but full PANNs tags are not merged yet.

---

### Step 4: Clip Selection (The Core — 5 Specialized Prompts)

I do not use just one generic "find viral clips" prompt. I have 5 separate specialized prompts, each designed to find a different TYPE of viral content.

**Why 5 separate prompts instead of 1:**
1. The prompt becomes too massive with all examples combined (~300K+ tokens). After around 100K tokens, models start hallucinating more, losing context from the middle, and degrading in quality. Staying under ~100K per run is the safe zone.
2. Different content types require OPPOSITE evaluation criteria. Motivational dopamine and comedy dopamine are completely different things. A funny clip is NOT motivational. A clip that makes you cry is NOT entertaining. One LLM pass trying to find all types simultaneously does none of them well.

**The 5 categories:**

1. **MOTIVATIONAL REEL FINDER** — finds clips that trigger motivational dopamine: hustle energy, reality checks, self-belief, money truths, failure resilience, one-liner punches, spiritual fire, anti-society rebellion. Has 60 real viral examples + 30 anti-examples + 15 subcategories. This is the most developed prompt.

2. **EMOTIONAL / HEART-TOUCHING REEL FINDER** — finds clips that make the viewer cry, feel a lump in their throat, want to call their mother: parent love, harsh society truths, men's hidden pain, emotional shayari, spiritual bhakti tears, loneliness validation, death/grief, heartbreak, failure survival, self-worth, women's pain, generational struggle. Has 100+ real viral emotional reel examples + anti-examples + 15 subcategories. Uses PANNs emotional detection data (CRY, SOB, SIGH, GASP, SILENCE tags) as a secret weapon signal.

3. **VIRAL ENTERTAINMENT & SAVAGE MOMENT FINDER** — finds clips that make the viewer physically laugh or gasp: savage roasts, brutal comebacks, witty one-liners, awkward cringe, crowd work/heckler destroys, sarcastic truth bombs, debate shutdowns, sigma cold responses, verbal warfare, controversy ownership. Has 75+ real viral entertainment examples + anti-examples + 20 subcategories (comedy + savage/debate/sigma). Uses PANNs laughter/cheering detection.

4. **AUDIENCE FAVOURITE FINDER** — completely different from the others. Does NOT use its own judgment. Acts as an "audience archaeologist" — ONLY follows data (heatmap peaks + comment evidence) to find the ONE moment the real audience loved most. Uses a tier system: Tier 1 (both heatmap + comments agree), Tier 2 (one strong + one supporting), Tier 3 (only one signal). Returns NULL if no clear favourite exists. The point: sometimes the audience's favourite moment is not motivational, not emotional, not funny — it is something uniquely specific to THAT video and THAT audience. This prompt catches those.

5. **GENERAL VIRAL / FASCINATION NET FINDER** — catches EVERYTHING the other 4 miss: shocking facts, hot takes, life hacks, paradigm-shifting philosophy, uncomfortable truths, interview shutdowns, logical paradoxes, cultural commentary, money wisdom, insane stories, counter-intuitive truths, relationship dynamics. Has 60+ real viral examples. This is the safety net.

**Caching strategy:** The transcript + metadata + comments + heatmap are shared input. Sent once (cached by DeepSeek), and only the system prompt is swapped for each category run. Because of DeepSeek's prompt caching ($0.014/1M for cached input), running all 5 categories costs almost nothing extra after the first run.

---

### Step 5: Active Speaker Detection (ASD)

After clip selection, the pipeline needs to convert landscape podcast video (two people side by side) into vertical 9:16 reels. This requires knowing WHO is speaking at every moment.

- Uses **TalkNet-ASD** (NVIDIA research) running on Modal T4 GPU
- Uses both audio and visual features to detect which person is talking at each frame
- Outputs bounding box + speaking confidence for each detected face at each timestamp
- Allows dynamic landscape-to-portrait cropping, always centered on the active speaker
- Costs ~₹1 per video

---

### Step 6: Video Editing with Remotion

Once I have the selected clip + ASD data, editing happens through **Remotion** — a React-based programmatic video framework. Everything is driven by JSON config files, meaning an LLM can generate editing decisions as JSON and Remotion renders them automatically.

**I have built a comprehensive library of 50+ Remotion templates:**

| Category | Templates |
|---|---|
| **Core Components** | BlurredBackgroundVideo (podcast-to-reel conversion), ChecklistView, ComparisonView, DepthText, DynamicComparison, DynamicShowcase, MediaShowcase, PortraitAnimation, ProductReveal, QuoteCard, ShortsOverlay, ShowcaseCard, SmartTextView, SocialPostEmbed, TextBehindPerson, TimelineView, TableAnimation |
| **Infographics** | AestheticNews, CommanderTable, ElonRocketNews, GovernmentDocument, PaperHighlight |
| **Graphs & Data** | BarGraph, LineGraph, PieChart, GrossVolume, NetworkGraph, LargeNumber |
| **Maps** | SingleMap, ComparisonMap, TableMap, TimelineMap, FullCountryMap, BubbleMap |
| **Social Embeds** | TwitterPost, InstagramPost, RedditPost, EvolutionHighlight, MediaGrid |
| **Motion Graphics** | CinematicFocusShift, AppleAnimation, CircularIntro, ProductShowcase |
| **Text & Time** | TvText, YearTimeline, CalendarComposition, Timeline |
| **LLM-Generated v1** | BatteryLow, BreakingNews, CalendarDate, CodeSnippet, CountdownTimer, DefinitionCard, FactCard, LoadingProgress, PodcastAudioWave, PriceTag, ProsConsList, RatingStars, StockTicker, TweetQuote, WeatherAlert |
| **LLM-Generated v2** | AchievementUnlocked, AudioBookQuote, DailySchedule, RecipeCard, SplitScreenDebate, StatisticHighlight, WorkoutRoutine |

All templates are JSON-config driven. Many have their own LLM_PROMPT.md files describing the exact JSON schema the LLM should output.

**Editing style adapts to content type:**
- Motivational (30-60s) → minimal editing, just ASD crop + captions + subtle background. The speaker's words ARE the content.
- Explainer/Knowledge → full Remotion power — infographics, graphs, maps, data tables, comparison views. When someone mentions "Modi" or "NVIDIA", scrapers fetch relevant images as overlays.
- Entertainment/Comedy → minimal overlays, focus on energy, text overlays for punchlines only.
- Emotional → very minimal editing, let the emotion breathe, maybe subtle text for key lines.

**Image sourcing for B-roll and overlays:**
- Pinterest scraper — downloads images from Pinterest search
- Google Images scraper — fetches images for mentioned entities (people, companies, products)
- Cloudflare asset library — I have a personal collection of hand-picked, curated images and assets stored on Cloudflare that I have selected personally. These are the best of the best for common use cases.
- Vision model filtering (planned) — use GPT-4V or similar to pick the best image from scraped results (right person, clean background, good quality)
- AI image generation (planned) — use Flux/SDXL when no good scrape exists
- Background removal for all scraped images before overlaying on video

---

### Step 7: Captions

I have built 17+ different caption style experiments (Caption_1 through Caption_17) plus TextBehindPerson effects and multiple Rmbg (background removal) experiments. The caption system is a work in progress — the plan is to have a pro LLM decide the caption style based on content type and mood. Currently experimental.

---

### Step 8: Rendering with Remotion + AWS Lambda

The final render uses Remotion's AWS Lambda integration:
- Rendering runs on AWS Lambda (serverless, pay-per-use)
- Multiple clips render CONCURRENTLY — Lambda scales horizontally
- Very fast render time
- Very cheap — the whole editing + rendering pipeline costs under ₹10 per clip
- NOT billed by video duration (the way OpusClip charges ₹900 for 200 minutes is absurd). Lambda bills by compute time.

---

## The Prompt Philosophy

The most important thing to understand about my approach is that I want the LLM to think like a HUMAN, not like a rule-following machine. A podcast video has thousands of possible moments and the LLM needs to feel the energy, understand the context, catch the quotes that hit different, notice when the speaker's voice drops to a whisper because they are about to say something devastating.

**What I want from the LLM:**
- Read the entire transcript like a human would watch the video
- Use its own judgment and intuition to identify moments that would make someone scrolling Instagram at 2 AM stop scrolling, feel something powerful, and save the reel
- Heatmap, comments, and audio signals are SUPPORTING evidence, not primary filters — transcript text quality is always the #1 signal
- A quiet one-liner spoken with calm conviction can be MORE viral than someone screaming generic motivation
- The first 2-3 seconds of a clip must hook the viewer (they decide to keep watching or swipe away), and the last few seconds must deliver a satisfying conclusion
- Every clip must be FULLY SELF-CONTAINED — a stranger on the internet watching only this 30-second clip with zero context about the full podcast should fully understand the message
- The LLM should have FULL FREEDOM to think — no rigid Phase 1/Phase 2 workflow, no constraining how it uses its scratchpad. The only constraint is on WHAT to output, not HOW to think.
- The 60 real viral examples and 30 anti-examples are TASTE CALIBRATION — like training a human editor's instinct. If a clip technically passes every rule but feels flat and generic in the LLM's gut — REJECT IT.
- Rough timestamps are fine (±5 seconds), downstream processing handles exact trimming
- A separate post-processing step removes filler words, so the LLM should NOT reject a high-potential clip just because it has some filler. Find the GOLD, not the dirt around it.

**What viral content actually feels like (examples):**
- "Reality is ki confidence success se nahi aata, confidence surviving failure se aata hai" — reframes confidence as surviving failure. The viewer who survived a bad phase feels this in their chest.
- "A man without money is a man without a voice. Even your family will disrespect you." — painful truth every broke person has experienced. The pain motivates the action.
- "You can't break a person who's not afraid to eat alone, who's not afraid to be rejected... they're fueled by something called self-love" — speaks to every lonely person. Each line adds weight.
- "Nikal pado, rasta apne aap banta hai" — just start, the path will appear. Perfect for overthinkers.
- "If you don't fail, you're not even trying. I'll say it again. If you don't fail, you're not even trying." — Denzel Washington. Repetition for emphasis.
- "Everybody want to know what I would do if I didn't win. I guess we'll never know." — Kanye. Ultimate confidence swagger.

Viral content is NOT generic "work hard be consistent" advice. It is a NEUROLOGICAL response — the specific rush when someone puts YOUR pain into words better than you ever could, when a metaphor clicks and your worldview shifts, when raw emotional energy transfers from the speaker through the screen.

---

## DeepSeek Pricing & Cost Strategy

DeepSeek V4 Flash pricing (insanely cheap):
- Input tokens (cache miss): $0.14 per million tokens
- Input tokens (cache hit): $0.014 per million tokens (10x cheaper when cached)
- Output tokens: $0.28 per million tokens
- Thinking tokens: same as output

For a full 3-hour podcast with ~150K tokens total, the entire analysis costs less than ₹1. That is basically free. And because of prompt caching, repeated runs on the same video (testing prompt changes, running different categories) drop the cached input cost to almost nothing.

**Cost philosophy:** DeepSeek being this cheap is a gift. It means I never have to compromise on quality to save costs. I can throw 150K input tokens, let the model think for 40K+ thinking tokens, and still pay less than ₹1. So the strategy is simple: pour EVERYTHING into clip selection quality. Make the prompt as detailed as humanly possible. Give the LLM every signal available (transcript, heatmap, comments, audio energy). Let it think as deeply as it wants. At ₹1 per video, cost is NOT the bottleneck — quality is.

---

## Optimization Principles

- Input tokens are basically free — the thinking/output tokens are where quality lives. Never sacrifice data quality to save input tokens.
- Every optimization should make the LLM spend MORE thinking on finding great clips and LESS thinking on mechanical work (arithmetic, format conversion, copy-pasting)
- Output format is simplified to essentials: rank, title, start_seconds, end_seconds, start_words (verification anchor), end_words, why_this_is_viral, category_hint, confidence — no transcript text in output, no computed fields, no verbose analysis
- All timestamps unified to raw seconds across the entire payload — the LLM never needs to do HH:MM:SS conversion math
- Tested with DeepSeek V4 Flash on a 3-hour Kunal Shah × Raj Shamani podcast: ₹0.95 total (149K tokens, 39.5K thinking tokens, 36.6K pure reasoning). The thinking block showed exactly the right behavior — scanning full transcript, cross-referencing comments and heatmap, debating clip boundaries, arguing against its own selections, checking for self-containment.

---

## The Competitive Mission

I am competing with MILLION DOLLAR companies. OpusClip, QuickReel, Klap — funded startups with massive engineering teams and big budgets. These tools are not just expensive, they are confusing and generic. There is no unique creative experience. You get 10 mediocre clips with basic subtitles and nothing that feels like a real, hand-crafted viral reel.

The ONLY way I beat them is by being better at the CORE function — finding the best clip. That is the entire game. If my clip selection is even 10% better than OpusClip's, I win, because clip quality is what makes or breaks a reel tool. Nobody cares about fancy UI or fast processing if the clips are mediocre.

That is why the prompt is so long (60 real viral examples, 30 anti-examples, 15 categories, detailed instructions). That is why I use Cognitive Priming Architecture ordering. That is why I give the LLM full freedom to think with max thinking tokens. The goal is NOT to save ₹0.50 per video. The goal is to get the ABSOLUTE BEST clip — the kind that a human curator with 10 years of experience would pick. The kind that makes you go "how the fuck did the AI find THIS moment in a 3-hour podcast?"

**The priority when working on this system is ALWAYS: does this change make the clip selection better?** Not "does this save 500 tokens" or "does this make it 2 seconds faster." The only question that matters is: will the LLM find a better clip because of this change? If yes, do it. If no, skip it.

---

## The Dream UI

The end goal is a chatbot-style web interface where:
1. User pastes a YouTube link
2. Optionally gives a note ("focus on failure moments" or "entertainment clips only")
3. System shows step-by-step progress UI — fetching transcript, analyzing audio, running LLM analysis — to keep user engaged
4. Clips show up organized by category (motivational, emotional, entertainment, audience favourite, general)
5. User picks clips they want as reels
6. Remotion-based editor shows a PREVIEW right in the browser (Remotion supports in-browser rendering)
7. User can make changes — swap caption style, remove overlays, change text, replace images — all through the UI
8. User hits render → final clip renders on AWS Lambda
9. User downloads or directly shares the reel

---

## Current Status (What Is Built vs Planned)

| Component | Status |
|---|---|
| Data fetching (transcript, metadata, comments, heatmap, audio) | ✅ Built |
| Local audio analysis (loudness, silence, WPM, YAMNet) | ✅ Built |
| Modal GPU analysis (PANNs CNN14, WhisperX) | ✅ Built |
| Payload builder (Cognitive Priming Architecture) | ✅ Built |
| PANNs tags integration into payload builder | 🔧 Partially done |
| 5 specialized clip-finding prompts | ✅ Built |
| Omni Bouncer (video validation gatekeeper) | ✅ Built |
| TalkNet-ASD (Active Speaker Detection on Modal) | ✅ Built |
| Remotion template library (50+ templates) | ✅ Built |
| Image scrapers (Pinterest, Google Images) | ✅ Built |
| Caption style experiments (17+ styles) | 🔧 Experimental |
| Cloudflare curated asset library | ✅ Built |
| LLM-driven editing decision system | 📋 Planned |
| Vision model image filtering | 📋 Planned |
| Chatbot UI | 📋 Planned |
| In-browser Remotion preview with edit controls | 📋 Planned |
| AWS Lambda render pipeline | 📋 Planned |
