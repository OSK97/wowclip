/**
 * Caption Engine — text utilities.
 *
 * Two jobs:
 *   1. Detect which script a chunk is written in, so Latin-only moves (uppercasing, negative
 *      tracking, tight line-height) are not applied to Devanagari or Gujarati.
 *   2. Decide whether a word carries meaning, and whether it is worth setting at 200px.
 *
 * Text measurement used to live here as a per-character advance table. It is gone: the layout now
 * measures real glyph ink in `metrics.ts`, because a table can tell you how wide `judge` is but not
 * that its `g` hangs below the baseline — and without that there are no hollows to set the small
 * type into, which is most of why the first version looked like generic auto-captions.
 */

import { ScriptKind } from './types';

const isEmojiCodePoint = (cp: number): boolean =>
	(cp >= 0x1f300 && cp <= 0x1faff) ||
	(cp >= 0x1f000 && cp <= 0x1f2ff) ||
	(cp >= 0x2600 && cp <= 0x27bf) ||
	cp === 0xfe0f ||
	(cp >= 0x1f1e6 && cp <= 0x1f1ff);

// ─────────────────────────────────────────────────────────────────────────────
// Script detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detects the dominant script of a string. Non-Latin chunks skip uppercasing and negative
 * tracking, and get a looser line-height so matras are not clipped.
 */
export const detectScript = (text: string): ScriptKind => {
	let latin = 0;
	let devanagari = 0;
	let gujarati = 0;
	let other = 0;

	for (const ch of text) {
		const cp = ch.codePointAt(0) ?? 0;
		if (cp <= 0x7f) {
			if ((cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122)) latin++;
		} else if (cp >= 0x0900 && cp <= 0x097f) {
			devanagari++;
		} else if (cp >= 0x0a80 && cp <= 0x0aff) {
			gujarati++;
		} else if (cp > 0x2000 && !isEmojiCodePoint(cp)) {
			other++;
		}
	}

	const max = Math.max(latin, devanagari, gujarati, other);
	if (max === 0) return 'latin'; // digits / punctuation only — Latin rules are fine
	if (max === devanagari) return 'devanagari';
	if (max === gujarati) return 'gujarati';
	if (max === other) return 'other';
	return 'latin';
};

export const isLatinScript = (script: ScriptKind): boolean => script === 'latin';

// ─────────────────────────────────────────────────────────────────────────────
// Word classification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Grammatical glue. A hero word is almost never one of these — `and`, `the`, `ki`, `hai` blown up
 * to 200px reads as a mistake.
 */
const STOPWORDS: Record<string, true> = {};
(
	// English function words
	'a an the and or but so if then than that this these those there here as at by for from in into of on onto ' +
	'to too up out off over under with without within about after before again once only just very too also ' +
	'i me my we us our you your he him his she her it its they them their who whom whose what which when where why how ' +
	'is am are was were be been being do does did doing done have has had having will would shall should can could may ' +
	'might must not no nor none yes ok okay well got get gets gonna wanna kinda sorta ' +
	// Hindi / Hinglish function words (roman)
	'ki ka ke ko se me mein hai hain ho hu hun tha thi aur ya par bhi to toh na nahi nahin ' +
	'kya kyun kyunki kaise kab kahan jo jab tab ab agar lekin phir bas sirf ek do kuch koi sab aap tum tera mera ' +
	'apna apne uska uski unka hum humne mujhe tujhe usse isse iska'
)
	.split(' ')
	.forEach((w) => {
		if (w) STOPWORDS[w] = true;
	});

/**
 * Strips punctuation and lowercases, for scoring comparisons.
 *
 * Combining marks (`\p{M}`) are deliberately kept. Dropping them silently shrinks every Devanagari
 * and Gujarati word — `निकल` measures 3 characters instead of 4, `બાકીનું` measures 4 instead of 7 —
 * which drags Indic words below the hero-word length thresholds and makes the engine refuse to
 * emphasise them at all. Latin tokens carry no marks, so they are unaffected.
 */
export const normalizeToken = (token: string): string =>
	token
		.toLowerCase()
		.replace(/[^\p{L}\p{N}\p{M}]/gu, '')
		.trim();

export const isStopword = (token: string): boolean => {
	const n = normalizeToken(token);
	return n.length === 0 || STOPWORDS[n] === true;
};

/**
 * Words that pass the stopword test but still make terrible heroes.
 *
 * These are grammatically content words, yet blowing them up says nothing — the eye lands on `ever`
 * or `certain` and gets no payload. The list exists because the first version picked `ever` out of
 * "best news you will ever hear" and `certain` out of "looks a certain way", and both read as the
 * engine having missed the point of the sentence.
 *
 * Penalised rather than vetoed, so a strong `emphasis` signal from upstream still wins.
 */
const WEAK_HERO_WORDS: Record<string, true> = {};
(
	'ever never always often sometimes usually very really quite rather truly simply merely ' +
	'more most less least better best worse worst much many some any every each other another ' +
	'same certain sure whole entire actual real true false thing things stuff way ways kind sort ' +
	'type lot lots bit part side time times able going want wants need needs like likes ' +
	'said says say tell tells told know knows knew think thinks thought make makes made take ' +
	'takes took give gives gave come comes came look looks looked even still else'
)
	.split(' ')
	.forEach((w) => {
		if (w) WEAK_HERO_WORDS[w] = true;
	});

export const isWeakHeroWord = (token: string): boolean =>
	WEAK_HERO_WORDS[normalizeToken(token)] === true;

// ─────────────────────────────────────────────────────────────────────────────
// Meaning and typographic potential
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A small, explicit editorial vocabulary for words that can carry a frame by themselves.
 *
 * This is not trying to understand the whole sentence — the upstream LLM's `emphasis` field is
 * still the authority for that. It is a guardrail for the no-LLM path, so `freedom` beats `comes`,
 * `discipline` beats `old`, and `news` beats `ever`. Scores are additive and intentionally modest:
 * context, delivery and external emphasis can still win.
 */
const HERO_IMPACT: Record<string, number> = {};

const registerImpact = (score: number, words: string): void => {
	words.split(' ').forEach((word) => {
		if (!word) return;
		HERO_IMPACT[word] = Math.max(HERO_IMPACT[word] ?? 0, score);
	});
};

// Identity, values and emotional stakes — the words most likely to deserve the whole frame.
registerImpact(
	1.65,
	'discipline freedom confidence courage purpose legacy destiny respect strength power truth ' +
	'justice loyalty family love sacrifice survival victory success failure mindset focus belief ' +
	'faith fearless unstoppable impossible responsibility independence opportunity',
);

// Transformative verbs and high-energy states. Include common inflections because ASR gives the
// spoken form and this path deliberately avoids a language-dependent stemmer.
registerImpact(
	1.15,
	'decide decided choosing choose build built create created change changed fight fighting rise ' +
	'rising survive survived surviving believe believed become became begin start started stop quit ' +
	'win wins winning won fail fails failed failing learn learned grow grew protect lead leading ' +
	'danger dangerous tolerate tolerant judge judged dream dreamed dreaming achieve achieved',
);

// Useful editorial anchors that are less universal, but still beat grammatical or vague words.
registerImpact(
	0.7,
	'money wealth broke pain alone lonely rejected rejection risk fear shame hope reality lesson ' +
	'news secret reason problem answer different unique ordinary extraordinary mother father parents ' +
	'children future past today tomorrow',
);

// Common Hindi/Hinglish motivational anchors in Roman ASR output.
registerImpact(
	1.35,
	'mehnat himmat azadi zindagi kamyabi bharosa kismat sapna sapne jeet haar sach paisa parivaar ' +
	'izzat taakat junoon hausla manzil safalta nakaami',
);

export const heroSemanticWeight = (token: string): number =>
	HERO_IMPACT[normalizeToken(token)] ?? 0;

/** A high-impact word is eligible for the rare all-caps poster treatment. */
export const isPowerHeroWord = (token: string): boolean => heroSemanticWeight(token) >= 1.3;

const HERO_ASCENDERS = new Set('bdfhijklt'.split(''));
const HERO_DESCENDERS = new Set('gjpqy'.split(''));
const HERO_X_HEIGHT = new Set('acemnorsuvwxz'.split(''));

/**
 * Scores how much useful negative space a lowercase Latin word is likely to offer before fonts are
 * measured. Meaning always comes first; this is only a tie-breaker between similarly meaningful
 * candidates.
 *
 * Best case has both walls and openings above and below: e.g. `discipline`, `judge`, `somebody`.
 * A solid skyline such as `faith` can still be the hero — it simply receives no layout bonus.
 */
export const heroTypographyPotential = (token: string): number => {
	const word = normalizeToken(token);
	if (!/^[a-z]+$/.test(word)) return 0;

	let ascenders = 0;
	let descenders = 0;
	let xHeight = 0;
	let nonDescenders = 0;

	for (const char of word) {
		if (HERO_ASCENDERS.has(char)) ascenders++;
		if (HERO_DESCENDERS.has(char)) descenders++;
		else nonDescenders++;
		if (HERO_X_HEIGHT.has(char) || HERO_DESCENDERS.has(char)) xHeight++;
	}

	let score = 0;
	if (word.length >= 6 && word.length <= 10) score += 0.18;
	if (ascenders > 0 && xHeight > 0) score += 0.24;
	if (descenders > 0 && nonDescenders > 0) score += 0.24;
	if (ascenders > 0 && descenders > 0) score += 0.1;
	return score;
};

/** Length in visible characters (code points), ignoring punctuation. */
export const visibleLength = (token: string): number => Array.from(normalizeToken(token)).length;

/** True when the token is purely punctuation and should never stand alone. */
export const isPunctuationOnly = (token: string): boolean => normalizeToken(token).length === 0;

/** True when the token is an emoji or symbol run — never a hero word. */
export const isSymbolOnly = (token: string): boolean => {
	let letters = 0;
	let symbols = 0;
	for (const ch of token) {
		const cp = ch.codePointAt(0) ?? 0;
		if (isEmojiCodePoint(cp)) symbols++;
		else if (normalizeToken(ch).length > 0) letters++;
	}
	return symbols > 0 && letters === 0;
};

/** Trailing punctuation, used to decide chunk breaks. Includes the Devanagari danda. */
export const trailingBreakClass = (display: string): 'none' | 'soft' | 'hard' => {
	const trimmed = display.trim();
	if (/[.!?\u2026\u0964]["')\]]?$/.test(trimmed)) return 'hard';
	if (/[,;:\u2014-]$/.test(trimmed)) return 'soft';
	return 'none';
};
