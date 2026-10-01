# WowClip — Automated Video Moment Extractor & Clipping Engine

WowClip transforms long YouTube videos into viral, short-form clips (Shorts / Reels / TikTok) using multi-stage AI reasoning, speech-to-text alignment, and audience signal analysis.

## Repository Architecture

The repository is organized into self-contained, cooperative modules:

```text
├── app/                   # Next.js 16 UI and API route endpoints
│   ├── api/process/       # Stage 1: Ingestion & Gate verdict (SSE stream)
│   ├── api/clips/         # Stage 2: Parallel finders & clip cutting (SSE stream)
│   ├── api/validate/      # Instant YouTube URL validation & metadata lookup
│   └── components/        # Decision card, verdict card, report card, clip results
├── pipeline/              # Ingestion pipeline & orchestration
│   ├── run.py             # Stage 1 entrypoint (transcript, replay heatmap, bouncer)
│   ├── clips.py           # Stage 2 entrypoint (parallel category finders & cut)
│   ├── bridge.py          # Bridge to final_transcript engine
│   ├── bouncer.py         # Technical & speech feasibility gate
│   └── config.py          # Unified credentials & network configurations
├── final_transcript/      # Core clip-finding & refining engine
│   ├── prompts/           # Specialized category prompts & cut instructions
│   │   ├── _common.md
│   │   ├── audience.md
│   │   ├── emotional.md
│   │   ├── entertainment.md
│   │   ├── general.md
│   │   ├── motivational.md
│   │   ├── refine_cut.md
│   │   └── refine_select.md
│   ├── build_payload.py   # Script formatting with pace tags & comment markers
│   ├── find_clips.py      # Category-specific prompt runner
│   ├── refine_clips.py    # Word-level boundary alignment & deduplication
│   └── llm.py             # OpenRouter client with throughput routing & retries
├── wowClip/               # API keys & supporting tools
│   ├── api_keys.json      # Pre-configured service credentials
│   └── omni_bouncer.py    # Model evaluation tests & prompts
├── .env.local             # Local environment configuration
└── package.json           # Dependencies and scripts
```

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Python Environment Requirements
Ensure Python 3.10+ is available on your PATH:
```bash
pip install yt-dlp requests
```

### 3. API Keys Configuration
Credentials are automatically read from `.env.local` or `wowClip/api_keys.json`:
- `OPENROUTER_API_KEY`: Model inferences
- `YOUTUBE_API_KEY`: Video metadata & comments
- `GPROXY_*`: Residential proxy for rapid caption & heatmap downloads

### 4. Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
