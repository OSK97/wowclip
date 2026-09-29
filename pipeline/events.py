"""NDJSON progress events.

Every line printed to stdout is one JSON object. The Next.js route handler
reads these line by line and forwards them to the browser as Server-Sent
Events, which is what drives the live progress UI.

Anything that is not a progress event (yt-dlp noise, warnings) must go to
stderr so it never corrupts the stream.
"""

import json
import sys
import time

_START = time.time()


def _emit(payload: dict) -> None:
    payload["at"] = round(time.time() - _START, 2)
    sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def step_start(step: str, label: str) -> None:
    """A unit of work began. Steps running at the same time share a group."""
    _emit({"type": "step_start", "step": step, "label": label})


def step_done(step: str, label: str, detail: str = "", data=None) -> None:
    _emit(
        {
            "type": "step_done",
            "step": step,
            "label": label,
            "detail": detail,
            "data": data,
        }
    )


def step_fail(step: str, label: str, detail: str = "") -> None:
    _emit({"type": "step_fail", "step": step, "label": label, "detail": detail})


def step_skip(step: str, label: str, detail: str = "") -> None:
    _emit({"type": "step_skip", "step": step, "label": label, "detail": detail})


def note(message: str) -> None:
    """Free-form line for the log feed."""
    _emit({"type": "note", "message": message})


def verdict(payload: dict) -> None:
    _emit({"type": "verdict", **payload})


def report(payload: dict) -> None:
    """Final cost and timing breakdown."""
    _emit({"type": "report", **payload})


def clips(payload: dict) -> None:
    """The finished clips, ranked and ready to show."""
    _emit({"type": "clips", **payload})


def fatal(message: str) -> None:
    """Pipeline cannot continue."""
    _emit({"type": "fatal", "message": message})


def done(summary: dict) -> None:
    _emit({"type": "done", **summary})


def log(message: str) -> None:
    """Diagnostics for the terminal only — never parsed by the UI."""
    sys.stderr.write(message + "\n")
    sys.stderr.flush()
