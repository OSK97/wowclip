"""Provider/stream regressions: reasoning remains inspectable without retry storms."""

import io
import json
import unittest
import urllib.error
from unittest.mock import patch

import find_clips
import llm
import refine_clips


class ProviderTests(unittest.TestCase):
    def test_glm_uses_current_throughput_order_with_supported_parameters(self):
        provider = llm.provider_block(find_clips.MODEL)
        self.assertEqual(provider["sort"], "throughput")
        self.assertTrue(provider["allow_fallbacks"])
        self.assertTrue(provider["require_parameters"])
        self.assertNotIn("order", provider)
        self.assertNotIn("max_price", provider)

    def test_both_editor_passes_request_medium_and_visible_reasoning(self):
        for module in (find_clips, refine_clips):
            with self.subTest(module=module.__name__):
                with patch.object(llm, "post_stream", return_value=('{}', 'thinking', {})) as post:
                    module.call([], "test-key", module.MODEL, "medium")
                body = post.call_args.args[0]
                self.assertEqual(body["reasoning"], {"effort": "medium", "exclude": False})
                self.assertNotIn("reasoning_effort", body)
                self.assertNotIn("include_reasoning", body)
                self.assertEqual(body["max_tokens"], 64000)

    def test_permanent_http_failure_is_not_retried(self):
        for module in (find_clips, refine_clips):
            with self.subTest(module=module.__name__):
                error = urllib.error.HTTPError(llm.URL, 403, "Forbidden", {}, None)
                with patch.object(llm, "post_stream", side_effect=error) as post:
                    with patch.object(module.time, "sleep") as sleep:
                        with self.assertRaises(urllib.error.HTTPError):
                            module.call([], "test-key", module.MODEL, "medium")
                self.assertEqual(post.call_count, 1)
                sleep.assert_not_called()

    def test_transport_failure_does_not_restart_larger_budget_ladder(self):
        for module in (find_clips, refine_clips):
            with self.subTest(module=module.__name__):
                with patch.object(llm, "post_stream", side_effect=TimeoutError("offline")) as post:
                    with patch.object(module.time, "sleep"):
                        with self.assertRaises(RuntimeError):
                            module.call([], "test-key", module.MODEL, "medium")
                self.assertEqual(post.call_count, module.RETRIES)
                self.assertEqual({c.args[0]["max_tokens"] for c in post.call_args_list}, {64000})

    def test_empty_medium_answer_does_not_repeat_identical_budget_plan(self):
        for module in (find_clips, refine_clips):
            with self.subTest(module=module.__name__):
                with patch.object(llm, "post_stream", return_value=("", "thinking", {
                    "reasoning_tokens": 64000, "finish_reason": "length"})) as post:
                    with self.assertRaises(RuntimeError):
                        module.call([], "test-key", module.MODEL, "medium")
                self.assertEqual([c.args[0]["max_tokens"] for c in post.call_args_list], [64000, 128000])


class StreamTests(unittest.TestCase):
    def response(self, both_fields=False):
        delta = {"reasoning_details": [{"type": "reasoning.text", "text": "read the speech"}]}
        if both_fields:
            delta["reasoning"] = "read the speech"
        chunks = [
            {"id": "gen-test", "provider": "test-provider", "choices": [{"delta": delta}]},
            {"choices": [{"delta": {"content": '{"ok":true}'}, "finish_reason": "stop"}]},
            {"usage": {"completion_tokens": 8, "completion_tokens_details": {"reasoning_tokens": 5}}},
        ]
        data = ": processing\n" + "".join("data: " + json.dumps(c) + "\n\n" for c in chunks)
        return io.BytesIO((data + "data: [DONE]\n").encode())

    def test_details_only_reasoning_and_generation_metrics_are_saved(self):
        with patch.object(llm.urllib.request, "urlopen", return_value=self.response()):
            content, thinking, usage = llm.post_stream({}, "test-key")
        self.assertEqual(json.loads(content), {"ok": True})
        self.assertEqual(thinking, "read the speech")
        self.assertEqual(usage["generation_id"], "gen-test")
        self.assertEqual(usage["provider"], "test-provider")
        self.assertEqual(usage["finish_reason"], "stop")
        self.assertEqual(usage["reasoning_tokens"], 5)
        self.assertLessEqual(usage["stream_metrics"]["first_token_s"], usage["stream_metrics"]["first_content_s"])

    def test_reasoning_is_not_duplicated_when_both_formats_arrive(self):
        with patch.object(llm.urllib.request, "urlopen", return_value=self.response(True)):
            _, thinking, _ = llm.post_stream({}, "test-key")
        self.assertEqual(thinking, "read the speech")

    def test_http_error_message_keeps_status_for_retry_decision(self):
        error = urllib.error.HTTPError(llm.URL, 403, "Forbidden", {},
                                       io.BytesIO(b'{"error":{"message":"Key limit exceeded"}}'))
        with patch.object(llm.urllib.request, "urlopen", side_effect=error):
            with self.assertRaises(urllib.error.HTTPError) as caught:
                llm.post_stream({}, "test-key")
        self.assertEqual(caught.exception.code, 403)
        self.assertIn("Key limit exceeded", str(caught.exception))

    def test_streamed_permanent_error_is_not_misread_as_budget_exhaustion(self):
        response = io.BytesIO(b'data: {"error":{"code":403,"message":"Key limit exceeded"}}\n')
        with patch.object(llm.urllib.request, "urlopen", return_value=response) as post:
            with self.assertRaises(llm.StreamError) as caught:
                find_clips.call([], "test-key", find_clips.MODEL, "medium")
        self.assertEqual(caught.exception.code, 403)
        self.assertEqual(post.call_count, 1)


if __name__ == "__main__":
    unittest.main()
