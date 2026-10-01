# -*- coding: utf-8 -*-
"""
Offline self-test. No network, no GPU, no API keys, no cost.

Runs the whole local half of the pipeline against real data already on disk,
plus synthetic cases for the edge conditions real data does not happen to
contain.

    python selftest_wowclip.py
"""

import io
import json
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from wowclip import events, payload as P, report_html as RH, verify
from wowclip.audio_local import analyse, loudness_map
from wowclip.compose import compose
from wowclip.words import parse_json3, stats

PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  [{'ok  ' if cond else 'FAIL'}] {name}"
          + (f"   {detail}" if detail and not cond else ""))


def section(t):
    print(f"\n{t}\n" + "-" * 68)


def j3(blocks):
    """blocks = [(start_ms, [(word, offset_ms), ...])] -> json3 bytes"""
    return json.dumps({"events": [
        {"tStartMs": t, "dDurationMs": 3000,
         "segs": [{"utf8": (" " if i else "") + w, "tOffsetMs": o}
                  for i, (w, o) in enumerate(ws)]}
        for t, ws in blocks]}).encode()


def vad_of(p, silences=()):
    return {"speech_segments": [{"start_sec": w["t"], "end_sec": w["e"]}
                                for w in p["words"]],
            "significant_silences": list(silences)}


BASE = "/mnt/user-data/uploads/App/wowClip/Audio"
HAVE_REAL = os.path.isdir(BASE)


# ══════════════════════════════════════════════════════════════════════════
section("1. json3 parsing -> words + YouTube chunks")

raw = json.dumps({"events": [
    {"tStartMs": 1000, "dDurationMs": 2000,
     "segs": [{"utf8": "Hello"}, {"utf8": " world.", "tOffsetMs": 400}]},
    {"tStartMs": 1200, "aAppend": 1, "segs": [{"utf8": "Hello world."}]},
    {"tStartMs": 3000, "segs": [{"utf8": "\n"}]},
    {"tStartMs": 3500, "segs": [{"utf8": "Second"},
                                {"utf8": " line.", "tOffsetMs": 300}]},
    {"tStartMs": 1000, "segs": [{"utf8": "Hello"},
                                {"utf8": " world.", "tOffsetMs": 400}]},
    {"tStartMs": 5000, "segs": [{"utf8": "[Music]"}]},
]}).encode()
p = parse_json3(raw)
w, b = p["words"], p["blocks"]
check("aAppend rolling repeats dropped", len(w) == 4, f"{[x['w'] for x in w]}")
check("newline-only segments dropped", all(x["w"].strip() for x in w))
check("duplicate events dropped",
      [x["w"] for x in w] == ["Hello", "world.", "Second", "line."])
check("YouTube's own ASR tags stripped",
      not any("Music" in x["w"] for x in w), f"{[x['w'] for x in w]}")
check("chunks kept as YouTube emitted them", len(b) == 2, f"{b}")
check("chunk text is verbatim", b[0]["text"] == "Hello world.", b[0]["text"])
check("chunk knows its word range", b[0]["w0"] == 0 and b[0]["w1"] == 1)
check("every word knows its chunk", [x["b"] for x in w] == [0, 0, 1, 1])
check("word start times correct", w[1]["t"] == 1.4)
check("every word has an end", all(x["e"] > x["t"] for x in w))
check("a gap does not become a long word", w[1]["e"] - w[1]["t"] <= 1.25)
check("no sentence rebuilding happens",
      not os.path.exists(os.path.join(os.path.dirname(
          os.path.abspath(__file__)), "wowclip", "lines.py")))


# ══════════════════════════════════════════════════════════════════════════
section("2. exact tag placement")

# 2a -- a real hole INSIDE one chunk must split that chunk at the exact word
p1 = parse_json3(j3([
    (10000, [("So", 0), ("here", 200), ("is", 400), ("the", 600),
             ("question.", 800)]),
    (16000, [("Why", 0), ("are", 200), ("balloons", 400), ("so", 900),
             ("expensive?", 1200), ("Inflation.", 7000)]),
]))
r1 = compose(p1, audio_modal={
    "panns": {"all_events": [{"time": t, "event": "Laughter", "score": 0.85}
                             for t in range(19, 23)]},
    "vad": vad_of(p1)})
L = r1["body"].split("\n")
i = next((k for k, l in enumerate(L) if "laughter" in l), -1)
check("tag inside a chunk splits it", i > 0, r1["body"])
check("split lands between the exact two words",
      i > 0 and L[i - 1].endswith("expensive?") and L[i + 1].endswith("Inflation."),
      str(L))

# 2b -- spoken-through events are dropped, with a reason
p2 = parse_json3(j3([(10000, [(f"w{i}", i * 250) for i in range(40)])]))
r2 = compose(p2, audio_modal={
    "panns": {"all_events": [{"time": t, "event": "Laughter", "score": 0.8}
                             for t in range(12, 17)]},
    "vad": vad_of(p2)})
check("spoken-through event never reaches the transcript",
      "[[laughter" not in r2["body"], r2["body"][:200])
check("and it is logged with a reason", bool(r2["report"]["dropped"])
      and "spoken through" in r2["report"]["dropped"][0]["reason"],
      str(r2["report"]["dropped"]))

# 2c -- four PANNs classes on one reaction produce one tag
p3 = parse_json3(j3([(10000, [("One.", 0)]), (20000, [("Two.", 0)])]))
ev = ([{"time": t, "event": "Applause", "score": 0.9} for t in range(12, 18)] +
      [{"time": t, "event": "Clapping", "score": 0.8} for t in range(12, 18)] +
      [{"time": t, "event": "Cheering", "score": 0.7} for t in range(13, 17)] +
      [{"time": t, "event": "Crowd", "score": 0.65} for t in range(13, 17)])
r3 = compose(p3, audio_modal={"panns": {"all_events": ev}, "vad": vad_of(p3)})
check("four classes, one reaction, one tag", r3["body"].count("[[") == 1,
      r3["body"])

# 2d -- a pause lands between chunks, never inside a word run
p4 = parse_json3(j3([(10000, [("A", 0), ("b", 200), ("c", 400)]),
                     (20000, [("d", 0), ("e", 200)])]))
r4 = compose(p4, audio_modal={"panns": {"all_events": []}, "vad": vad_of(
    p4, [{"start_sec": 11.0, "end_sec": 19.5, "duration_sec": 8.5}])})
L4 = r4["body"].split("\n")
g = next((k for k, l in enumerate(L4) if "[[" in l), -1)
check("long silence becomes a gap tag", g > 0 and "gap" in L4[g], r4["body"])
check("gap sits exactly between the two chunks",
      g > 0 and L4[g - 1].endswith("c") and L4[g + 1].endswith("d e"), str(L4))

# 2e -- tags before the first word and after the last still render
p5 = parse_json3(j3([(30000, [("Hello.", 0)])]))
r5 = compose(p5, audio_modal={
    "panns": {"all_events":
              [{"time": t, "event": "Music", "score": 0.9} for t in range(0, 8)] +
              [{"time": t, "event": "Applause", "score": 0.9}
               for t in range(33, 38)]},
    "vad": vad_of(p5)})
check("event before the first word renders", r5["body"].startswith("[0] [[music"),
      r5["body"])
check("event after the last word renders", "applause" in r5["body"].split("\n")[-1],
      r5["body"])

# 2f -- misaligned audio disables tagging entirely
p6 = parse_json3(j3([(10000, [(f"w{i}", i * 300) for i in range(20)])]))
r6 = compose(p6, audio_modal={
    "panns": {"all_events": [{"time": t, "event": "Applause", "score": 0.9}
                             for t in range(12, 18)]},
    "vad": {"speech_segments": [{"start_sec": 900 + i, "end_sec": 900.5 + i}
                                for i in range(20)],
            "significant_silences": []}})
check("misaligned audio is caught", any("AUDIO IGNORED" in x
                                        for x in r6["report"]["warnings"]),
      str(r6["report"].get("warnings")))
check("and no tags are emitted from it", "[[" not in r6["body"])


# ══════════════════════════════════════════════════════════════════════════
section("3. event filtering")

def e(t, name, score):
    return {"time": t, "event": name, "score": score}


noise = [e(5, "Sonar", 0.41), e(5, "Whale vocalization", 0.25),
         e(6, "Ratchet, pawl", 0.88), e(7, "Inside, small room", 0.65),
         e(8, "Speech", 0.92), e(9, "Narration, monologue", 0.71)]
blocks, st = events.build_event_blocks(noise)
check("off-allowlist classes never survive", blocks == [], str(blocks))
check("even a 0.88 Ratchet is dropped", st["not_allowlisted"] == 6)
check("a lone weak second is a false positive",
      events.build_event_blocks([e(50, "Laughter", 0.31)])[0] == [])
check("a lone STRONG second survives",
      len(events.build_event_blocks([e(50, "Laughter", 0.75)])[0]) == 1)
check("two consecutive weak seconds survive",
      len(events.build_event_blocks(
          [e(50, "Laughter", 0.34), e(51, "Laughter", 0.36)])[0]) == 1)
check("events far apart stay separate",
      len(events.build_event_blocks(
          [e(10, "Laughter", .5), e(11, "Laughter", .5),
           e(40, "Laughter", .5), e(41, "Laughter", .5)])[0]) == 2)

vad = {"significant_silences": [
    {"start_sec": 10.0, "end_sec": 12.5, "duration_sec": 2.5},
    {"start_sec": 30.0, "end_sec": 60.0, "duration_sec": 30.0},
    {"start_sec": 80.0, "end_sec": 80.9, "duration_sec": 0.9}]}
ps = events.build_pauses(vad)
check("sub-threshold silence ignored", len(ps) == 2, str(ps))
check("2.5s is a pause", ps[0]["family"] == "pause")
check("30s is a gap, not drama", ps[1]["family"] == "gap")


# ══════════════════════════════════════════════════════════════════════════
section("4. the real TEDx sample, end to end")

result = None
if HAVE_REAL:
    src = json.load(open(f"{BASE}/1aA1WGON49E_word_level_transcript.json",
                         encoding="utf-8"))
    evs = []
    for blk in src["blocks"]:
        t0 = blk["block_start_ms"]
        evs.append({"tStartMs": t0, "dDurationMs": blk["duration_ms"],
                    "segs": [{"utf8": x["raw_utf8"],
                              "tOffsetMs": x["start_ms"] - t0}
                             for x in blk["words"]]})
    parsed = parse_json3(json.dumps({"events": evs}).encode())
    modal = json.load(open(f"{BASE}/audio_analysis_report.json", encoding="utf-8"))
    mp3 = next((f for f in os.listdir(BASE)
                if f.endswith(".mp3") and "1aA1WGON49E" in f), None)
    loud = loudness_map(analyse(os.path.join(BASE, mp3))) if mp3 else None

    result = compose(parsed, audio_modal=modal, loudness=loud, duration_s=80.8)
    body, rep = result["body"], result["report"]

    check("audio judged aligned", rep["alignment"]["ok"], str(rep["alignment"]))
    check("YouTube chunks preserved 1:1",
          rep["line_stats"]["youtube_chunks"] == len(parsed["blocks"]) == 27,
          str(rep["line_stats"]))
    check("intro music tagged first", body.startswith("[0] [[music"))
    check("opening applause tagged", "[[applause" in body.split("\n")[1])
    check("the comedy beat survives", "[[pause 1.7s]]" in body, body[-300:])
    check("beat sits between setup and punchline",
          body.index("[[pause") > body.index("balloons")
          and body.index("[[pause") < body.index("Inflation"))
    check("no submarine", not any(x in body.lower()
                                  for x in ("sonar", "whale", "ratchet")))
    check("no wrapping or closing tags", "[/" not in body and "((" not in body)
    check("dB markers stay sparse",
          rep["baselines"]["lines_with_db_marker"] < len(parsed["blocks"]) / 2,
          str(rep["baselines"]))
    check("no WPM anywhere -- it was noise", "wpm" not in body.lower())
    check("every tag line is a tag and nothing else",
          all(l.split("] ", 1)[1].startswith("[[") ==
              l.split("] ", 1)[1].endswith("]]")
              for l in body.split("\n") if "[[" in l), body)
else:
    print("  (real sample data not mounted -- skipped)")


# ══════════════════════════════════════════════════════════════════════════
section("5. comments, heatmap, payload")

check("H:MM:SS converts", P.convert_timestamps("look at 1:18:28 wow")
      == "look at [4708s] wow")
check("M:SS converts", P.convert_timestamps("at 57:58 he says")
      == "at [3478s] he says")
check("clock times untouched", "3:30 PM" in P.convert_timestamps("meet at 3:30 PM"))
check("Devanagari marks preserved",
      "कुशलता" in P.clean_comment("Efficiency → कुशलता 🔥"),
      P.clean_comment("Efficiency → कुशलता 🔥"))

cs = [{"likes": 500, "text": "great episode overall really enjoyed"},
      {"likes": 3, "text": "1:18:28 this part destroyed me completely"}]
body_c, n = P.format_comments(cs)
check("timestamp comments float to the top",
      body_c.split("\n")[0].startswith("3 |"), body_c)

hb, npk = P.format_heatmap(
    [{"start": 100, "value": 0.9}, {"start": 200, "value": 0.2}],
    [{"t": 95, "text": "this is what he said at the peak moment"}])
check("low-attention points dropped", npk == 1, hb)
check("peaks carry their words", "this is what he said" in hb, hb)

PROMPT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                      "prompts", "motivational.md")
if os.path.exists(PROMPT) and result:
    secs = P.load_prompt_sections(PROMPT)
    check("all prompt sections present",
          all(x in secs for x in P.REQUIRED_SECTIONS), str(list(secs)))
    text, stats_p = P.build(PROMPT, result["text"], meta={"title": "T"},
                            comments=cs, heatmap=None,
                            lines=result["blocks"], duration_s=81)
    check("payload builds", len(text) > 50_000, str(len(text)))
    check("grounding precedes the transcript",
          text.index("EVERYTHING ABOVE THIS LINE WAS CALIBRATION")
          < text.index("=== FULL TRANSCRIPT ==="))
    check("output format is read last",
          text.index("WHAT TO RETURN") > text.index("=== FULL TRANSCRIPT ==="))
    check("60 examples intact", text.count("\nEXAMPLE ") >= 59)
    check("30 anti-examples intact", text.count("\nANTI-EXAMPLE ") >= 29)
    check("boundary rules are in the prompt",
          "WHERE THE CLIP STARTS" in text and "WHERE THE CLIP ENDS" in text)
    check("the worked start_words example is present",
          "Misunderstanding" in text and '"start_words": "working on a big vision"'
          in text)
    check("the model is told nothing overrides it",
          "nothing\ndownstream second-guesses them" in text)
    check("no stale absolute-dB legend", "Vol(dB)" not in text)
    check("no mandated audit workflow",
          "DEVIL'S ADVOCATE" not in text and "Step 5 —" not in text)


# ══════════════════════════════════════════════════════════════════════════
section("6. clip pass-through -- nothing may be modified")

if result:
    blocks = result["blocks"]
    clip = {"rank": 1, "title": "t", "start_seconds": 4870,
            "end_seconds": 4926, "start_words": "What does it mean",
            "end_words": "people at parties", "confidence": "HIGH"}
    out = verify.attach_context(clip, blocks)
    for k in ("start_seconds", "end_seconds", "start_words", "end_words"):
        check(f"{k} passed through untouched", out[k] == clip[k],
              f"{out[k]!r} vs {clip[k]!r}")
    check("input dict not mutated", "transcript" not in clip)
    check("duration is derived, not imposed", out["duration"] == 56.0,
          str(out["duration"]))

    # A wildly wrong timestamp must NOT be corrected or rejected.
    bad = dict(clip, start_seconds=99999, start_words="the quantum blockchain")
    ob = verify.attach_context(bad, blocks)
    check("a wrong timestamp is left exactly as the model wrote it",
          ob["start_seconds"] == 99999, str(ob["start_seconds"]))
    check("invented words are not rejected either",
          ob["start_words"] == "the quantum blockchain")
    check("context is still shown so you can see it is wrong",
          "transcript" in ob)

    rev = dict(clip, start_seconds=4926, end_seconds=4870)
    orv = verify.attach_context(rev, blocks)
    check("reversed order is not silently swapped",
          orv["start_seconds"] == 4926 and orv["end_seconds"] == 4870)
    check("garbage input does not crash",
          verify.attach_context({"start_seconds": "x"}, blocks)["duration"] is None)
    check("empty clip list is fine", verify.attach_all([], blocks) == [])
    check("no repair/reject machinery remains",
          not hasattr(verify, "resolve_all") and not hasattr(verify, "_locate"))


# ══════════════════════════════════════════════════════════════════════════
section("7. finder wiring")

from wowclip import finder
from wowclip.config import LLM_MODEL, LLM_REASONING_EFFORT, LLM_URL

check("routed through OpenRouter", "openrouter.ai" in LLM_URL, LLM_URL)
check("model is the benchmarked 0731 build",
      LLM_MODEL == "deepseek/deepseek-v4-flash-0731", LLM_MODEL)
check("max reasoning effort", LLM_REASONING_EFFORT == "xhigh")
check("plain JSON parses", finder.extract_json('{"clips":[]}')[0] == {"clips": []})
check("fenced JSON parses",
      finder.extract_json('```json\n{"clips":[1]}\n```')[0] == {"clips": [1]})
check("JSON in prose parses",
      finder.extract_json('Sure!\n{"clips":[2]}\nHope that helps.')[0]
      == {"clips": [2]})
check("empty response handled", finder.extract_json("")[0] is None)

c = finder.cost({"prompt_tokens": 91340, "completion_tokens": 41208,
                 "completion_tokens_details": {"reasoning_tokens": 38470},
                 "total_tokens": 132548, "cost": 0.0119})
check("billed cost is preferred over the price table", c["source"] == "billed")
check("cost converted to rupees", 0.9 < c["inr"] < 1.2, str(c["inr"]))
check("thinking split out of output",
      c["thinking_tokens"] == 38470 and c["answer_tokens"] == 2738)
check("estimate is labelled when no billed figure",
      finder.cost({"prompt_tokens": 1000,
                   "completion_tokens": 100})["source"] == "estimated")


# ══════════════════════════════════════════════════════════════════════════
section("8. HTML report")

check("hms formats hours", RH.hms(4869) == "1:21:09", RH.hms(4869))
check("hms survives garbage", RH.hms(None) == "-")
sw = RH._parse_sweep(["0-600 | intro, sponsor -- nothing",
                      "600-1200 | strong line at 900", "no range here"], 10832)
check("sweep range parsed", sw[0]["start"] == 0 and sw[0]["end"] == 600)
check("unparseable sweep line still shown", sw[2]["start"] is None and sw[2]["text"])
check("empty block detected", RH._looks_empty(sw[0]["text"]))

demo = {"video_id": "abc12345678", "title": "T & <script>", "duration_s": 600,
        "usage": {"inr": 1.05, "usd": .0119, "source": "billed",
                  "thinking_tokens": 100, "output_tokens": 200,
                  "input_tokens": 900, "total_tokens": 1100},
        "sweep": ["0-300 | nothing", "300-600 | good line at 420"],
        "clips": [{"rank": 1, "title": "ok", "start_seconds": 420,
                   "end_seconds": 450, "duration": 30, "confidence": "HIGH",
                   "start_words": "let me tell you", "end_words": "that is it",
                   "why": "w", "transcript": "t"}],
        "near_misses": [{"start_seconds": 200, "end_seconds": 230, "why_not": "n"}],
        "payload": {}, "transcript": {}, "reasoning": "thought", "error": ""}
h = RH.render(demo)
check("report renders", len(h) > 3000)
check("html escaped, not injected", "&lt;script&gt;" in h)
check("word anchors shown as first-class content",
      "let me tell you" in h and "IN " in h and "OUT " in h)
check("raw model timestamps shown", "[420]" in h and "[450]" in h)
check("no verification badges anywhere",
      "FAILED VERIFICATION" not in h and "verified" not in h)
check("youtube deep link uses the model's own start", "?t=420" in h)
check("cost source is stated", "billed by the provider" in h)
check("light and dark both defined",
      "prefers-color-scheme:dark" in h and '[data-theme="dark"]' in h)
check("no external resources", "http://" not in h.replace("https://youtu.be", ""))
check("zero clips renders",
      "No clips returned" in RH.render({"video_id": "x", "duration_s": 0,
                                        "usage": {"inr": 0}, "clips": [],
                                        "payload": {}, "transcript": {}}))
check("a failed run still reports",
      "429" in RH.render({"video_id": "x", "duration_s": 0, "usage": {"inr": 0},
                          "clips": [], "payload": {}, "transcript": {},
                          "error": "HTTP 429: rate limited"}))


# ══════════════════════════════════════════════════════════════════════════
section("9. cache")

from wowclip.cache import Cache

with tempfile.TemporaryDirectory() as tmp:
    c = Cache("TESTVIDEO01", root=tmp)
    check("nothing cached initially", not c.has("words"))
    c.write_json("words", {"words": [], "blocks": []})
    check("derived artifact cached", c.has("words"))
    c.write_text("transcript", "x")
    check("build artifacts are never cached", not c.has("transcript"))
    c.set_refresh(["words"])
    check("--refresh invalidates that stage", not c.has("words"))
    c.set_refresh([])
    check("and only that stage", c.has("words"))
    c.set_refresh(["all"])
    check("--refresh all invalidates everything", not c.has("words"))
    c.set_refresh([])
    man = json.load(open(c.manifest_path, encoding="utf-8"))
    check("manifest records artifacts", "words" in man["artifacts"])
    check("manifest has a checksum",
          len(man["artifacts"]["words"]["sha256_16"]) == 16)


# ══════════════════════════════════════════════════════════════════════════
print("\n" + "=" * 68)
print(f"  {len(PASS)} passed, {len(FAIL)} failed")
for f in FAIL:
    print(f"    FAILED: {f}")
print("=" * 68)
sys.exit(1 if FAIL else 0)
