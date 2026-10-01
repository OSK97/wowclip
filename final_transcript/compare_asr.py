# -*- coding: utf-8 -*-
"""
Empirical Comparison: YouTube Native ASR vs Faster-Whisper Large-v3-Turbo
"""
import json
import os
import re
import difflib

HERE = os.path.dirname(os.path.abspath(__file__))
YT_JSON = os.path.join(HERE, "out", "Jim Rohn_ Why Not You, Why Not Now_360p_0s-509s_final.json")
TURBO_JSON = os.path.join(HERE, "out", "Jim Rohn_ Why Not You, Why Not Now_360p_0s-509s_turbo_words.json")

def normalize(w):
    return re.sub(r"[^\w]", "", w).lower()

def compare():
    if not os.path.exists(YT_JSON):
        print(f"Error: {YT_JSON} not found")
        return
    if not os.path.exists(TURBO_JSON):
        print(f"Error: {TURBO_JSON} not found")
        return

    with open(YT_JSON, "r", encoding="utf-8") as f:
        yt_data = json.load(f)
    with open(TURBO_JSON, "r", encoding="utf-8") as f:
        turbo_data = json.load(f)

    yt_words = [w for w in yt_data.get("words", []) if w.get("kind") != "tag"]
    
    # turbo words can be in turbo_data['words'] (format: {'w': word, 't': start, 'e': end})
    turbo_words_raw = turbo_data.get("words", [])
    turbo_words = []
    for w in turbo_words_raw:
        turbo_words.append({
            "word": w.get("w") or w.get("word", ""),
            "start": float(w.get("t") if "t" in w else w.get("start", 0)),
            "end": float(w.get("e") if "e" in w else w.get("end", 0))
        })

    print("=" * 75)
    print("  COMPARISON: YOUTUBE NATIVE ASR vs FASTER-WHISPER LARGE-V3-TURBO")
    print("=" * 75)
    print(f"Audio Duration:                {turbo_data.get('duration_audio_s', yt_data.get('meta', {}).get('length_s')):.1f}s (~8.3 mins)")
    print(f"Total Words (YouTube ASR):     {len(yt_words):,}")
    print(f"Total Words (Whisper Turbo):   {len(turbo_words):,}")
    
    # Text similarity comparison
    yt_text_norm = [normalize(w["word"]) for w in yt_words if normalize(w["word"])]
    turbo_text_norm = [normalize(w["word"]) for w in turbo_words if normalize(w["word"])]
    
    matcher = difflib.SequenceMatcher(None, yt_text_norm, turbo_text_norm)
    similarity = matcher.ratio()
    print(f"Vocabulary / Word Match:       {similarity * 100:.2f}% identical word sequence")

    # Timestamp Alignment Precision on Exact Word Matches
    time_diffs_start = []
    time_diffs_end = []
    matches = []

    matching_blocks = matcher.get_matching_blocks()
    for block in matching_blocks:
        for i in range(block.size):
            yt_w = yt_words[block.a + i]
            tb_w = turbo_words[block.b + i]
            diff_s = yt_w["start"] - tb_w["start"]
            diff_e = yt_w["end"] - tb_w["end"]
            time_diffs_start.append(abs(diff_s))
            time_diffs_end.append(abs(diff_e))
            matches.append((yt_w, tb_w, diff_s))

    if time_diffs_start:
        avg_diff_s = sum(time_diffs_start) / len(time_diffs_start)
        med_diff_s = sorted(time_diffs_start)[len(time_diffs_start) // 2]
        max_diff_s = max(time_diffs_start)
        within_100ms = sum(1 for d in time_diffs_start if d <= 0.10) / len(time_diffs_start) * 100
        within_250ms = sum(1 for d in time_diffs_start if d <= 0.25) / len(time_diffs_start) * 100
        within_500ms = sum(1 for d in time_diffs_start if d <= 0.50) / len(time_diffs_start) * 100

        print("\n" + "-" * 75)
        print("  TIMESTAMP PRECISION & TIMING OFFSET (YT ASR vs Whisper Turbo)")
        print("-" * 75)
        print(f"Mean Absolute Start Offset:    {avg_diff_s * 1000:.1f} ms ({avg_diff_s:.3f} seconds)")
        print(f"Median Start Offset:           {med_diff_s * 1000:.1f} ms ({med_diff_s:.3f} seconds)")
        print(f"Words within ±100ms:           {within_100ms:.1f}%")
        print(f"Words within ±250ms:           {within_250ms:.1f}%")
        print(f"Words within ±500ms:           {within_500ms:.1f}%")
        print(f"Max Drift / Outlier Offset:    {max_diff_s:.3f}s")

    print("\n" + "-" * 75)
    print("  SIDE-BY-SIDE TIMESTAMP SAMPLES ACROSS THE SPEECH")
    print("-" * 75)
    sample_indices = [0, len(matches)//4, len(matches)//2, 3*len(matches)//4, len(matches)-1]
    for idx in sample_indices:
        if idx < len(matches):
            yw, tw, delta = matches[idx]
            print(f"Word: '{yw['word']}'")
            print(f"  YouTube ASR:    [{yw['start']:.3f}s -> {yw['end']:.3f}s]")
            print(f"  Whisper Turbo:  [{tw['start']:.3f}s -> {tw['end']:.3f}s]")
            print(f"  Delta (Offset): {delta * 1000:+.1f} ms")
            print()

if __name__ == "__main__":
    compare()
