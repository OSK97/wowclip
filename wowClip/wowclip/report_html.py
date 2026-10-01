"""
The run report, as a single self-contained HTML file.

This is the thing you actually look at after a run. Everything else in the
pipeline exists to fill it in.

Design notes, since they were deliberate:

  * ONE renderer. `render(payload)` builds the page; the demo page is the same
    function fed sample data. So what you review IS what you get -- there is no
    separate hardcoded mock that can drift away from the real output.

  * The timeline is the only chart, and it earns its place: it answers "did it
    look at the whole video, or only the first twenty minutes?" at a glance.
    Sweep blocks form the track, clips sit on top of it.

  * Cost is shown as billed, not estimated, and says which it is. A report that
    quietly presents a guess as a fact is worse than no report.

  * The model's numbers are printed EXACTLY as it wrote them. No repairs, no
    rejections, no snapping. The two word anchors are shown as prominently as
    the timestamps, because together they are the actual cut points -- and if
    one is wrong, seeing it next to the transcript is how you find out.

  * Every clip carries a real YouTube link with ?t= on it, so you can check the
    moment in one click instead of scrubbing.

  * Light and dark are both selected, not flipped -- dark steps come from the
    dark band, not from inverting the light ones.
"""

import html
import json
import os


# ══════════════════════════════════════════════════════════════════════════
#  helpers
# ══════════════════════════════════════════════════════════════════════════

def _e(x):
    return html.escape(str(x if x is not None else ""), quote=True)


def hms(sec):
    try:
        sec = int(float(sec))
    except (TypeError, ValueError):
        return "-"
    h, rem = divmod(max(sec, 0), 3600)
    m, s = divmod(rem, 60)
    return f"{h}:{m:02d}:{s:02d}" if h else f"{m}:{s:02d}"


def _compact(n):
    try:
        n = float(n)
    except (TypeError, ValueError):
        return "-"
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M".replace(".0M", "M")
    if n >= 1_000:
        return f"{n/1_000:.1f}K".replace(".0K", "K")
    return f"{int(n):,}"


def _parse_sweep(sweep, duration):
    """'0-600 | intro, sponsor read' -> {start, end, text}. Tolerant: a line
    that does not parse still shows up, just without a bar."""
    out = []
    for row in sweep or []:
        if isinstance(row, dict):
            start = row.get("start_seconds") or row.get("start") or 0
            end = row.get("end_seconds") or row.get("end") or 0
            text = row.get("text") or row.get("summary") or ""
        else:
            raw = str(row)
            head, _, text = raw.partition("|")
            text = text.strip() or raw.strip()
            head = head.strip()
            start = end = None
            if "-" in head:
                a, _, b = head.partition("-")
                try:
                    start, end = float(a.strip()), float(b.strip())
                except ValueError:
                    start = end = None
        if start is None:
            out.append({"start": None, "end": None, "text": text})
            continue
        out.append({"start": float(start), "end": float(end or start),
                    "text": text})
    if duration:
        for b in out:
            if b["end"] and b["end"] > duration:
                b["end"] = duration
    return out


_EMPTY_WORDS = ("nothing", "none", "no ", "skip", "empty", "silence",
                "sponsor", "intro", "outro", "ad ", "promo")


def _looks_empty(text):
    t = (text or "").lower()
    return any(w in t for w in _EMPTY_WORDS)


# ══════════════════════════════════════════════════════════════════════════
#  CSS
# ══════════════════════════════════════════════════════════════════════════

CSS = """
*,*::before,*::after{box-sizing:border-box}
.viz-root{
  color-scheme:light;
  --surface-1:#fcfcfb; --page:#f9f9f7;
  --text-primary:#0b0b0b; --text-secondary:#52514e; --muted:#898781;
  --grid:#e1e0d9; --baseline:#c3c2b7; --border:rgba(11,11,11,.10);
  --series-1:#2a78d6; --series-2:#eb6834; --series-3:#1baf7a;
  --good:#0ca30c; --warning:#fab219; --critical:#d03b3b;
  --track:#86b6ef; --track-empty:#e1e0d9;
}
@media (prefers-color-scheme:dark){
 :root:where(:not([data-theme="light"])) .viz-root{
  color-scheme:dark;
  --surface-1:#1a1a19; --page:#0d0d0d;
  --text-primary:#fff; --text-secondary:#c3c2b7; --muted:#898781;
  --grid:#2c2c2a; --baseline:#383835; --border:rgba(255,255,255,.10);
  --series-1:#3987e5; --series-2:#d95926; --series-3:#199e70;
  --good:#0ca30c; --warning:#fab219; --critical:#d03b3b;
  --track:#184f95; --track-empty:#2c2c2a;
 }}
:root[data-theme="dark"] .viz-root{
  color-scheme:dark;
  --surface-1:#1a1a19; --page:#0d0d0d;
  --text-primary:#fff; --text-secondary:#c3c2b7; --muted:#898781;
  --grid:#2c2c2a; --baseline:#383835; --border:rgba(255,255,255,.10);
  --series-1:#3987e5; --series-2:#d95926; --series-3:#199e70;
  --track:#184f95; --track-empty:#2c2c2a;
}
html,body{margin:0;padding:0}
body{background:var(--page);}
.viz-root{
  background:var(--page); color:var(--text-primary);
  font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
  font-size:15px; line-height:1.55; padding:32px 20px 72px;
}
.wrap{max-width:940px;margin:0 auto}

/* header */
.head{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;
      flex-wrap:wrap;margin-bottom:26px}
.brand{font-size:12px;letter-spacing:.14em;text-transform:uppercase;
       color:var(--muted);font-weight:600;margin-bottom:8px}
h1{font-size:24px;line-height:1.28;margin:0 0 6px;font-weight:600;max-width:640px}
.sub{color:var(--text-secondary);font-size:14px}
.sub a{color:inherit}
.toggle{border:1px solid var(--border);background:var(--surface-1);
        color:var(--text-secondary);border-radius:8px;padding:7px 13px;
        font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}
.toggle:hover{color:var(--text-primary)}

/* stat tiles */
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
       gap:12px;margin-bottom:30px}
.tile{background:var(--surface-1);border:1px solid var(--border);
      border-radius:12px;padding:15px 17px}
.tile .label{font-size:12px;color:var(--muted);margin-bottom:5px}
.tile .value{font-size:27px;font-weight:600;letter-spacing:-.02em;line-height:1.1}
.tile .note{font-size:12px;color:var(--text-secondary);margin-top:4px}

section{margin-bottom:34px}
h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;
   color:var(--muted);font-weight:600;margin:0 0 14px;
   padding-bottom:9px;border-bottom:1px solid var(--grid)}

/* timeline */
.tl{background:var(--surface-1);border:1px solid var(--border);
    border-radius:12px;padding:18px 18px 12px}
.tl-track{position:relative;height:26px;margin-bottom:5px}
.tl-blk{position:absolute;top:7px;height:12px;background:var(--track-empty);
        border-radius:3px;border-right:2px solid var(--surface-1);
        background-clip:padding-box}
.tl-blk.has{background:var(--track)}
.tl-clip{position:absolute;top:0;height:26px;background:var(--series-1);
         border-radius:4px;box-shadow:0 0 0 2px var(--surface-1);cursor:default}
.tl-axis{position:relative;height:16px;border-top:1px solid var(--baseline)}
.tl-tick{position:absolute;top:3px;font-size:11px;color:var(--muted);
         font-variant-numeric:tabular-nums;transform:translateX(-50%);white-space:nowrap}
.tl-tick:first-child{transform:none}
.tl-tick:last-child{transform:translateX(-100%)}
.legend{display:flex;gap:18px;flex-wrap:wrap;margin-top:14px;font-size:12px;
        color:var(--text-secondary)}
.legend i{display:inline-block;width:11px;height:11px;border-radius:3px;
          margin-right:6px;vertical-align:-1px}

/* clips */
.clip{background:var(--surface-1);border:1px solid var(--border);
      border-radius:12px;padding:18px 20px;margin-bottom:13px}
.cuts{margin:13px 0 0;border:1px solid var(--border);border-radius:9px;
      overflow:hidden}
.cuts>div{display:flex;gap:12px;padding:8px 13px;font-size:13.5px;
          border-bottom:1px solid var(--grid)}
.cuts>div:last-child{border-bottom:0}
.ck{flex:none;width:92px;color:var(--muted);font-size:12px;font-weight:600;
    font-variant-numeric:tabular-nums;letter-spacing:.04em}
.cv{color:var(--text-primary)}
.clip-top{display:flex;gap:13px;align-items:flex-start;margin-bottom:11px}
.rank{flex:none;width:29px;height:29px;border-radius:8px;background:var(--series-1);
      color:#fff;font-weight:600;font-size:14px;display:flex;align-items:center;
      justify-content:center}
.clip-title{font-size:17px;font-weight:600;line-height:1.35;margin:2px 0 0}
.meta{display:flex;gap:8px;flex-wrap:wrap;margin:11px 0 0}
.chip{font-size:12px;padding:3px 9px;border-radius:999px;
      border:1px solid var(--border);color:var(--text-secondary);
      font-variant-numeric:tabular-nums}
.chip.time{color:var(--text-primary);font-weight:600}
.chip.ok{border-color:var(--good);color:var(--good)}
.chip.warn{border-color:var(--warning)}
.chip.bad{border-color:var(--critical);color:var(--critical)}
.why{margin:13px 0 0;color:var(--text-secondary);font-size:14px}
.quote{margin:13px 0 0;padding:11px 15px;border-left:2px solid var(--baseline);
       color:var(--text-secondary);font-size:14px;line-height:1.6;
       max-height:132px;overflow:auto}
.watch{display:inline-block;margin-top:13px;font-size:13px;font-weight:600;
       color:var(--series-1);text-decoration:none}
.watch:hover{text-decoration:underline}

/* misc */
.rows{background:var(--surface-1);border:1px solid var(--border);
      border-radius:12px;padding:6px 18px}
.row{display:flex;justify-content:space-between;gap:16px;padding:9px 0;
     font-size:14px;border-bottom:1px solid var(--grid)}
.row:last-child{border-bottom:0}
.row .k{color:var(--text-secondary)}
.row .v{font-variant-numeric:tabular-nums;text-align:right}
.sw{display:flex;gap:12px;padding:7px 0;font-size:14px;
    border-bottom:1px solid var(--grid)}
.sw:last-child{border-bottom:0}
.sw .t{flex:none;width:132px;color:var(--muted);font-size:13px;
       font-variant-numeric:tabular-nums}
.sw .d{color:var(--text-secondary)}
.sw.has .d{color:var(--text-primary)}
details{background:var(--surface-1);border:1px solid var(--border);
        border-radius:12px;padding:13px 18px;margin-top:11px}
summary{cursor:pointer;font-size:14px;color:var(--text-secondary);font-weight:600}
summary:hover{color:var(--text-primary)}
pre{white-space:pre-wrap;word-wrap:break-word;font-size:12.5px;line-height:1.6;
    color:var(--text-secondary);max-height:440px;overflow:auto;margin:13px 0 0;
    font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.empty{background:var(--surface-1);border:1px solid var(--border);
       border-radius:12px;padding:26px;text-align:center;color:var(--text-secondary)}
footer{margin-top:44px;padding-top:16px;border-top:1px solid var(--grid);
       font-size:12px;color:var(--muted);display:flex;justify-content:space-between;
       gap:16px;flex-wrap:wrap}
@media (max-width:560px){
  h1{font-size:20px}.tile .value{font-size:23px}
  .sw{flex-direction:column;gap:2px}.sw .t{width:auto}
}
"""


# ══════════════════════════════════════════════════════════════════════════
#  render
# ══════════════════════════════════════════════════════════════════════════

def render(d):
    """
    d keys: video_id, title, channel, duration_s, model, provider, effort,
            seconds, usage{}, payload{}, transcript{}, video_read, sweep[],
            clips[], near_misses[], reasoning, error
    """
    vid = d.get("video_id", "")
    duration = float(d.get("duration_s") or 0)
    usage = d.get("usage") or {}
    clips = d.get("clips") or []
    sweep = _parse_sweep(d.get("sweep"), duration)

    return f"""<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>wowClip - {_e(d.get('title') or vid)}</title>
<style>{CSS}</style>
</head><body>
<div class="viz-root"><div class="wrap">

  <div class="head">
    <div>
      <div class="brand">wowClip &middot; {_e(d.get('category', 'motivational'))}</div>
      <h1>{_e(d.get('title') or vid)}</h1>
      <div class="sub">{_e(d.get('channel') or '')}{' &middot; ' if d.get('channel') else ''}{hms(duration)}{' &middot; ' if vid else ''}<a href="https://youtu.be/{_e(vid)}" target="_blank" rel="noopener">{_e(vid)}</a></div>
    </div>
    <button class="toggle" onclick="tw()">Light / dark</button>
  </div>

  {_tiles(d, usage, clips)}
  {_error(d)}
  {_timeline(sweep, clips, duration)}
  {_read(d)}
  {_clips(clips, vid)}
  {_near(d.get('near_misses'), vid)}
  {_sweep_list(sweep)}
  {_details(d, usage)}

  <footer>
    <span>{_e(d.get('generated_at', ''))}</span>
    <span>{_e(d.get('model', ''))}{' via ' + _e(d.get('provider')) if d.get('provider') else ''}</span>
  </footer>
</div></div>
<script>
function tw(){{
  var r=document.documentElement;
  var dark=r.getAttribute('data-theme')==='dark'
    ||(!r.getAttribute('data-theme')&&matchMedia('(prefers-color-scheme:dark)').matches);
  r.setAttribute('data-theme',dark?'light':'dark');
}}
</script>
</body></html>"""


def _tiles(d, u, clips):
    inr = u.get("inr")
    src = u.get("source", "")
    cost_note = ("billed by the provider" if src == "billed"
                 else "estimated from list price" if src else "")
    think = u.get("thinking_tokens") or 0
    out = u.get("output_tokens") or 0
    share = f"{think/out:.0%} of output" if out else ""
    secs = d.get("seconds") or 0
    durs = [c.get("duration") for c in clips if c.get("duration")]
    span = (f"{min(durs):.0f}-{max(durs):.0f}s each" if durs else "")

    return f"""
  <div class="tiles">
    <div class="tile"><div class="label">Clips found</div>
      <div class="value">{len(clips)}</div>
      <div class="note">{_e(span)}</div></div>
    <div class="tile"><div class="label">Cost</div>
      <div class="value">Rs&nbsp;{inr:.2f}</div>
      <div class="note">{_e(cost_note)}</div></div>
    <div class="tile"><div class="label">Thinking tokens</div>
      <div class="value">{_compact(think)}</div>
      <div class="note">{_e(share)}</div></div>
    <div class="tile"><div class="label">Input</div>
      <div class="value">{_compact(u.get('input_tokens'))}</div>
      <div class="note">tokens read</div></div>
    <div class="tile"><div class="label">Time</div>
      <div class="value">{int(secs//60)}m {int(secs%60)}s</div>
      <div class="note">model wall clock</div></div>
  </div>"""


def _error(d):
    if not d.get("error"):
        return ""
    return (f'<section><h2>Run failed</h2><div class="empty" '
            f'style="color:var(--critical)">{_e(d["error"])}</div></section>')


def _timeline(sweep, clips, duration):
    """
    The one chart. It answers a single question -- did the model look at the
    whole video? -- so the track is the sweep coverage and the clips ride on
    top of it. A single measure, one baseline, no second axis.
    """
    if not duration or duration <= 0:
        return ""

    blocks = ""
    for b in sweep:
        if b["start"] is None:
            continue
        left = max(0.0, b["start"] / duration * 100)
        width = max(0.35, (b["end"] - b["start"]) / duration * 100)
        cls = "tl-blk" if _looks_empty(b["text"]) else "tl-blk has"
        blocks += (f'<div class="{cls}" style="left:{left:.3f}%;'
                   f'width:{min(width, 100-left):.3f}%" '
                   f'title="{_e(hms(b["start"]))}-{_e(hms(b["end"]))} '
                   f'{_e(b["text"])[:110]}"></div>')

    marks = ""
    for c in clips:
        s = c.get("start_seconds")
        e = c.get("end_seconds")
        if s is None or e is None:
            continue
        left = max(0.0, float(s) / duration * 100)
        width = max(0.6, (float(e) - float(s)) / duration * 100)
        marks += (f'<div class="tl-clip" style="left:{left:.3f}%;'
                  f'width:{min(width, 100-left):.3f}%" '
                  f'title="#{_e(c.get("rank",""))} {_e(c.get("title",""))} '
                  f'({_e(hms(s))})"></div>')

    ticks = ""
    for i in range(5):
        pos = i / 4
        ticks += (f'<div class="tl-tick" style="left:{pos*100:.1f}%">'
                  f'{hms(duration*pos)}</div>')

    coverage = ""
    if sweep:
        covered = sum((b["end"] - b["start"]) for b in sweep
                      if b["start"] is not None)
        coverage = (f'{min(covered/duration,1.0):.0%} of the video accounted '
                    f'for in the sweep')

    return f"""
  <section><h2>Where the model looked</h2>
    <div class="tl">
      <div class="tl-track">{blocks}{marks}</div>
      <div class="tl-axis">{ticks}</div>
      <div class="legend">
        <span><i style="background:var(--series-1)"></i>selected clip</span>
        <span><i style="background:var(--track)"></i>sweep block with content</span>
        <span><i style="background:var(--track-empty)"></i>sweep block with nothing</span>
        <span>{_e(coverage)}</span>
      </div>
    </div>
  </section>"""


def _read(d):
    if not d.get("video_read"):
        return ""
    return (f'<section><h2>How the model read it</h2>'
            f'<div class="rows"><div class="row"><span class="k" '
            f'style="color:var(--text-primary)">{_e(d["video_read"])}</span>'
            f'</div></div></section>')


def _clips(clips, vid):
    if not clips:
        return ('<section><h2>Clips</h2><div class="empty">No clips returned. '
                'For this category that can be the correct answer.</div>'
                '</section>')

    out = ['<section><h2>Clips</h2>']
    for c in clips:
        s = c.get("start_seconds")
        e = c.get("end_seconds")
        conf = (c.get("confidence") or "").upper()

        chips = [f'<span class="chip time">{hms(s)} &rarr; {hms(e)}</span>']
        if c.get("duration"):
            chips.append(f'<span class="chip">{c["duration"]}s</span>')
        if conf:
            chips.append(f'<span class="chip {"ok" if conf == "HIGH" else ""}">'
                         f'{_e(conf)}</span>')
        if c.get("category_hint"):
            chips.append(f'<span class="chip">{_e(c["category_hint"])}</span>')

        # The word anchors are the actual cut points. They get their own block,
        # not a footnote -- reading them against the transcript below is how a
        # wrong timestamp gets spotted.
        cuts = ""
        if c.get("start_words") or c.get("end_words"):
            cuts = (f'<div class="cuts">'
                    f'<div><span class="ck">IN  [{_e(s)}]</span>'
                    f'<span class="cv">{_e(c.get("start_words", ""))}</span></div>'
                    f'<div><span class="ck">OUT [{_e(e)}]</span>'
                    f'<span class="cv">{_e(c.get("end_words", ""))}</span></div>'
                    f'</div>')

        why = f'<p class="why">{_e(c.get("why"))}</p>' if c.get("why") else ""
        body = c.get("transcript") or c.get("text") or ""
        quote = f'<div class="quote">{_e(body)}</div>' if body else ""
        link = (f'<a class="watch" target="_blank" rel="noopener" '
                f'href="https://youtu.be/{_e(vid)}?t={int(float(s))}">'
                f'Watch from {hms(s)} &rarr;</a>'
                if vid and s is not None else "")

        out.append(f"""
    <div class="clip">
      <div class="clip-top">
        <div class="rank">{_e(c.get('rank', '-'))}</div>
        <h3 class="clip-title">{_e(c.get('title', 'Untitled'))}</h3>
      </div>
      <div class="meta">{''.join(chips)}</div>
      {cuts}{why}{quote}{link}
    </div>""")
    out.append("</section>")
    return "".join(out)


def _near(near, vid):
    if not near:
        return ""
    rows = ""
    for n in near:
        s = n.get("start_seconds")
        label = f'{hms(s)} &rarr; {hms(n.get("end_seconds"))}'
        if vid and s is not None:
            label = (f'<a href="https://youtu.be/{_e(vid)}?t={int(float(s))}" '
                     f'target="_blank" rel="noopener" '
                     f'style="color:inherit">{label}</a>')
        rows += (f'<div class="sw"><span class="t">{label}</span>'
                 f'<span class="d">{_e(n.get("why_not", ""))}</span></div>')
    return f'<section><h2>Near misses</h2><div class="rows">{rows}</div></section>'


def _sweep_list(sweep):
    if not sweep:
        return ""
    rows = ""
    for b in sweep:
        t = (f'{hms(b["start"])} &ndash; {hms(b["end"])}'
             if b["start"] is not None else "&mdash;")
        cls = "sw" if _looks_empty(b["text"]) else "sw has"
        rows += (f'<div class="{cls}"><span class="t">{t}</span>'
                 f'<span class="d">{_e(b["text"])}</span></div>')
    return (f'<section><h2>The sweep</h2><div class="rows">{rows}</div>'
            f'</section>')


def _details(d, u):
    t = d.get("transcript") or {}
    p = d.get("payload") or {}
    ls = t.get("line_stats") or {}
    ps = t.get("pause_stats") or {}

    def row(k, v):
        return f'<div class="row"><span class="k">{k}</span><span class="v">{v}</span></div>'

    tok = "".join([
        row("Input tokens", f"{u.get('input_tokens', 0):,}"),
        row("&nbsp;&nbsp;of which cached", f"{u.get('input_cache_hit', 0):,}"),
        row("Output tokens", f"{u.get('output_tokens', 0):,}"),
        row("&nbsp;&nbsp;thinking", f"{u.get('thinking_tokens', 0):,}"),
        row("&nbsp;&nbsp;final answer", f"{u.get('answer_tokens', 0):,}"),
        row("Total", f"{u.get('total_tokens', 0):,}"),
        row("Cost (USD)", f"${u.get('usd', 0):.5f}"),
        row("Cost (INR)", f"Rs {u.get('inr', 0):.4f}"),
        row("Cost source", _e(u.get("source", "-"))),
        row("Model", _e(d.get("model", "-"))),
        row("Reasoning effort", _e(d.get("effort", "-"))),
    ])

    build = "".join([
        row("Transcript lines", f"{ls.get('lines', 0):,}"),
        row("YouTube ASR chunks", f"{ls.get('youtube_chunks', 0):,}"),
        row("Words per chunk", f"{ls.get('mean_words', 0)}"),
        row("Pauses detected", f"{ps.get('pauses', 0):,}"),
        row("Gaps detected", f"{ps.get('gaps', 0):,}"),
        row("Payload size", f"~{p.get('est_tokens', 0):,} tokens"),
        row("&nbsp;&nbsp;transcript share", f"{p.get('transcript_share', 0):.0%}"),
        row("Comments included", f"{p.get('comments', 0):,}"),
        row("Heatmap peaks", f"{p.get('heatmap_peaks', 0):,}"),
    ])

    think = ""
    if d.get("reasoning"):
        think = (f'<details><summary>The model\'s thinking '
                 f'({len(d["reasoning"].split()):,} words)</summary>'
                 f'<pre>{_e(d["reasoning"])}</pre></details>')

    return f"""
  <section><h2>Cost &amp; tokens</h2><div class="rows">{tok}</div></section>
  <section><h2>How the payload was built</h2><div class="rows">{build}</div>
    {think}
  </section>"""


# ══════════════════════════════════════════════════════════════════════════
#  entry points
# ══════════════════════════════════════════════════════════════════════════

def build_payload_dict(result, resolved, payload_stats, transcript_report,
                       meta, video_id, category, duration_s, generated_at=""):
    verdict = result.get("verdict") or {}
    return {
        "video_id": video_id,
        "category": category,
        "title": (meta or {}).get("title"),
        "channel": (meta or {}).get("channel"),
        "duration_s": duration_s,
        "model": result.get("model"),
        "provider": result.get("provider"),
        "effort": result.get("effort"),
        "seconds": result.get("seconds"),
        "usage": result.get("usage") or {},
        "payload": payload_stats or {},
        "transcript": transcript_report or {},
        "video_read": verdict.get("video_read"),
        "sweep": verdict.get("sweep"),
        "clips": resolved or [],
        "near_misses": verdict.get("near_misses"),
        "reasoning": result.get("reasoning"),
        "error": result.get("error") if not result.get("ok") else "",
        "generated_at": generated_at,
    }


def write(path, data):
    with open(path, "w", encoding="utf-8") as f:
        f.write(render(data))
    return path


def write_json_sidecar(path, data):
    slim = {k: v for k, v in data.items() if k != "reasoning"}
    with open(path, "w", encoding="utf-8") as f:
        json.dump(slim, f, ensure_ascii=False, indent=1)
    return path
