# -*- coding: utf-8 -*-
import json
import os
import sys
import time
import urllib.parse
import urllib.request
import concurrent.futures

HERE = os.path.dirname(os.path.abspath(__file__))
KEYS_PATH = os.path.join(HERE, "..", "wowClip", "api_keys.json")

with open(KEYS_PATH, encoding="utf-8") as f:
    keys = json.load(f)

YT_KEY = keys["YOUTUBE_API_KEY"]
OR_KEY = keys["OPENROUTER_API_KEY"]
MODEL = "inception/mercury-2.5-preview"
USD_INR = 96.0

VID = "S-5YKTvAi6s"

# Import comment components
sys.path.insert(0, HERE)
import comments as C
import llm

def chat_mercury(messages, key, model=MODEL):
    body = {
        "model": model,
        "messages": messages,
        "temperature": 0.0,
        "max_tokens": 4000
    }
    t0 = time.perf_counter()
    req = urllib.request.Request(
        llm.URL,
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json"
        }
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        d = json.loads(r.read().decode("utf-8", errors="replace"))
    dt = time.perf_counter() - t0
    usage = d.get("usage", {})
    cost = float(usage.get("cost") or 0)
    return d["choices"][0]["message"]["content"], usage, cost, dt

def map_batches_mercury(items, batch_size, build, parse, key, model=MODEL):
    batches = [items[i:i + batch_size] for i in range(0, len(items), batch_size)]
    out = []
    tot_cost = 0.0
    tot_prompt_tokens = 0
    tot_compl_tokens = 0
    batch_timings = []

    def one(b, b_idx):
        txt, usage, cost, dt = chat_mercury(build(b), key, model=model)
        parsed = parse(txt, b)
        return parsed, usage, cost, dt, b_idx

    t_start = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as ex:
        futs = [ex.submit(one, b, idx) for idx, b in enumerate(batches)]
        for f in concurrent.futures.as_completed(futs):
            res, usage, cost, dt, b_idx = f.result()
            if res:
                out.extend(res)
            tot_cost += cost
            tot_prompt_tokens += usage.get("prompt_tokens", 0)
            tot_compl_tokens += usage.get("completion_tokens", 0)
            batch_timings.append((b_idx, dt, cost, usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0)))
    total_wall = time.perf_counter() - t_start

    stats = {
        "batches": len(batches),
        "cost_usd": tot_cost,
        "prompt_tokens": tot_prompt_tokens,
        "completion_tokens": tot_compl_tokens,
        "wall_time_s": total_wall,
        "batch_timings": batch_timings
    }
    return out, stats

def main():
    print("=" * 80)
    print(f"  BENCHMARK: COMMENT FETCH & TRIAGE ON '{MODEL}'")
    print(f"  Video ID: {VID} (https://youtu.be/{VID})")
    print("=" * 80)

    t_all_start = time.perf_counter()
    timings = {}

    # 1. YouTube API Fetch
    print("\n[STEP 1] Fetching raw comments from YouTube Data API v3...")
    t0 = time.perf_counter()
    raw, pages = C.fetch(VID, YT_KEY, target=1000, log=print)
    t_fetch = time.perf_counter() - t0
    timings["1. YouTube API Fetch (1000 comments)"] = t_fetch
    print(f"-> Fetched {len(raw)} comments across {pages} pages in {t_fetch:.2f}s")

    # 2. Python Regex Split
    print("\n[STEP 2] Running Python regex parsing and filtering...")
    t0 = time.perf_counter()
    ts_raw, long_ts, gen_raw, pre_dropped, indexes = C.split(raw, None)
    t_split = time.perf_counter() - t0
    timings["2. Python Regex Split & Parse"] = t_split
    print(f"-> Split: {len(ts_raw)} timestamped, {len(long_ts)} long timestamped, {len(gen_raw)} general, {pre_dropped} pre-dropped junk in {t_split*1000:.2f}ms")

    ts = list(ts_raw)
    shorten_cost = 0.0
    shorten_p_tok = 0
    shorten_c_tok = 0
    t_shorten = 0.0

    # 3. LLM Shorten (if any)
    if long_ts:
        print(f"\n[STEP 3] Summarizing {len(long_ts)} long timestamped comments with {MODEL}...")
        t0 = time.perf_counter()
        def build_s(batch):
            lines = "\n".join(f'{c["id"]}: {c["text"][:1200]}' for c in batch)
            return [{"role": "system", "content": C.SUMMARY_SYS}, {"role": "user", "content": lines}]
        def parse_s(txt, batch):
            d = llm.parse_json(txt) or {}
            return [(c["id"], str(d.get(str(c["id"])) or "").strip()) for c in batch if d.get(str(c["id"]))]
        got_pairs, sstats = map_batches_mercury(long_ts, 20, build_s, parse_s, OR_KEY, model=MODEL)
        got = dict(got_pairs)
        for c in long_ts:
            if c["id"] in got:
                c["summary"] = got[c["id"]]
                ts.append(c)
        t_shorten = time.perf_counter() - t0
        shorten_cost = sstats["cost_usd"]
        shorten_p_tok = sstats["prompt_tokens"]
        shorten_c_tok = sstats["completion_tokens"]
        print(f"-> Shortened {len(got)}/{len(long_ts)} comments in {t_shorten:.2f}s (Cost: ${shorten_cost:.5f})")
    timings["3. LLM Shorten (Long Timestamps)"] = t_shorten

    # 4. LLM Triage (General Comments)
    by_likes = sorted(gen_raw, key=lambda c: -c["likes"])
    spared = by_likes[:C.ALWAYS_KEEP_TOP_LIKED]
    judged = by_likes[C.ALWAYS_KEEP_TOP_LIKED:]

    print(f"\n[STEP 4] Running LLM Triage on {len(judged)} general comments ({len(spared)} top-liked spared)...")
    print(f"-> Splitting into batches of {C.TRIAGE_BATCH} (model={MODEL})...")
    
    def build_t(batch):
        lines = "\n".join(f'{c["id"]}: {c["text"][:C.MAX_TEXT]}' for c in batch)
        return [{"role": "system", "content": C.TRIAGE_SYS}, {"role": "user", "content": lines}]
    def parse_t(txt, batch):
        ids = llm.parse_json(txt, default=None)
        if isinstance(ids, dict):
            ids = ids.get("keep") or ids.get("ids")
        if not isinstance(ids, list):
            return []
        ok = {c["id"] for c in batch}
        return [i for i in ids if isinstance(i, int) and i in ok]

    t0 = time.perf_counter()
    keep_ids, tstats = map_batches_mercury(judged, C.TRIAGE_BATCH, build_t, parse_t, OR_KEY, model=MODEL)
    t_triage = time.perf_counter() - t0
    timings["4. LLM Triage (Parallel Batches)"] = t_triage

    keep = set(keep_ids)
    good = [c for c in judged if c["id"] in keep]
    gen = sorted(spared + good, key=lambda c: -c["likes"])
    print(f"-> Triage completed in {t_triage:.2f}s ({tstats['batches']} batches in parallel)")
    print(f"-> Kept: {len(good)}/{len(judged)} judged comments (Cost: ${tstats['cost_usd']:.5f})")

    # 5. LLM Themes
    print(f"\n[STEP 5] Generating High-Level Themes over top {len(gen[:300])} comments...")
    t0 = time.perf_counter()
    top_gen = sorted(gen, key=lambda c: -c["likes"])[:300]
    body = "\n".join(f'- ({c["likes"]} likes) {c["text"][:C.MAX_TEXT]}' for c in top_gen)
    themes_txt, themes_usage, themes_cost, dt_themes = chat_mercury(
        [{"role": "system", "content": C.THEME_SYS}, {"role": "user", "content": body}],
        OR_KEY,
        model=MODEL
    )
    th = llm.parse_json(themes_txt, default={}) or {}
    t_themes = time.perf_counter() - t0
    timings["5. LLM Themes & Mood Summary"] = t_themes
    print(f"-> Themes generated in {t_themes:.2f}s (Cost: ${themes_cost:.5f})")

    t_total = time.perf_counter() - t_all_start

    # Cost calculation
    total_cost_usd = shorten_cost + tstats["cost_usd"] + themes_cost
    total_cost_inr = total_cost_usd * USD_INR

    total_prompt_tokens = shorten_p_tok + tstats["prompt_tokens"] + themes_usage.get("prompt_tokens", 0)
    total_compl_tokens = shorten_c_tok + tstats["completion_tokens"] + themes_usage.get("completion_tokens", 0)
    total_tokens = total_prompt_tokens + total_compl_tokens

    print("\n" + "=" * 80)
    print("  COMPLETE EXECUTION TIMING & BOTTLENECK REPORT")
    print("=" * 80)
    print(f"{'Phase / Step':<42} {'Time (s)':>10} {'% of Run':>10} {'Cost (USD)':>12} {'Cost (INR)':>12}")
    print("-" * 88)
    for name, dur in timings.items():
        step_cost_usd = 0.0
        if "Triage" in name:
            step_cost_usd = tstats["cost_usd"]
        elif "Themes" in name:
            step_cost_usd = themes_cost
        elif "Shorten" in name:
            step_cost_usd = shorten_cost
        
        step_cost_inr = step_cost_usd * USD_INR
        pct = (dur / t_total) * 100
        print(f"{name:<42} {dur:>9.2f}s {pct:>9.1f}% {('$%.5f' % step_cost_usd):>12} {('Rs %.3f' % step_cost_inr):>12}")
    print("-" * 88)
    print(f"{'TOTAL RUN':<42} {t_total:>9.2f}s {'100.0%':>10} {('$%.5f' % total_cost_usd):>12} {('Rs %.3f' % total_cost_inr):>12}")

    print("\n" + "=" * 80)
    print("  TOKEN & COST METRICS")
    print("=" * 80)
    print(f"Model Used:             {MODEL}")
    print(f"Total Batches Processed:{tstats['batches']} triage + 1 themes")
    print(f"Total Prompt Tokens:    {total_prompt_tokens:,}")
    print(f"Total Completion Tokens:{total_compl_tokens:,}")
    print(f"Total Tokens:           {total_tokens:,}")
    print(f"Total Cost in USD:      ${total_cost_usd:.5f}")
    print(f"Total Cost in INR (Rs): Rs {total_cost_inr:.3f} (approx. {total_cost_inr*100:.1f} paise)")

    print("\n" + "=" * 80)
    print("  AUDIENCE THEMES EXTRACTED")
    print("=" * 80)
    print(f"Mood: {th.get('mood')}")
    for item in th.get("themes", []):
        print(f"  - {item.get('what')} ({item.get('n')} mentions)")

if __name__ == "__main__":
    main()
