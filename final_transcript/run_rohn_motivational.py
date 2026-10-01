# -*- coding: utf-8 -*-
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

BASE = "Jim Rohn_ Why Not You, Why Not Now_360p_0s-509s"
OUT_DIR = os.path.join(HERE, "out")
FINAL_JSON = os.path.join(OUT_DIR, f"{BASE}_final.json")
COMMENTS_JSON = os.path.join(OUT_DIR, "Q7bPssMKxYI_comments.json")
METADATA_JSON = os.path.join(OUT_DIR, "Q7bPssMKxYI_metadata.json")

PAYLOAD_TXT = os.path.join(OUT_DIR, f"{BASE}_payload.txt")
STEP1_JSON = os.path.join(OUT_DIR, f"{BASE}_step1.json")
CLIPS_JSON = os.path.join(OUT_DIR, f"{BASE}_clips.json")

MODEL = "z-ai/glm-5.3-flash"
USD_INR = 96.0

def run_step(cmd, step_name):
    print("\n" + "=" * 80, flush=True)
    print(f"  [RUNNING] {step_name}", flush=True)
    print(f"  Command: {' '.join(cmd)}", flush=True)
    print("=" * 80 + "\n", flush=True)
    t0 = time.time()
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8", errors="replace")
    for line in p.stdout:
        sys.stdout.write(line)
        sys.stdout.flush()
    p.wait()
    dt = time.time() - t0
    if p.returncode != 0:
        print(f"\n[ERROR] {step_name} failed with return code {p.returncode}", flush=True)
        sys.exit(p.returncode)
    print(f"\n[COMPLETED] {step_name} in {dt:.2f}s", flush=True)
    return dt

def main():
    print("=" * 80, flush=True)
    print("  JIM ROHN: WHY NOT YOU, WHY NOT NOW (8.3 MIN) - MOTIVATIONAL ONLY", flush=True)
    print(f"  File Base: {BASE} | Model: {MODEL}", flush=True)
    print("=" * 80, flush=True)

    # 1. Fresh Payload Build (Exact placement, no cache)
    cmd_payload = [
        sys.executable, os.path.join(HERE, "build_payload.py"),
        "--transcript", FINAL_JSON,
        "--outdir", OUT_DIR
    ]
    if os.path.exists(COMMENTS_JSON):
        cmd_payload += ["--comments-json", COMMENTS_JSON]
    if os.path.exists(METADATA_JSON):
        cmd_payload += ["--metadata-json", METADATA_JSON]

    t_pay = run_step(cmd_payload, "STEP 1: REBUILDING FRESH PAYLOAD")

    # 2. Motivational Finder Only
    cmd_finder = [
        sys.executable, os.path.join(HERE, "find_clips.py"),
        "--payload", PAYLOAD_TXT,
        "--model", MODEL,
        "--only", "motivational",
        "--effort", "medium"
    ]
    t_find = run_step(cmd_finder, "STEP 2: MOTIVATIONAL FINDER (GLM-5.3-FLASH)")

    # 3. Refine Stage
    cmd_refine = [
        sys.executable, os.path.join(HERE, "refine_clips.py"),
        "--step1", STEP1_JSON,
        "--model", MODEL,
        "--effort", "high"
    ]
    t_ref = run_step(cmd_refine, "STEP 3: REFINING BOUNDARIES (GLM-5.3-FLASH)")

    # 4. Load Results
    with open(STEP1_JSON, "r", encoding="utf-8") as f:
        s1 = json.load(f)
    with open(CLIPS_JSON, "r", encoding="utf-8") as f:
        final = json.load(f)
    with open(FINAL_JSON, "r", encoding="utf-8") as f:
        words_data = json.load(f).get("words", [])

    cost_finders = float((s1.get("meta") or {}).get("cost_usd") or 0)
    cost_refine = float((final.get("meta") or {}).get("cost_usd") or 0)
    tot_usd = cost_finders + cost_refine
    tot_inr = tot_usd * USD_INR

    print("\n" + "=" * 80, flush=True)
    print("  OPENROUTER COST & TIMING BREAKDOWN", flush=True)
    print("=" * 80, flush=True)
    print(f"Model:                         {MODEL}", flush=True)
    print(f"Payload Build Time:            {t_pay:.2f}s", flush=True)
    print(f"Motivational Finder Time:      {t_find:.2f}s  (Cost: ${cost_finders:.5f} / Rs {cost_finders * USD_INR:.3f})", flush=True)
    print(f"Refine Stage Time:             {t_ref:.2f}s  (Cost: ${cost_refine:.5f} / Rs {cost_refine * USD_INR:.3f})", flush=True)
    print(f"TOTAL TIME:                    {t_pay + t_find + t_ref:.2f}s", flush=True)
    print(f"TOTAL OPENROUTER COST (USD):   ${tot_usd:.5f}", flush=True)
    print(f"TOTAL OPENROUTER COST (INR):   Rs {tot_inr:.3f} ({tot_inr * 100:.1f} paise)", flush=True)

    clips = final.get("clips", [])
    print("\n" + "=" * 80, flush=True)
    print(f"  MOTIVATIONAL REFINED CLIPS ({len(clips)} CLIPS FOUND)", flush=True)
    print("=" * 80, flush=True)

    def get_verbatim(start_s, end_s):
        clip_words = [w["word"] for w in words_data if start_s <= w["start"] and w["end"] <= end_s + 0.5 and w.get("kind") != "tag"]
        return " ".join(clip_words)

    for c in clips:
        st = c["source_start_s"]
        en = c["source_end_s"]
        dur = c["duration_s"]
        verbatim = get_verbatim(st, en)
        print(f"\n--------------------------------------------------------------------------------", flush=True)
        print(f"  RANK #{c.get('rank')}: \"{c.get('title')}\"", flush=True)
        print(f"  Category:     MOTIVATIONAL | Confidence: {c.get('confidence')}", flush=True)
        print(f"  Timecode:     {int(st)//60}:{int(st)%60:02d} -> {int(en)//60}:{int(en)%60:02d} ({dur:.1f}s)", flush=True)
        print(f"  Start Words:  \"{c.get('start_words')}\"", flush=True)
        print(f"  End Words:    \"{c.get('end_words')}\"", flush=True)
        print(f"  Why it hits:  {c.get('why')}", flush=True)
        print(f"\n  [VERBATIM TRANSCRIPT]:", flush=True)
        print(f"  \"{verbatim}\"", flush=True)

if __name__ == "__main__":
    main()
