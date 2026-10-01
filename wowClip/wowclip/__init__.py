"""
wowClip -- YouTube long-form video -> viral short-form clip selection.

This package is the CORE of the product: everything downstream (ASD, Remotion,
captions, rendering) is worthless if the clip chosen here is mediocre.

Pipeline shape:

    link
     |
     +-- omni_bouncer      is this video even usable?          (existing script)
     |
     +-- fetch             transcript / metadata / heatmap /   (cache.py + fetch.py)
     |                     comments                    ->cache/raw + cache/derived
     |
     +-- compose           word-level transcript + pause       (words.py, compose.py)
     |                     detection from timestamps
     |                     -> the LLM-facing transcript.
     |                     THE HEART.
     |
     +-- payload           CPA-ordered single text document    (payload.py)
     |
     +-- find              DeepSeek call, then code fixes the  (finder.py, verify.py)
                           boundaries it was never good at

Everything expensive is cached forever under cache/<video_id>/. Everything cheap
is rebuilt on every run, so iterating on the prompt costs nothing.
"""

__version__ = "1.0.0"
