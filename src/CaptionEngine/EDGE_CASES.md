# Caption Engine — edge cases and fallback behaviour

One hard rule: **the engine never renders a broken caption.** When the anchored layout cannot be
produced cleanly, the chunk degrades to `flat` — a plain centred track — and the reason is recorded
on the solved chunk as `fallbackReason`. Nothing throws. A damaged transcript still produces a
watchable reel.

---

## 1. Transcript-level input problems

`segmenter.ts → normalizeWords`.

| Input problem | Behaviour |
|---|---|
| `transcript` is `undefined`, `null`, or `[]` | Zero chunks, nothing renders, warning emitted |
| Token empty or whitespace-only | Dropped, counted in a warning |
| Token is bare punctuation (`","`) | Folded onto the previous word rather than becoming its own caption |
| Words out of chronological order | Sorted by `start` |
| `start` / `end` missing, `NaN`, or `Infinity` | Rebuilt from the running cursor; `end` defaults to `start + 0.06s` |
| `end <= start` | Forced to `start + 0.06s` |
| Word overlaps the next word | `end` clamped to the next word's `start` |
| `emphasis` out of range or non-numeric | Clamped to `0..1`, defaults to `0` |
| Missing `punctuated` | Falls back to `text` |

Every repair is counted and surfaced as a warning rather than silently swallowed.

---

## 2. Phrasing problems

`segmenter.ts → groupWords` / `mergeWeakGroups`.

| Case | Behaviour |
|---|---|
| Long stretch with no punctuation | Broken by the word budget, then the character budget, then the duration budget |
| Word budget reached but the next word closes the clause | One extra word is absorbed, so `"Words can mean different things,"` is not split with the comma orphaned onto the next sentence |
| A chunk would hold a single stopword (`"and"`, `"ki"`, `"hai"`) | Merged only with a nearby group from the **same sentence**. A hard punctuation boundary or long pause is never crossed |
| A weak word closes a full phrase (`"... aati hai."`) | Allowed to exceed `maxWords` by one and stays with the preceding phrase. It is never prepended to the next sentence |
| Trailing orphan word at the end of the transcript | Merged only when the preceding group is nearby and does not already end a sentence; otherwise it remains a plain standalone caption |
| Chunk shorter than `minChunkSeconds` | `endFrame` extended so it is readable |
| Two chunks would be on screen at once | Second pass clamps `visibleUntil` to the next chunk's `startFrame` |
| Back-to-back speech with no gap | `hasExitGap: false` → hard cut, no exit animation (a fade here reads as lag) |

---

## 3. Hero-word selection

`segmenter.ts → pickHeroWord`. Hard vetoes cannot be overridden; soft ones can, by `emphasis`.

| Case | Behaviour |
|---|---|
| Word shorter than `heroMinWordLength` (4) | **Hard veto.** `way`, `a`, `is` can never be the hero |
| Word longer than `heroMaxWordLength` (11) | **Hard veto.** It could not fit at hero size anyway |
| Emoji or symbols only (`"🔥"`) | **Hard veto** |
| Every word is a stopword (`"And it is what it is"`) | Nothing clears `heroScoreThreshold` → `no-hero-candidate` → flat |
| Vague content word (`ever`, `certain`, `things`, `looks`) | Penalised by `isWeakHeroWord`. This is why `"best news you will ever"` now picks `news`, and `"looks a certain way"` goes flat instead of blowing up `certain` |
| Word is `ALL CAPS` in the source | Read as an emphasis signal, bonus applied |
| Caller supplied `emphasis` | Dominates the score. This is the hook for the audio pass or an LLM, and it is the single highest-value field upstream can provide |
| Editorial impact vocabulary | High-stakes identity/value words (`discipline`, `freedom`, `confidence`, `truth`, `failure`, `courage`) and transformative verbs (`decide`, `survive`, `build`, `fight`) receive an explicit bonus. English and common Roman Hindi/Hinglish anchors are included |
| Letterform potential | A small tie-break bonus goes to lowercase words with both walls and openings above/below (`discipline`, `judge`, `somebody`). Meaning remains primary |
| Length | Scored as a sweet spot peaking at 6–9 letters, not as a slope — four letters at 200px looks accidental |

---

## 4. Fitting and placement

`layout.ts` and `anchor.ts`.

| Case | Behaviour | `fallbackReason` |
|---|---|---|
| Hero would have to shrink below `heroMinScale` (0.7) of target to fit | Chunk goes flat | `hero-too-long` |
| Block taller than `maxHeight` | Scaled down as one shape; if that breaches `heroMinScale`, flat | `hero-too-long` |
| No pocket is deep enough to beat the flush position by `minGain` | Fragment is set flush to the hero's optical edge — left for a lead-in, right for a tail. **Not a failure** — an arbitrary offset is only worth having when a pocket earns it |
| Hero has no pockets at all (`faith`, all-caps) | `buildHollows` returns nothing, every candidate loop is empty, flush is used |
| Fragment wider than every available pocket | Set flush |
| Two candidate pockets reach the same depth | Broken by enclosure first (a pocket closed on both sides beats one that runs off the end of the word), then coverage, then the lean |
| Two fragments would collide | Candidate rejected, next one tried |
| A second fragment on the same side | Nests against the first, which was registered as an obstacle |
| Script is neither Latin nor Indic (CJK, Arabic) | Flat, since the skyline logic cannot be trusted | `unsupported-script` |
| Chunk length slipped past the segmenter | Flat | `too-many-words` |
| `forceFlat: true` | Every chunk flat | `forced-by-config` |
| Metrics missing for a chunk | Flat | `no-metrics` |

### Inside `flat` mode

Flat is terminal, so it has to work for any input: greedy wrap against the safe width using the
pre-measured runs, then the whole block is scaled to fit with no minimum. It accepts whatever scale
it needs rather than failing. The wrap loop is capped at 8 rows so a pathological input cannot spin.

---

## 5. Script and typography

| Case | Behaviour |
|---|---|
| Devanagari / Gujarati | `heroCasing` forced to `preserve` (no case in these scripts). Placement still works, because non-Latin characters use measured geometry |
| Latin tall-letter anatomy | Capitals and `b d f h i j k l t` block upper pockets; `g j p q y` block lower pockets; `j` blocks both; `a c e m n o r s u v w x z` explicitly remain x-height openings. Exact coordinates still come from measured ink |
| Split helper row | Every fragment follows its own measured contour and clears the hero using its own cap-height gap. Therefore a descender in `things` cannot lift a neighbouring `or` away from an otherwise usable pocket |
| Word length in a non-Latin script | Combining marks count toward length (`normalizeToken` keeps `\p{M}`). Stripping them measured `निकल` as 3 characters and `બાકીનું` as 4, which pushed Indic words under the hero thresholds and stopped the engine emphasising them at all |
| Mixed Latin + Indic in one chunk | Dominant script wins |
| Emoji | Never uppercased, never a hero |
| Full caps requested by the variation | Ordinary heroes may use full caps only when standalone. High-impact words have a separate rare poster treatment (`powerUpperChance`, default 20%) when standalone or paired with exactly one helper side. Full caps is never used with helpers both above and below, which would collapse into a generic three-line stack |
| First-letter capital | Standalone only. A helper-bearing hero remains lowercase because one capital closes the first upper pocket |

---

## 6. Rendering

| Case | Behaviour |
|---|---|
| Composition resized (e.g. 720×1280) | `heroSize` and `flatSize` are quoted at a 1080-wide canvas and scaled by `width / 1080`; the solve is linear in size, so the arrangement is identical |
| Fonts not yet loaded | The solve is held behind `delayRender`, and `document.fonts.load` is called per face by name first. Skipping that would measure in the fallback face and draw in the real one, putting every pocket a few pixels out |
| No 2D canvas available | `guessInk` estimates, `continueRender` still fires. Layout is worse but valid, and the render does not hang |
| Font file missing | Logged and swallowed; the CSS fallback stack takes over |
| Chunk shorter than the exit animation | Exit skipped, so it cannot start fading before it arrives |
| A B-roll or overlay owns the screen | `blackoutRanges: [[start, end]]` |
| Lambda parallel rendering | Motion is a pure function of `frame`; all randomness is seeded `random()`, never `Math.random()`, so workers cannot disagree |
| Sub-pixel positions | Snapped to whole pixels. Type on a half pixel is resampled across two columns, which softens the letterforms and makes a shared edge look out by one |

---

## 7. Deliberate non-goals

- **B-roll / overlay insertion.** Separate layer.
- **Interior capitals** (`disciplinE`) as a uniqueness lever. Considered and rejected: a capital
  mid-word reads as a typo, and it destroys a pocket by putting a full-height letter where an
  x-height one was. The variation that does the same job for free is which pocket a fragment lands
  in, which already varies word by word because it follows the letterforms.
- **Decorative accents.** Glow, chromatic splits, underline swipes and particle bursts were all
  built and then removed — they read as a cheap template. A single flat accent colour remains,
  behind `variation.accentChance`, defaulting to 0.
- **Person-aware placement.** The block sits at a fixed `anchorY`. Placing it around a detected
  speaker only needs the centring step in `layout.ts → finish` to change.
- **Planning layout off-browser.** Phrasing and hero choice are pure and serialisable; pixel
  placement is not, because it needs real glyph ink. That tradeoff was made knowingly — the
  table-based estimate it replaced could not see ascenders or descenders, and so could not nest.
