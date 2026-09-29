/**
 * The director: turns a word-level transcript into a schedule of caption beats.
 *
 * This is the part that is actually new. Every other caption template in this repo is a
 * single moment — one hero word, one animation, one hand-placed `syncFrame`. A 45-second
 * motivational reel needs captions running for all 45 seconds, and the hard problem there is
 * not any individual look. It is deciding WHEN to escalate. Style every phrase and the clip
 * reads as noise; style none and it reads as a subtitle track.
 *
 * So the whole clip is planned first. Phrases are cut on the speaker's own breaths, each is
 * scored for how much it carries, and only the top few get promoted out of the quiet track —
 * rationed by a budget and separated by a cooldown, so two escalations never land on top of
 * each other. What the viewer ends up feeling is that the edit got louder exactly where the
 * speaker did.
 *
 * Nothing here measures or draws. It is pure, so the same transcript always produces the same
 * schedule.
 */
import { clamp, hash } from './util';
import { resolvePalette } from './palette';
import type {
	CaptionDirectorConfig,
	CaptionDirectorConfigInput,
	Phrase,
	PhraseWord,
	TranscriptWord,
	TreatmentName,
} from './types';

/**
 * Words that carry a sentence but never carry a reel. Excluded from hero picking so a phrase
 * does not rest on `because` just because it happens to be the longest thing in it.
 */
const STOPWORDS = new Set([
	'the', 'a', 'an', 'and', 'but', 'or', 'so', 'if', 'then', 'than', 'that', 'this', 'these',
	'those', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does', 'did',
	'have', 'has', 'had', 'will', 'would', 'can', 'could', 'should', 'may', 'might', 'must',
	'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them', 'my',
	'your', 'his', 'its', 'our', 'their', 'to', 'of', 'in', 'on', 'at', 'for', 'with', 'from',
	'by', 'as', 'about', 'into', 'up', 'out', 'not', 'no', 'just', 'very', 'really', 'like',
	'there', 'here', 'what', 'when', 'where', 'who', 'how', 'because', 'gonna', 'wanna',
	// Contractions, flattened. Spoken English is full of them and they are long enough in
	// characters to win a longest-word contest they have no business winning — a phrase should
	// never come to rest on `i'm` or `you've`.
	'im', 'ive', 'id', 'ill', 'youre', 'youve', 'youll', 'youd', 'hes', 'shes', 'theyre',
	'theyve', 'weve', 'wed', 'well', 'thats', 'whats', 'theres', 'heres', 'dont', 'doesnt',
	'didnt', 'cant', 'couldnt', 'wont', 'wouldnt', 'shouldnt', 'isnt', 'arent', 'wasnt',
	'werent', 'aint', 'gotta', 'kinda', 'sorta',
]);

const HARD_STOP = /[.?!…]/;
const SOFT_STOP = /[,;:—–]/;

export const CAPTION_DIRECTOR_DEFAULTS: Omit<CaptionDirectorConfig, 'words'> = {
	theme: {
		palette: resolvePalette('bone'),
		dim: 0.3,
		scrim: 0.62,
		casing: 'upper',
		stripPunctuation: true,
	},
	layout: {
		trackFontSize: 78,
		heroFontSize: 200,
		supportRatio: 0.26,
		leading: 0.34,
		maxWidth: 0.86,
		trackOffsetY: 0,
		heroOffsetY: 0,
	},
	timing: { wordIn: 4, reveal: 11, stagger: 3, out: 7, tailHold: 7 },
	// Five words, because the quiet track shows the whole phrase and five short words at this
	// size fit one line comfortably. Tighter than this and natural clauses get cut in half for
	// no reason; looser and the viewer is reading a sentence instead of a caption.
	phrasing: { maxWords: 5, breathGap: 0.34, maxSeconds: 3 },
	plan: {
		// About a fifth. Low enough that an escalation still registers as an event, high
		// enough that a 45-second clip gets six or seven of them.
		intensity: 0.2,
		threshold: 0.42,
		// Two and a half seconds at 30fps. Escalations closer together than this read as a
		// template cycling through its presets rather than an editor making a choice.
		cooldown: 75,
		pool: ['lit', 'slam', 'ribbon', 'cascade'],
	},
};

/** Config arrives from an LLM, so every knob is clamped to a range that still reads well. */
export const resolveCaptionDirectorConfig = (
	input?: CaptionDirectorConfigInput,
): CaptionDirectorConfig => {
	const d = CAPTION_DIRECTOR_DEFAULTS;
	const theme = { ...d.theme, ...input?.theme };
	const layout = { ...d.layout, ...input?.layout };
	const timing = { ...d.timing, ...input?.timing };
	const phrasing = { ...d.phrasing, ...input?.phrasing };
	const plan = { ...d.plan, ...input?.plan };

	const pool = (plan.pool ?? d.plan.pool).filter(
		(t): t is TreatmentName => t === 'lit' || t === 'slam' || t === 'ribbon' || t === 'cascade',
	);

	return {
		words: (input?.words ?? []).filter(
			(w) => typeof w?.start === 'number' && typeof w?.end === 'number' && !!w.text,
		),
		theme: {
			palette:
				typeof input?.theme?.palette === 'string'
					? resolvePalette(input.theme.palette)
					: resolvePalette('bone', input?.theme?.palette),
			dim: clamp(theme.dim, 0, 0.9),
			scrim: clamp(theme.scrim, 0, 1),
			casing: theme.casing,
			stripPunctuation: theme.stripPunctuation,
		},
		layout: {
			trackFontSize: clamp(layout.trackFontSize, 40, 120),
			// Floored well above the track size: if the escalation is not a big jump in scale
			// it is not an escalation, it is just a slightly different subtitle.
			heroFontSize: clamp(layout.heroFontSize, 110, 320),
			supportRatio: clamp(layout.supportRatio, 0.14, 0.44),
			leading: clamp(layout.leading, -0.1, 1.2),
			maxWidth: clamp(layout.maxWidth, 0.5, 0.94),
			trackOffsetY: layout.trackOffsetY,
			heroOffsetY: layout.heroOffsetY,
		},
		timing: {
			wordIn: clamp(timing.wordIn, 1, 14),
			reveal: clamp(timing.reveal, 4, 30),
			stagger: clamp(timing.stagger, 0, 14),
			out: clamp(timing.out, 2, 24),
			tailHold: clamp(timing.tailHold, 0, 40),
		},
		phrasing: {
			// Past five words the phrase stops being a caption and starts being a paragraph.
			maxWords: Math.round(clamp(phrasing.maxWords, 2, 6)),
			breathGap: clamp(phrasing.breathGap, 0.12, 1.2),
			maxSeconds: clamp(phrasing.maxSeconds, 1, 6),
		},
		plan: {
			intensity: clamp(plan.intensity, 0, 0.6),
			threshold: clamp(plan.threshold, 0, 1),
			cooldown: clamp(plan.cooldown, 0, 300),
			pool: pool.length > 0 ? pool : d.plan.pool,
		},
		background: input?.background,
	};
};

const applyCasing = (text: string, casing: CaptionDirectorConfig['theme']['casing']) =>
	casing === 'upper' ? text.toUpperCase() : casing === 'lower' ? text.toLowerCase() : text;

/**
 * Punctuation is dropped from the drawn text but kept for the break decisions. A comma tells
 * the engine where a person breathed; it does nothing at all for the viewer at 80px.
 * Apostrophes and internal hyphens stay, because `don't` without one is a different word.
 */
const forDisplay = (raw: string, strip: boolean) =>
	strip ? raw.replace(/[.,!?;:…"“”()\[\]]/g, '').trim() : raw;

// ---------------------------------------------------------------------------------------
// Phrasing
// ---------------------------------------------------------------------------------------

/**
 * Stage one: cut only where the speaker actually stopped — a full stop, or a gap long enough
 * to be a breath. Nothing else. These are the boundaries we can be confident about, so they
 * are taken unconditionally and never revisited.
 */
const cutOnBreaths = (words: TranscriptWord[], breathGap: number): TranscriptWord[][] => {
	const segments: TranscriptWord[][] = [];
	let current: TranscriptWord[] = [];

	words.forEach((w, i) => {
		current.push(w);
		const next = words[i + 1];
		const punct = w.punctuated ?? w.text;
		const gap = next ? next.start - w.end : Infinity;
		if (!next || HARD_STOP.test(punct) || gap >= breathGap) {
			segments.push(current);
			current = [];
		}
	});
	if (current.length > 0) segments.push(current);
	return segments;
};

/**
 * Stage two: break a segment that is still too long at its own weakest join, not at word N.
 *
 * This is the difference between a caption track and a chunker. Cutting at a fixed word count
 * produces `financial wall around your` / `family` — a break in the middle of a noun phrase,
 * which forces the viewer to hold an incomplete thought across a cut. Searching the segment
 * for its widest internal gap, preferring commas, and biasing toward the middle so neither
 * half is orphaned produces `financial wall` / `around your family`, where both halves are
 * things a person would say in one breath.
 *
 * Recursive, so a long run of unbroken speech is halved at its best join and each half is then
 * reconsidered on its own terms.
 */
const allStopwords = (words: TranscriptWord[]) =>
	words.every((w) => STOPWORDS.has(w.text.toLowerCase().replace(/[^a-z]/g, '')));

const splitAtWeakestJoin = (
	segment: TranscriptWord[],
	maxWords: number,
	maxSeconds: number,
): TranscriptWord[][] => {
	const span = segment[segment.length - 1].end - segment[0].start;
	// The duration cap exists to break up a wall of fast speech, so it only applies once there
	// are enough words to be worth breaking. A three-word line held for three seconds is a
	// speaker landing something deliberately — splitting it destroys the exact thing it is doing.
	const tooLong = segment.length > maxWords || (segment.length > 3 && span > maxSeconds);
	if (segment.length < 2 || !tooLong) return [segment];

	let best = 0;
	let bestScore = -Infinity;

	for (let i = 0; i < segment.length - 1; i++) {
		const gap = Math.max(0, segment[i + 1].start - segment[i].end);
		// A comma is a real breath that simply was not long enough to trigger a stage-one cut.
		// Worth more than a small gap, worth less than a large one.
		const comma = SOFT_STOP.test(segment[i].punctuated ?? segment[i].text) ? 0.16 : 0;
		// Nudge toward the centre. Small, so it only decides ties — which is exactly when it
		// matters, because a flat-out fast speaker has no gaps to find and every cut is a tie.
		const balance = 1 - Math.abs(i + 1 - segment.length / 2) / (segment.length / 2);
		// A cut that leaves `you can` or `in the` alone on screen is the worst outcome available:
		// the viewer reads a card that carries no information and then has to hold it. Heavily
		// penalised rather than forbidden, so it is still reachable when every cut is this bad.
		const orphan =
			allStopwords(segment.slice(0, i + 1)) || allStopwords(segment.slice(i + 1)) ? 0.5 : 0;
		const score = gap + comma + balance * 0.1 - orphan;
		if (score > bestScore) {
			bestScore = score;
			best = i;
		}
	}

	return [
		...splitAtWeakestJoin(segment.slice(0, best + 1), maxWords, maxSeconds),
		...splitAtWeakestJoin(segment.slice(best + 1), maxWords, maxSeconds),
	];
};

/**
 * Cuts the transcript into phrases on the speaker's breaths rather than on a word count.
 *
 * A motivational line lives on its pauses: the speaker stops before the thing that matters and
 * stops again after it. Cutting on those gaps means the caption boundaries land where the
 * meaning boundaries are, which is most of why the track reads as though somebody timed it by
 * hand. The word and duration caps are a second pass over what is left, and they look for the
 * best available join rather than counting to four.
 */
export const buildPhrases = (
	words: TranscriptWord[],
	fps: number,
	config: CaptionDirectorConfig,
): Phrase[] => {
	const { phrasing, theme, timing } = config;
	if (words.length === 0) return [];

	const sorted = [...words].sort((a, b) => a.start - b.start);

	const groups = cutOnBreaths(sorted, phrasing.breathGap).flatMap((seg) =>
		splitAtWeakestJoin(seg, phrasing.maxWords, phrasing.maxSeconds),
	);

	// A phrase of one word reads as a stutter unless it was deliberate. Fold it back into the
	// previous phrase when there is room — unless it earned its isolation by being surrounded
	// by silence, in which case a single word alone on screen is exactly right.
	for (let i = groups.length - 1; i > 0; i--) {
		const g = groups[i];
		if (g.length > 1) continue;
		const prev = groups[i - 1];
		const gapBefore = g[0].start - prev[prev.length - 1].end;
		const deliberate = gapBefore >= phrasing.breathGap * 1.6;
		if (!deliberate && prev.length < phrasing.maxWords) {
			prev.push(...g);
			groups.splice(i, 1);
		}
	}

	const tailHold = timing.tailHold;

	const phrases: Phrase[] = groups.map((group, id) => {
		const prev = groups[id - 1];
		const next = groups[id + 1];

		const startFrame = Math.round(group[0].start * fps);
		const lastWordEnd = Math.round(group[group.length - 1].end * fps);
		// Held past the last word so a line never vanishes mid-syllable, but never far enough
		// to collide with the next phrase — two phrases live at once is the one state the
		// renderer has no answer for.
		const nextStart = next ? Math.round(next[0].start * fps) : Infinity;
		const endFrame = Math.min(lastWordEnd + tailHold, nextStart - 1);

		const phraseWords: PhraseWord[] = group.map((w, i) => {
			const nextInGroup = group[i + 1];
			return {
				display: applyCasing(forDisplay(w.punctuated ?? w.text, theme.stripPunctuation), theme.casing),
				raw: w.text.toLowerCase(),
				startFrame: Math.round(w.start * fps),
				// Runs right up to the next word, so the active highlight never drops out in the
				// gap between two words inside one phrase.
				endFrame: nextInGroup ? Math.round(nextInGroup.start * fps) : endFrame,
				weight: clamp(w.weight ?? 0, 0, 1),
			};
		});

		const leadPause = prev ? group[0].start - prev[prev.length - 1].end : 0.5;
		const tailPause = next ? next[0].start - group[group.length - 1].end : 0.8;
		const seconds = Math.max(0.2, group[group.length - 1].end - group[0].start);

		return {
			id,
			words: phraseWords.filter((w) => w.display.length > 0),
			startFrame,
			endFrame,
			leadPause: Math.max(0, leadPause),
			tailPause: Math.max(0, tailPause),
			rate: group.length / seconds,
			weight: 0,
			heroIndex: 0,
			treatment: 'baseline',
		};
	});

	return phrases.filter((p) => p.words.length > 0 && p.endFrame > p.startFrame);
};

// ---------------------------------------------------------------------------------------
// Weighting
// ---------------------------------------------------------------------------------------

const median = (xs: number[]) => {
	if (xs.length === 0) return 1;
	const s = [...xs].sort((a, b) => a - b);
	const m = Math.floor(s.length / 2);
	return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/**
 * Picks the word the phrase rests on: the longest word that is not structural. Ties go to the
 * later word, because in spoken English the payoff lands at the end of the line — `nobody is
 * coming to SAVE you`, not `NOBODY is coming to save you`. An explicit weight from the LLM
 * beats all of it.
 */
const pickHero = (words: PhraseWord[]) => {
	const hinted = words.reduce((best, w, i) => (w.weight > words[best].weight ? i : best), 0);
	if (words[hinted].weight > 0) return hinted;

	let best = -1;
	let bestLen = 0;
	words.forEach((w, i) => {
		// Apostrophes are dropped for the lookup so `i'm` matches `im`, but the length that
		// competes is the letter count — a contraction should not win on punctuation.
		const letters = w.raw.replace(/[^a-z]/g, '');
		if (STOPWORDS.has(letters)) return;
		if (letters.length >= bestLen) {
			bestLen = letters.length;
			best = i;
		}
	});
	if (best >= 0) return best;
	// Everything in the phrase is structural. Longest word of any kind, ties to the later one,
	// for the same reason as above.
	return words.reduce((b, w, i) => (w.display.length >= words[b].display.length ? i : b), 0);
};

/**
 * Scores how much a phrase carries, 0-1, from signals that are already in the timings.
 *
 * All three are measurements of how the sentence was SAID, not of what it says — which is the
 * point. A phrase the speaker set up with a pause, slowed down for, and then let hang is a
 * phrase they thought mattered, and that is true whatever the words are and whatever language
 * they are in. Semantic judgement is the LLM's job, and when it supplies a weight it wins
 * outright.
 */
export const scorePhrases = (phrases: Phrase[]): Phrase[] => {
	if (phrases.length === 0) return phrases;
	const baseRate = median(phrases.map((p) => p.rate));
	const maxWords = Math.max(...phrases.map((p) => p.words.length));

	return phrases.map((p) => {
		// Silence on either side. Either one is enough — a setup pause and a landing pause are
		// both the speaker pointing at the line.
		const pause = clamp(Math.max(p.leadPause, p.tailPause) / 0.9, 0, 1);
		// Slowing below their own median. Normalised per clip, so a naturally fast speaker is
		// measured against themselves.
		const slow = clamp((baseRate - p.rate) / Math.max(0.2, baseRate * 0.6), 0, 1);
		// Short phrases punch. Four words is a statement, one word is a verdict.
		const brief = clamp((maxWords + 1 - p.words.length) / Math.max(1, maxWords), 0, 1);

		// A phrase made entirely of function words — `and i'm here`, `but i'm not gonna` — can
		// score well on all three signals and still be worth nothing, because a speaker pauses
		// before a thought as readily as inside one. Held down hard: an emphasis beat spent on a
		// connective is a beat not spent on the line it was leading into.
		const hollow = p.words.every((w) => STOPWORDS.has(w.raw.replace(/[^a-z]/g, ''))) ? 0.45 : 1;

		const inferred = (0.42 * pause + 0.3 * slow + 0.28 * brief) * hollow;
		const hint = Math.max(0, ...p.words.map((w) => w.weight));

		return { ...p, weight: clamp(Math.max(inferred, hint), 0, 1), heroIndex: pickHero(p.words) };
	});
};

// ---------------------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------------------

/**
 * Whether a look can physically carry a given phrase. Not taste — geometry. `ribbon` needs
 * something after the hero word to set as a tail; `cascade` needs enough words to make a
 * stair out of; `slam` throws away everything except the hero, so it can only run on a phrase
 * short enough that throwing the rest away loses nothing.
 */
const suits = (t: TreatmentName, p: Phrase): boolean => {
	const n = p.words.length;
	switch (t) {
		// Down to one word. A single word set large with the light on it is a perfectly good
		// composition, and having `lit` cover that case is what stops every one-word phrase in a
		// clip falling through to `slam` — which is reserved for exactly one moment.
		case 'lit':
			return n >= 1 && n <= 5;
		// The other words are not discarded, they are demoted to a caption under the rules, so a
		// five-word phrase is fine. The only real requirement is a hero long enough to hold the
		// frame on its own — a three-letter word blown up to 200px reads as a mistake.
		case 'slam':
			return n <= 5 && p.words[p.heroIndex].display.replace(/[^A-Za-z']/g, '').length >= 3;
		case 'ribbon':
			return n >= 2 && n <= 5 && p.heroIndex < n - 1;
		case 'cascade':
			return n >= 3 && n <= 5;
		default:
			return true;
	}
};

/**
 * Promotes a rationed handful of phrases out of the quiet track and assigns each a look.
 *
 * Two constraints do the real work. The budget keeps escalations rare enough to still mean
 * something. The cooldown keeps them apart in time — two heavy beats four seconds apart read
 * as a template cycling through its presets, while the same two beats fifteen seconds apart
 * read as an editor making a choice twice.
 *
 * Selection is by weight, so the beats land on the lines the speaker leaned into. Assignment
 * is deterministic — a hash of the phrase's own words, not a counter — so the schedule is
 * stable across re-renders and does not shift if an earlier phrase is re-cut.
 */
export const schedulePhrases = (
	phrases: Phrase[],
	plan: CaptionDirectorConfig['plan'],
): Phrase[] => {
	if (phrases.length === 0) return phrases;

	const budget = plan.intensity <= 0 ? 0 : Math.max(1, Math.round(phrases.length * plan.intensity));
	const accepted: number[] = [];

	const byWeight = [...phrases].sort((a, b) =>
		b.weight === a.weight ? a.startFrame - b.startFrame : b.weight - a.weight,
	);

	for (const p of byWeight) {
		if (accepted.length >= budget) break;
		if (p.weight < plan.threshold) break;
		const tooClose = accepted.some(
			(id) => Math.abs(phrases[id].startFrame - p.startFrame) < plan.cooldown,
		);
		if (tooClose) continue;
		if (!plan.pool.some((t) => suits(t, p))) continue;
		accepted.push(p.id);
	}

	accepted.sort((a, b) => a - b);

	// The single heaviest promoted phrase gets `slam`, and it is the only one that ever can.
	// A clip has one loudest moment by definition; a look that throws away every word except
	// the hero stops being impact and becomes a tic the second time it appears.
	const peak = accepted.reduce(
		(best, id) => (best < 0 || phrases[id].weight > phrases[best].weight ? id : best),
		-1,
	);
	const peakGetsSlam = peak >= 0 && plan.pool.includes('slam') && suits('slam', phrases[peak]);
	const rotation = plan.pool.filter((t) => t !== 'slam');

	const out = phrases.map((p) => ({ ...p }));
	let previous: TreatmentName = 'baseline';
	let previousAt = -1;

	for (const id of accepted) {
		const p = out[id];

		if (id === peak && peakGetsSlam) {
			p.treatment = 'slam';
			previous = 'slam';
			previousAt = p.startFrame;
			continue;
		}

		// Never the same look twice running. Where the phrase's shape leaves no alternative — a
		// two-word phrase can only really be `lit` — repeating is allowed, but only once the
		// previous beat is far enough back that nobody connects the two. Nearer than that and
		// the phrase stays on the quiet track: a missed emphasis costs nothing, while a look
		// that visibly repeats costs the illusion that any of this was chosen.
		let eligible = rotation.filter((t) => suits(t, p) && t !== previous);
		if (eligible.length === 0) {
			const farEnough = previousAt < 0 || p.startFrame - previousAt >= plan.cooldown * 2;
			if (!farEnough) continue;
			eligible = rotation.filter((t) => suits(t, p));
		}
		if (eligible.length === 0) continue;

		const pick =
			eligible[Math.floor(hash(p.words.map((w) => w.raw).join(' ')) * eligible.length) % eligible.length];
		p.treatment = pick;
		previous = pick;
		previousAt = p.startFrame;
	}

	return out;
};

/** The whole plan in one call. Pure: same transcript in, same schedule out. */
export const planCaptions = (config: CaptionDirectorConfig, fps: number): Phrase[] =>
	schedulePhrases(scorePhrases(buildPhrases(config.words, fps, config)), config.plan);

export const getCaptionDirectorDuration = (
	input?: CaptionDirectorConfigInput,
	fps = 30,
): number => {
	const c = resolveCaptionDirectorConfig(input);
	if (c.words.length === 0) return 60;
	const last = Math.max(...c.words.map((w) => w.end));
	return Math.round(last * fps + c.timing.out + c.timing.tailHold + 12);
};
