"""Access to the clip-finding modules that live outside this folder.

Stage 2 (payload -> finders -> refine) is not reimplemented here. It already
exists, tested and tuned, in the sibling `final_transcript` project, and the
prompts in there are the product. Copying that code into the website would
create two versions of the same thing that drift apart, which has already
happened once in this repo between `Youtube_Link` and `final_transcript`.

So this module does one job: find that project, put it on the import path, and
hand back its modules. It is the only place in the website that knows where
those files are, which means moving them later is a one-line change.

Keys are the one thing not reused. `final_transcript/llm.py` reads them from a
JSON file at `../wowClip/api_keys.json`, an absolute-ish path outside the
project that will not exist in a container. Every function the website calls
takes its key as an argument, so the website passes what it read from the
environment and never touches that file.
"""

import os
import sys

# Where final_transcript sits. Check within repository first, then sibling workspace folder.
_CANDIDATE_LOCAL = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "final_transcript")
)
_CANDIDATE_PARENT = os.path.normpath(
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "final_transcript")
)
_DEFAULT = _CANDIDATE_LOCAL if os.path.isdir(_CANDIDATE_LOCAL) else _CANDIDATE_PARENT

CLIPS_DIR = os.environ.get("CLIPS_PROJECT_DIR") or _DEFAULT
PROMPTS_DIR = os.path.join(CLIPS_DIR, "prompts")


class BridgeError(RuntimeError):
    """Raised with an actionable message when the clip project is unusable."""


def _require() -> str:
    if not os.path.isdir(CLIPS_DIR):
        raise BridgeError(
            f"the clip-finding project was not found at {CLIPS_DIR}. "
            "Set CLIPS_PROJECT_DIR to point at it."
        )
    for need in ("build_payload.py", "find_clips.py", "refine_clips.py", "llm.py"):
        if not os.path.exists(os.path.join(CLIPS_DIR, need)):
            raise BridgeError(f"{CLIPS_DIR} is missing {need}")
    if not os.path.isdir(PROMPTS_DIR):
        raise BridgeError(f"no prompts directory at {PROMPTS_DIR}")
    return CLIPS_DIR


def load():
    """-> (find_clips, refine_clips, llm, comments) with the path set up.

    Imported lazily rather than at module import so that stage 1 — which needs
    none of this — cannot fail because of a stage 2 problem.
    """
    path = _require()
    if path not in sys.path:
        # Appended, not inserted at 0: `transcript`, `comments`, `heatmap` and
        # `config` exist in BOTH projects with different contents, and this
        # folder's versions must keep winning for anything already imported.
        sys.path.append(path)

    import find_clips
    import llm
    import refine_clips

    return find_clips, refine_clips, llm


def load_comments():
    """The richer comment collector from the clip project.

    Separate from load() because it is only needed once the user has committed
    to a video: it runs an LLM triage pass over the comments to group them into
    themes and to tell a real timestamp from a football score. That costs money,
    so a video that never gets past the gate never pays for it.
    """
    path = _require()
    if path not in sys.path:
        sys.path.append(path)

    # Import by file location so this cannot collide with website/pipeline's
    # own comments.py, which is a different module with the same name.
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "clipproject_comments", os.path.join(path, "comments.py")
    )
    if spec is None or spec.loader is None:
        raise BridgeError("could not load the clip project's comments.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def categories() -> list:
    """The finder names that have a prompt file on disk."""
    path = _require()
    names = []
    for entry in sorted(os.listdir(os.path.join(path, "prompts"))):
        if entry.endswith(".md") and not entry.startswith("_") and not entry.startswith("refine_"):
            names.append(entry[:-3])
    return names
