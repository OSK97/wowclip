# Performance & Cost Breakdown: Motivational Run (Video ID: `4Vz6L8B73i4`)

> **Video:** *Neuroscientist's Guide To 10X Your Focus & Memory | Dr Sahar Yousef | FO559 Raj Shamani*  
> **Duration:** 10,506s (~2h 55m) | **Category:** `motivational` | **Output:** 4 Approved Short-Form Clips

---

## 1. Executive Summary

| Pipeline Stage | Duration | % of Time | Total Cost (₹) | % of Cost | Key Activity |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Stage 1: Gatekeeper & Pre-Flight** | **53.80s** | 10.9% | **₹0.8084** | 11.9% | Captions, comments sample, validation & potential score |
| **Stage 2: Clip Finding (Motivational)** | **439.62s** | 89.1% | **₹6.0081** | 88.1% | Full comment mining, payload, LLM finder, select & audio-exact cut |
| **Grand Total** | **493.42s (~8m 13s)** | **100.0%** | **₹6.8165 (~₹6.82)** | **100.0%** | **4 ready-to-render clips** |

---

## 2. Complete Hierarchical Breakdown (Time & Cost)

The table below groups operations by **Stage → Phase → Step**, detailing execution method, duration, and cost.

| Hierarchy & Step | Operation / Sub-step | Execution Mode | Time (s) | Cost (₹ INR) | Key Metrics / Data Points |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. STAGE 1: GATEKEEPER** | **Pre-flight & Viability Check** | **Mixed** | **53.80s** | **₹0.8084** | **Score: 92/100 (APPROVED)** |
| ├─ 1.1 Ingestion (Parallel) | Subtitles & Replay Data | External (Proxy) | 43.18s | ₹0.4617 | 5.34 MB bandwidth @ $0.90/GB; 30,001 word timings |
| │ | Initial Comment Sampling | External (API) | 43.60s *(concurrent)* | ₹0.0000 | 300 comments read, 200 kept; 3 YouTube API units |
| ├─ 1.2 Metric Calculation | Local Transcript Diagnostics | Local CPU | 0.76s | ₹0.0000 | 4,892 lines, 31,842 words, 99% speech coverage |
| └─ 1.3 Viability Judgment | Gatekeeper Model (Omni-Bouncer)| LLM Call | 9.84s | ₹0.3467 | 85,874 tokens (`inception/mercury-2.5`) |
| | | | | | |
| **2. STAGE 2: CLIP PIPELINE** | **Finding & Precise Audio Cutting**| **Sequential / LLM** | **439.62s** | **₹6.0081** | **5 found → 5 selected → 4 cut** |
| ├─ 2.1 Disk Cache Read | Reuse Saved Transcript | Local Disk I/O | 0.10s | ₹0.0000 | 30,001 word timings loaded; ₹0 re-download proxy cost |
| ├─ 2.2 Deep Comment Analysis| Full Reaction & Timestamps | External + LLM | 45.62s | ₹3.2486 | 1,000 comments scanned, 108 timestamps, 10 YouTube units |
| ├─ 2.3 Payload Assembly | Context & Line Mapping | Local CPU | 1.16s | ₹0.0000 | 1,301 lines split at pauses, 106 pinned comments |
| ├─ 2.4 Category Finder | Motivational Deep Read | LLM Call (Think) | 226.52s | ₹1.4714 | 67,400 prompt + 10,435 comp + 8,374 reasoning tokens (1 call) |
| ├─ 2.5 Moment Selection | De-duplication & Curation | LLM Call | 25.52s | ₹0.0967 | 3,827 prompt + 867 comp + 542 reasoning tokens (1 call) |
| └─ 2.6 Exact Word Cutting | Syllable & Boundary Align | LLM Calls (5x) | 140.64s | ₹1.1914 | 22,784 prompt + 18,032 comp + 16,701 reasoning tokens (5 calls) |

*(Note: Step 1.1 captions and comments ran concurrently in ~43.6s total elapsed wall time).*

---

## 3. Cost Distribution Analysis

### Where the Money Went (Total: ₹6.82)

```
[████████████████████████░░░░░░░░░░░░░░░░] Stage 2 Comments Analysis: ₹3.25 (47.7%)
[███████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] Stage 2 Finder (Motivational): ₹1.47 (21.6%)
[█████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] Stage 2 Word Boundary Cut: ₹1.19 (17.5%)
[███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] Stage 1 GProxy Bandwidth: ₹0.46 (6.8%)
[██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] Stage 1 Gatekeeper Model: ₹0.35 (5.1%)
[█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] Stage 2 Selection: ₹0.10 (1.4%)
```

| Expense Item | Provider / Service | Units Consumed | Cost (₹ INR) | % of Total Spend |
| :--- | :--- | :--- | :--- | :--- |
| **Deep Comments Analysis** | OpenRouter LLM + YouTube API | 1,000 comments / 1 call | ₹3.2486 | 47.7% |
| **Motivational Finder** | GLM-5.3-Flash (High Effort) | 86,209 tokens (inc. 8,374 reasoning) | ₹1.4714 | 21.6% |
| **Exact Word Cutting** | GLM-5.3-Flash (High Effort) | 57,517 tokens across 5 clips | ₹1.1914 | 17.5% |
| **GProxy Bandwidth** | Residential Proxy (`yt-dlp`) | 5.34 MB bandwidth ($0.90/GB) | ₹0.4617 | 6.8% |
| **Gatekeeper Model** | Inception Mercury-2.5 | 85,874 tokens | ₹0.3467 | 5.1% |
| **Moment Selection** | GLM-5.3-Flash | 5,236 tokens | ₹0.0967 | 1.4% |
| **YouTube Data API** | Google Cloud | 13 quota units (3 + 10) | ₹0.0000 | 0.0% (Free tier) |
| **Total** | | | **₹6.8165** | **100.0%** |

---

## 4. Time Distribution & Bottlenecks

### Where the Time Went (Total: 493.4s / 8m 13s)

```
[███████████████████░░░░░░░░░░░░░░░░░░░░░] Motivational Finder: 226.5s (45.9%)
[████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░] Exact Word Cutting: 140.6s (28.5%)
[████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] Deep Comments Processing: 45.6s (9.2%)
[████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] Captions & Replay Ingestion: 43.2s (8.8%)
[██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] Moment Selection: 25.5s (5.2%)
[█░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] Gatekeeper LLM Judgment: 9.8s (2.0%)
[░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] Local Payload & CPU Metrics: 2.0s (0.4%)
```

* **Primary Bottleneck:** The **Motivational Finder** (226.5s / ~3.8 min) is the heaviest step because it analyzes 96.9% of a 2h 55m transcript with 8,374 reasoning tokens.
* **Secondary Bottleneck:** **Exact Word Cutting** (140.6s / ~2.3 min) because it runs 5 distinct refinement calls on candidate segments to locate precise audio word boundaries.

---

## 5. Output Clips Delivered

The run evaluated 5 candidate moments and produced **4 broadcast-ready clips** cut down to exact spoken words:

| # | Clip Title | Timestamp Range | Duration | Cut Boundaries (Audio Seconds) | Viewer Evidence |
| :---: | :--- | :---: | :---: | :---: | :--- |
| **1** | *"You have to tell your brain to shut up"* | 13:07 – 14:08 | **61.4s** | 787.00s → 848.40s | 7 viewer comments point to 13:12 |
| **2** | *"A brick wall to you is a door to them"* | 10:43 – 11:33 | **50.1s** | 643.04s → 693.10s | Top comment (30 likes) at 11:09 |
| **3** | *"Be bored and do nothing — and you get ideas"*| 1:18:42 – 1:19:21 | **38.4s** | 4722.80s → 4761.20s | Identified from cold-open reference |
| **4** | *"From my most powerless moment..."* | 2:48:43 – 2:49:12 | **29.1s** | 10123.44s → 10152.49s| Closing personal transformation arc |

*Total short-form content extracted:* **179.0s (~3 minutes) across 4 high-retention clips.**
