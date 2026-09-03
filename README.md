# WowClip — project overview

WowClip is a tool that takes one long video and automatically turns it into a handful of short, ready-to-post clips — the same idea behind OpusClip, Klap and Submagic. It's being built as a two-person cloud computing project, to learn how a real "AI + cloud" product like this actually works end to end.

## The problem

Creators record long videos — podcasts, lectures, interviews, webinars — but most viewers today discover and watch short ones, on Instagram Reels, YouTube Shorts, and TikTok. Turning one long recording into a handful of good short clips means sitting through the whole thing, spotting the three or four moments actually worth sharing, then cutting, captioning, and resizing each one by hand. That easily eats up hours for every single upload.

WowClip removes the manual part. You upload one video, and it hands you back a set of short, captioned, ready-to-post clips on its own.

## How it works, step by step

1. **Upload** — you give WowClip one long video file (say, a 30–60 minute recording).
2. **Listen** — the system converts the spoken audio into text, so it has something it can actually "read."
3. **Pick & cut** — an AI model reads that text and picks out the 3–5 most interesting or quotable moments, along with their exact timestamps. The video is then cut at those timestamps.
4. **Caption & resize** — each short clip gets captions added on screen and gets resized to fit a phone screen (vertical, 9:16).
5. **Deliver** — the finished clips show up on a dashboard, ready to download or post.

## How the cloud is used (high level)

The reason this needs "the cloud" rather than just running on someone's laptop is simple: video files are large, and cutting/processing them takes real time and real computing power — more than a browser tab should have to sit and wait for. So the work is split across a few cloud building blocks, each doing one job well:

```
User uploads a video
        │
        ▼
  Storage  ──────────────  a safe locker where the raw video and finished
                            clips are kept (e.g. AWS S3)
        │
        ▼
  Quick trigger  ────────  a small serverless function that "wakes up" the
                            moment a video lands in storage, and starts
                            the job (e.g. AWS Lambda)
        │
        ▼
  Job queue  ─────────────  a waiting line for work, so if 5 people upload
                            videos at once, they get processed one after
                            another instead of overwhelming the system
                            (e.g. AWS SQS)
        │
        ▼
  Worker / processing server ─ the "heavy lifter": transcribes the audio,
                            calls an AI model to find the best moments,
                            cuts the video, and burns in captions
                            (e.g. an EC2 instance or a container — this
                            step is too slow and memory-heavy for a
                            serverless function alone)
        │
        ▼
  AI service  ─────────────  borrowed intelligence — an existing
                            speech-to-text service plus an existing AI
                            language model, used to understand the video
                            and pick the good parts. We don't train our
                            own AI from scratch.
        │
        ▼
  Database  ───────────────  keeps track of every video, its clips, their
                            timestamps, and their status ("processing",
                            "done"), (e.g. DynamoDB or PostgreSQL)
        │
        ▼
  Dashboard  ───────────────  the webpage where the user sees progress
                            and downloads the finished clips
```

**Why split the work like this, instead of doing it all in one place?**

- **Nobody has to wait around.** Upload happens fast, and the actual processing runs quietly in the background — the user gets notified once it's ready instead of staring at a spinner.
- **It only costs money when it's actually working.** The small trigger functions and the queue barely cost anything when idle — you're not paying for a server to sit there doing nothing between uploads.
- **It can handle more than one video at a time.** If several people upload videos together, the queue lines the jobs up instead of the whole system crashing or slowing to a crawl.
- **Each piece can be swapped or improved on its own.** For example, the AI model used to "pick the best moments" could later be replaced with a better one, without touching the storage or the dashboard at all.

## What's next

1. Get a video in and safely stored, and confirm the upload flow works end to end.
2. Get the AI part working: turn speech into text, then get an AI model to pick good moments.
3. Actually cut the video at those moments and add basic captions.
4. Build the dashboard where people track progress and download their clips.

## Team

A two-person cloud computing project, inspired by OpusClip, Klap and Submagic.
