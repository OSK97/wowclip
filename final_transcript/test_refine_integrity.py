"""Regression checks for preserving and labeling model-selected moments."""

import unittest
from unittest.mock import patch

import refine_clips


class CutIntegrityTests(unittest.TestCase):
    def setUp(self):
        tokens = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot",
                  "golf", "hotel", "india", "juliet"]
        self.words = [
            {"word": token, "t": token, "start": float(i),
             "end": float(i) + 0.7}
            for i, token in enumerate(tokens)
        ]
        self.rows = [{"id": "L0001", "kind": "line", "start": 0.0,
                      "end": 10.0, "text": " ".join(tokens), "seconds": 10.0}]
        self.group = {
            "start_s": 0.0, "end_s": 10.0, "cut_for": "emotional",
            "members": [{"category": "emotional", "title": "A moment",
                         "why": "It lands", "confidence": "HIGH",
                         "duration_s": 10.0, "start_line": "L0001",
                         "end_line": "L0001"}],
        }

    def test_bad_cut_response_keeps_candidate_for_review(self):
        with patch.object(refine_clips, "call", return_value=("{broken", "", {})):
            result = refine_clips.refine_one(
                self.group, self.rows, self.words, "prompt", "key", "model", "high")
        self.assertEqual(result["clip"]["cut_status"], "needs_review")
        self.assertEqual(result["clip"]["title"], "A moment")
        self.assertGreater(result["clip"]["duration_s"], 0)

    def test_salvaged_segment_is_visible_but_needs_review(self):
        malformed = ('{"keep":true,"segments":[{"start_line":"L0001",'
                     '"start_words":"alpha","end_line":"L0001",'
                     '"end_words":"foxtrot"}],"title":"Recovered","broken":}')
        with patch.object(refine_clips, "call", return_value=(malformed, "", {})):
            result = refine_clips.refine_one(
                self.group, self.rows, self.words, "prompt", "key", "model", "high")
        self.assertTrue(result["salvaged"])
        self.assertEqual(result["clip"]["cut_status"], "needs_review")
        self.assertEqual(result["clip"]["segments"][0]["end_words"], "foxtrot")

    def test_extra_segments_are_not_silently_truncated(self):
        pairs = [("alpha", "bravo"), ("charlie", "delta"),
                 ("echo", "foxtrot"), ("golf", "hotel")]
        raw = {"segments": [
            {"start_line": "L0001", "start_words": start,
             "end_line": "L0001", "end_words": end}
            for start, end in pairs
        ]}
        clip, error = refine_clips.build_clip(
            raw, self.group, self.rows, self.words, {"L0001": 0}, 0, 10)
        self.assertIsNone(error)
        self.assertEqual(len(clip["segments"]), 4)
        self.assertEqual(clip["cut_status"], "needs_review")

    def test_danda_is_punctuation_for_word_matching(self):
        self.assertEqual(refine_clips.toks("आए।"), ["आए"])

    def build_pause_clip(self, keep_pause, gap=1.4, event_text="[pause 1.4s]"):
        for word in self.words[6:]:
            word["start"] += gap - 0.3
            word["end"] += gap - 0.3
        if event_text:
            self.rows.append({"id": "L0002", "kind": "event", "start": 5.7,
                              "end": 5.7 + gap, "text": event_text})
        raw = {"segments": [{"start_line": "L0001", "start_words": "alpha",
                             "end_line": "L0001", "end_words": "foxtrot",
                             "keep_end_pause": keep_pause}]}
        clip, error = refine_clips.build_clip(
            raw, self.group, self.rows, self.words,
            {row["id"]: i for i, row in enumerate(self.rows)}, 0, 20)
        self.assertIsNone(error)
        return clip

    def test_requested_measured_pause_preserved_without_next_words(self):
        clip = self.build_pause_clip(True)
        self.assertAlmostEqual(clip["end_s"], 7.1)
        self.assertAlmostEqual(clip["segments"][0]["end_pause_s"], 1.4)
        self.assertNotIn("golf", clip["transcript"])
        output = refine_clips.finalise([clip], self.rows, 100, "test")
        self.assertAlmostEqual(output[0]["source_end_s"], 107.1)

    def test_ending_pause_is_optional(self):
        clip = self.build_pause_clip(False)
        self.assertAlmostEqual(clip["end_s"], 5.95)
        self.assertEqual(clip["segments"][0]["end_pause_s"], 0)

    def test_long_ending_pause_is_capped(self):
        clip = self.build_pause_clip(True, gap=8, event_text="[long gap 8.0s]")
        self.assertAlmostEqual(clip["end_s"], 7.7)
        self.assertAlmostEqual(clip["segments"][0]["end_pause_s"], 2)

    def test_pause_request_without_measurement_does_not_invent_silence(self):
        clip = self.build_pause_clip(True, event_text=None)
        self.assertAlmostEqual(clip["end_s"], 5.95)

    def test_sound_tag_is_not_a_measured_pause(self):
        clip = self.build_pause_clip(True, event_text="[applause (youtube)]")
        self.assertAlmostEqual(clip["end_s"], 5.95)

    def test_pause_cannot_cross_the_next_spoken_word(self):
        rows = [{"kind": "event", "start": 5.7, "end": 8.0,
                 "text": "[pause 2.3s]"}]
        self.assertAlmostEqual(
            refine_clips.ending_pause_end(self.words, 6, rows, 20), 6.0)

    def test_pause_cannot_extend_beyond_the_supplied_window(self):
        self.build_pause_clip(True)
        self.assertAlmostEqual(
            refine_clips.ending_pause_end(self.words, 6, self.rows, 6.4), 6.4)


if __name__ == "__main__":
    unittest.main()
