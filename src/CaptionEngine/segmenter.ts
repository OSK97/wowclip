/**
 * Caption Engine — segmenter.
 *
 * Turns a raw word-level transcript into phrase-sized chunks and picks the one word in each
 * chunk that deserves to be 180px tall.
 *
 * ASR output is messier than it looks: words arrive out of order, `end` is sometimes before
 * `start`, adjacent words overlap by a few ms, tokens are sometimes bare punctuation, and a
 * "word" is occasionally a whole clause glued together. `normalizeWords` fixes all of that once
 * so nothing downstream has to defend against it.
 */

import {
	BreakClass,
	NormalizedWord,
	SegmenterConfig,
	TranscriptWord,
} from './types';
import {
	heroSemanticWeight,
	heroTypographyPotential,
	isPunctuationOnly,
	isStopword,
	isSymbolOnly,
	isWeakHeroWord,
	trailingBreakClass,
	visibleLength,
} from './text';

/** A word can never be shorter than this, otherwise it would occupy zero frames. */
const MIN_WORD_SECONDS = 0.06;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

const isFiniteNumber = (v: unknown): v is number =>
	typeof v === 'number' && isFinite(v) && !isNaN(v);

export interface NormalizeResult {
	words: NormalizedWord[];
	warnings: string[];
}

/**
 * Repairs and frame-stamps a transcript.
 *
 * Every repair is recorded as a warning rather than thrown, because a slightly broken transcript
 * should still produce a watchable reel — dropping the render is never the better outcome.
 */
export const normalizeWords = (
	input: TranscriptWord[] | undefined | null,
	fps: number,
): NormalizeResult => {
	const warnings: string[] = [];

	if (!input || input.length === 0) {
		warnings.push('Transcript is empty — no captions will be rendered.');
		return { words: [], warnings };
	}

	// 1. Drop unusable entries, keep a note of how many.
	let droppedEmpty = 0;
	let repairedTimes = 0;

	const cleaned: TranscriptWord[] = [];
	for (let i = 0; i < input.length; i++) {
		const w = input[i];
		const display = (w.punctuated ?? w.text ?? '').trim();
		if (display.length === 0) {
			droppedEmpty++;
			continue;
		}
		cleaned.push(w);
	}
	if (droppedEmpty > 0) warnings.push(`Dropped ${droppedEmpty} empty transcript token(s).`);

	// 2. Bare punctuation tokens ("," ".") get folded into the previous word instead of becoming
	//    their own caption.
	const folded: TranscriptWord[] = [];
	for (let i = 0; i < cleaned.length; i++) {
		const w = cleaned[i];
		const display = (w.punctuated ?? w.text ?? '').trim();
		if (isPunctuationOnly(display) && !isSymbolOnly(display) && folded.length > 0) {
			const prev = folded[folded.length - 1];
			folded[folded.length - 1] = {
				...prev,
				punctuated: `${(prev.punctuated ?? prev.text).trim()}${display}`,
				end: isFiniteNumber(w.end) ? Math.max(prev.end, w.end) : prev.end,
			};
			continue;
		}
		folded.push(w);
	}

	// 3. Sort by start time. ASR merges and re-alignments can emit out-of-order words.
	const sorted = folded.slice().sort((a, b) => {
		const as = isFiniteNumber(a.start) ? a.start : 0;
		const bs = isFiniteNumber(b.start) ? b.start : 0;
		if (as === bs) return 0;
		return as - bs;
	});

	// 4. Repair times, then frame-stamp.
	const out: NormalizedWord[] = [];
	let cursor = 0;

	for (let i = 0; i < sorted.length; i++) {
		const w = sorted[i];
		const display = (w.punctuated ?? w.text ?? '').trim();
		const bare = (w.text ?? display).trim();

		let start = isFiniteNumber(w.start) ? Math.max(0, w.start) : cursor;
		let end = isFiniteNumber(w.end) ? w.end : start + MIN_WORD_SECONDS;

		if (start < cursor) {
			// Overlaps the previous word. Push it forward rather than reorder.
			start = cursor;
			repairedTimes++;
		}
		if (end <= start) {
			end = start + MIN_WORD_SECONDS;
			repairedTimes++;
		}

		// Clamp against the next word so two captions never claim the same frame.
		const next = sorted[i + 1];
		if (next && isFiniteNumber(next.start) && next.start > start && end > next.start) {
			end = next.start;
			repairedTimes++;
		}
		if (end <= start) end = start + MIN_WORD_SECONDS;

		cursor = end;

		const startFrame = Math.max(0, Math.round(start * fps));
		const endFrame = Math.max(startFrame + 1, Math.round(end * fps));

		out.push({
			text: bare,
			display,
			start,
			end,
			startFrame,
			endFrame,
			emphasis: isFiniteNumber(w.emphasis) ? clamp(w.emphasis, 0, 1) : 0,
			breakClass: trailingBreakClass(display) as BreakClass,
		});
	}

	if (repairedTimes > 0) {
		warnings.push(`Repaired ${repairedTimes} out-of-order or zero-length word timing(s).`);
	}

	return { words: out, warnings };
};

// ─────────────────────────────────────────────────────────────────────────────
// Grouping
// ─────────────────────────────────────────────────────────────────────────────

const groupCharCount = (group: NormalizedWord[]): number => {
	let n = 0;
	for (let i = 0; i < group.length; i++) n += group[i].display.length + (i > 0 ? 1 : 0);
	return n;
};

/**
 * Groups words into caption-sized phrases.
 *
 * Break priority, highest first: sentence-ending punctuation, a long pause, the word budget,
 * the character budget, the duration budget, then a comma once the chunk has enough words.
 * Punctuation wins over budgets because a caption that splits mid-sentence reads worse than a
 * caption that is one word short.
 */
export const groupWords = (
	words: NormalizedWord[],
	cfg: SegmenterConfig,
): NormalizedWord[][] => {
	const groups: NormalizedWord[][] = [];
	let current: NormalizedWord[] = [];

	const flush = () => {
		if (current.length > 0) {
			groups.push(current);
			current = [];
		}
	};

	for (let i = 0; i < words.length; i++) {
		const word = words[i];
		current.push(word);

		const next = words[i + 1];
		if (!next) break;

		const pause = next.start - word.end;
		const duration = word.end - current[0].start;
		const chars = groupCharCount(current);
		const wouldExceedChars = chars + 1 + next.display.length > cfg.maxChars;

		const hardPunct = word.breakClass === 'hard';
		const softPunct = word.breakClass === 'soft';

		// When the chunk is full but the very next word closes the clause, take it anyway. Otherwise
		// "Words can mean different things," splits after "different" and the orphaned "things,"
		// gets glued to the front of the next sentence, which reads as a mistake.
		const absorbClosingWord =
			current.length === cfg.maxWords &&
			next.breakClass !== 'none' &&
			!wouldExceedChars;

		if (hardPunct) {
			flush();
		} else if (pause >= cfg.pauseBreakSeconds) {
			flush();
		} else if (absorbClosingWord) {
			// keep going for exactly one more word
		} else if (current.length >= cfg.maxWords) {
			flush();
		} else if (wouldExceedChars && current.length >= 2) {
			flush();
		} else if (duration >= cfg.maxChunkSeconds && current.length >= 2) {
			flush();
		} else if (softPunct && current.length >= cfg.softBreakMinWords) {
			flush();
		}
	}
	flush();

	return mergeWeakGroups(groups, cfg);
};

/**
 * A chunk holding a single stopword ("and", "ki") flashing on screen for 6 frames is visual
 * noise. Those get absorbed into a neighbour that still has room.
 */
const mergeWeakGroups = (
	groups: NormalizedWord[][],
	cfg: SegmenterConfig,
): NormalizedWord[][] => {
	if (groups.length <= 1) return groups;

	const out: NormalizedWord[][] = [];
	const nearby = (gap: number): boolean => gap <= cfg.pauseBreakSeconds * 1.1;

	for (let i = 0; i < groups.length; i++) {
		const group = groups[i];
		const first = group[0];
		const last = group[group.length - 1];
		const isWeak =
			group.length === 1 && (isStopword(first.display) || visibleLength(first.display) <= 2);

		if (!isWeak) {
			out.push(group);
			continue;
		}

		const prev = out[out.length - 1];
		const prevLast = prev?.[prev.length - 1];
		const sameSentenceAsPrev =
			prevLast !== undefined &&
			prevLast.breakClass !== 'hard' &&
			nearby(first.start - prevLast.end);

		// A weak word that closes the current sentence belongs to the preceding phrase even when that
		// phrase is already at maxWords. One extra `hai.` is much less harmful than putting `hai.` in
		// front of the next sentence. The old `prev.length < maxWords` guard rejected it and the next
		// branch prepended it to `Rejection quietly...`, which the typography-lab stills exposed.
		const canJoinPrev =
			prev &&
			sameSentenceAsPrev &&
			(prev.length < cfg.maxWords || last.breakClass === 'hard');

		if (canJoinPrev) {
			prev.push(first);
			continue;
		}

		const nextGroup = groups[i + 1];
		const nextFirst = nextGroup?.[0];
		const sameSentenceAsNext =
			last.breakClass !== 'hard' &&
			nextFirst !== undefined &&
			nearby(nextFirst.start - last.end);

		if (nextGroup && nextGroup.length < cfg.maxWords && sameSentenceAsNext) {
			nextGroup.unshift(first);
			continue;
		}

		// Sentence on both sides, a long pause, or no neighbour with room: keep the weak word alone.
		// Flat and slightly plain is preferable to grammatically corrupt.
		out.push(group);
	}

	return out;
};

// ─────────────────────────────────────────────────────────────────────────────
// Hero word selection
// ─────────────────────────────────────────────────────────────────────────────

export interface HeroPick {
	index: number | null;
	score: number;
}

const median = (values: number[]): number => {
	if (values.length === 0) return 0;
	const s = values.slice().sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
};

/**
 * Length is a sweet spot, not a slope.
 *
 * Four letters at 200px looks accidental; fourteen cannot fit without shrinking to the point where
 * the size hierarchy collapses. Six to nine is where the reference captions live, so the bonus
 * peaks there and falls away on both sides.
 */
const lengthBonus = (len: number): number => {
	if (len <= 3) return 0;
	if (len === 4) return 0.4;
	if (len === 5) return 0.8;
	if (len === 6) return 1.1;
	if (len <= 8) return 1.25;
	if (len === 9) return 1.05;
	if (len === 10) return 0.7;
	return 0.3;
};

/**
 * Scores every word in a chunk and returns the best hero candidate.
 *
 * Signals, roughly by weight:
 *   - external `emphasis` (loudness / PANNs / LLM keyword) when the caller supplies it. This is the
 *     one that matters most and the one upstream should always provide.
 *   - carries meaning: not a stopword, and not one of the vague content words that say nothing at
 *     200px (`ever`, `certain`, `things`, `looks`)
 *   - length, peaking around six to nine letters
 *   - drawn-out delivery relative to the rest of the chunk, which is how people stress a word
 *   - final position, where punchlines live — but only as a nudge, since it used to be large
 *     enough to hand the hero to whatever happened to be last
 *
 * Returns `index: null` when nothing clears `heroScoreThreshold`. That is a legitimate outcome and
 * a common one: plenty of phrases have no word worth going big on, and those read far better as a
 * plain line than as an arbitrary word blown up.
 */
export const pickHeroWord = (group: NormalizedWord[], cfg: SegmenterConfig): HeroPick => {
	if (group.length === 0) return { index: null, score: 0 };

	const rates = group.map((w) => {
		const len = Math.max(1, visibleLength(w.display));
		return (w.end - w.start) / len;
	});
	const medianRate = median(rates);

	let bestIndex: number | null = null;
	let bestScore = -Infinity;

	for (let i = 0; i < group.length; i++) {
		const w = group[i];
		const len = visibleLength(w.display);

		// Hard vetoes. Nothing upstream can talk the engine into these.
		if (isSymbolOnly(w.display)) continue;
		if (len < cfg.heroMinWordLength) continue;
		if (len > cfg.heroMaxWordLength) continue;

		let score = 2.45;

		// Editorial value first. `emphasis` is the authority when upstream supplies it; the explicit
		// vocabulary makes the no-LLM path choose words that can actually carry a frame. Letterform
		// potential is deliberately only a tie-breaker — a beautiful word shape with no meaning is
		// still the wrong hero.
		score += lengthBonus(len);
		score += heroSemanticWeight(w.display);
		score += heroTypographyPotential(w.display);
		score += w.emphasis * 4;

		// Soft vetoes, so a genuinely strong external emphasis signal can still override them.
		if (isStopword(w.display)) score -= 6;
		if (isWeakHeroWord(w.display)) score -= 3;

		if (medianRate > 0 && rates[i] > medianRate * 1.25) score += 1.1;
		if (i === group.length - 1) score += 0.25;
		if (/[!?]["')\]]?$/.test(w.display)) score += 0.5;
		if (len > 2 && w.text === w.text.toUpperCase() && /[A-Z]/.test(w.text)) score += 1;
		if (/\d/.test(w.display)) score += 0.4;

		if (score > bestScore) {
			bestScore = score;
			bestIndex = i;
		}
	}

	if (bestIndex === null || bestScore < cfg.heroScoreThreshold) {
		return { index: null, score: bestScore === -Infinity ? 0 : bestScore };
	}

	return { index: bestIndex, score: bestScore };
};
