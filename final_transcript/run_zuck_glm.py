# -*- coding: utf-8 -*-
import json
import os
import re
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import llm

VID = "BmYv8XGl-YU"
OUT_DIR = os.path.join(HERE, "out")
FINAL_JSON = os.path.join(OUT_DIR, f"{VID}_final.json")
COMMENTS_JSON = os.path.join(OUT_DIR, f"{VID}_comments.json")
HEATMAP_JSON = os.path.join(OUT_DIR, f"{VID}_heatmap.json")
METADATA_JSON = os.path.join(OUT_DIR, f"{VID}_metadata.json")

PAYLOAD_TXT = os.path.join(OUT_DIR, f"{VID}_payload.txt")
PAYLOAD_JSON = os.path.join(OUT_DIR, f"{VID}_payload.json")
STEP1_JSON = os.path.join(OUT_DIR, f"{VID}_step1.json")
CLIPS_JSON = os.path.join(OUT_DIR, f"{VID}_clips.json")

MODEL = "z-ai/glm-5.3-flash"
USD_INR = 96.0

def run_cmd(cmd, step_name):
    print(f"\n{'=' * 80}")
    print(f"  [RUNNING] {step_name}")
    print(f"  Command: {' '.join(cmd)}")
    print(f"{'=' * 80}")
    t0 = time.time()
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    dt = time.time() - t0
    if p.stdout:
        print(p.stdout)
    if p.stderr:
        print(p.stderr, file=sys.stderr)
    if p.returncode != 0:
        print(f"[ERROR] {step_name} failed with return code {p.returncode}")
        sys.exit(p.returncode)
    print(f"  [COMPLETED] {step_name} in {dt:.2f}s")
    return dt

def main():
    print("=" * 80)
    print("  END-TO-END RUN: MARK ZUCKERBERG HARVARD COMMENCEMENT")
    print(f"  Video ID: {VID} | Model: {MODEL}")
    print("=" * 80)

    # 1. Fresh Payload Build (NO CACHE - using updated exact timestamp logic)
    cmd_payload = [
        sys.executable, os.path.join(HERE, "build_payload.py"),
        "--transcript", FINAL_JSON,
        "--outdir", OUT_DIR
    ]
    if os.path.exists(COMMENTS_JSON):
        cmd_payload += ["--comments-json", COMMENTS_JSON]
    if os.path.exists(HEATMAP_JSON):
        cmd_payload += ["--heatmap-json", HEATMAP_JSON]
    if os.path.exists(METADATA_JSON):
        cmd_payload += ["--metadata-json", METADATA_JSON]

    t_payload = run_cmd(cmd_payload, "STEP 1: FRESH PAYLOAD ASSEMBLY")

    # 2. Candidate Finders (find_clips.py with z-ai/glm-5.3-flash)
    cmd_finders = [
        sys.executable, os.path.join(HERE, "find_clips.py"),
        "--payload", PAYLOAD_TXT,
        "--model", MODEL,
        "--effort", "medium"
    ]
    t_finders = run_cmd(cmd_finders, "STEP 2: CANDIDATE FINDERS (5 CATEGORIES)")

    # 3. Boundary Refinement & Deduplication (refine_clips.py with z-ai/glm-5.3-flash)
    cmd_refine = [
        sys.executable, os.path.join(HERE, "refine_clips.py"),
        "--step1", STEP1_JSON,
        "--model", MODEL,
        "--effort", "high"
    ]
    t_refine = run_cmd(cmd_refine, "STEP 3: BOUNDARY REFINEMENT & DEDUPLICATION")

    # 4. Load Results & Exact Costs
    with open(STEP1_JSON, "r", encoding="utf-8") as f:
        s1 = json.load(f)
    with open(CLIPS_JSON, "r", encoding="utf-8") as f:
        final = json.load(f)
    with open(FINAL_JSON, "r", encoding="utf-8") as f:
        words_data = json.load(f).get("words", [])

    cost_finders = float((s1.get("meta") or {}).get("cost_usd") or 0)
    cost_refine = float((final.get("meta") or {}).get("cost_usd") or 0)
    total_cost_usd = cost_finders + cost_refine
    total_cost_inr = total_cost_usd * USD_INR

    print("\n" + "=" * 80)
    print("  EXACT OPENROUTER COST SUMMARY")
    print("=" * 80)
    print(f"Model Used:                   {MODEL}")
    print(f"Stage 1 (Finders) Cost:       ${cost_finders:.5f}  (Rs {cost_finders * USD_INR:.3f})")
    print(f"Stage 2 (Refine) Cost:        ${cost_refine:.5f}  (Rs {cost_refine * USD_INR:.3f})")
    print(f"TOTAL OPENROUTER BILLED:      ${total_cost_usd:.5f} USD")
    print(f"TOTAL IN INDIAN RUPEES:       Rs {total_cost_inr:.2f} ({total_cost_inr * 100:.1f} paise)")

    print("\n" + "=" * 80)
    print(f"  FINAL REFINED CLIPS ({len(final.get('clips', []))} CLIPS FOUND)")
    print("=" * 80)

    def get_verbatim(start_s, end_s):
        clip_words = [w["word"] for w in words_data if start_s <= w["start"] and w["end"] <= end_s + 0.5 and w.get("kind") != "tag"]
        return " ".join(clip_words)

    for c in final.get("clips", []):
        st = c["source_start_s"]
        en = c["source_end_s"]
        dur = c["duration_s"]
        verbatim = get_verbatim(st, en)
        print(f"\n--------------------------------------------------------------------------------")
        print(f"  RANK #{c.get('rank')}: \"{c.get('title')}\"")
        print(f"  Category:   {c.get('category').upper()} | Confidence: {c.get('confidence')}")
        print(f"  Timecode:   {int(st)//60}:{int(st)%60:02d} -> {int(en)//60}:{int(en)%60:02d} ({dur:.1f}s)")
        print(f"  Cut Words:  Start: \"{c.get('start_words')}\" | End: \"{c.get('end_words')}\"")
        print(f"  Why:        {c.get('why')}")
        print(f"\n  [VERBATIM TRANSCRIPT]:")
        print(f"  \"{verbatim}\"")

if __name__ == "__main__":
    main()
