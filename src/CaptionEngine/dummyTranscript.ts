/**
 * Caption Engine — dummy transcript.
 *
 * Stand-in for real WhisperX output until the pipeline is wired up. Timings are generated from a
 * compact script rather than hand-written, so the file stays readable and the engine still gets
 * realistic, uneven word durations.
 *
 * The script is deliberately not all clean motivational one-liners. It also contains every input
 * the layout engine is supposed to refuse to hero-ify, so previewing this composition exercises
 * the fallback paths instead of only the happy path:
 *
 *   - a word too long to ever be a hero ("responsibility", "uncomfortable")
 *   - a phrase made entirely of stopwords, where no word deserves emphasis
 *   - Gujarati and Devanagari lines, which must skip uppercasing and get looser line-height
 *   - a number-heavy line
 *   - a single-word line
 *   - an emoji token, which must never become the hero word
 *   - a long run with no punctuation at all, which has to be broken by the word budget
 */

import { TranscriptWord } from './types';

interface ScriptLine {
	/** Earliest start time in seconds. The builder never lets lines overlap. */
	at: number;
	text: string;
	/** Words per second. Lower = slower, more deliberate delivery. */
	wps?: number;
	/** 0..1 emphasis applied to the words listed here (bare, lowercase, no punctuation). */
	stress?: string[];
}

const SCRIPT: ScriptLine[] = [
	{ at: 0.4, text: 'Do not judge people.', wps: 2.2, stress: ['judge'] },
	{ at: 2.3, text: 'Be more tolerant.', wps: 2.0, stress: ['tolerant'] },
	{ at: 4.0, text: 'Words can mean different things,', wps: 2.6, stress: ['different'] },
	{ at: 6.2, text: 'or somebody looks a certain way.', wps: 2.8 },
	{ at: 8.9, text: 'And you already decide.', wps: 2.3, stress: ['decide'] },

	// No word here is worth 180px — every one of them is grammatical glue.
	{ at: 11.0, text: 'And it is what it is.', wps: 3.4 },

	// Too long to be a hero at any usable size. Must degrade to a simple line.
	{ at: 12.8, text: 'That is your responsibility.', wps: 2.1, stress: ['responsibility'] },

	{ at: 15.0, text: 'Sit with the uncomfortable truth.', wps: 2.4, stress: ['uncomfortable'] },

	{ at: 17.8, text: 'Money is not the goal.', wps: 2.6, stress: ['money'] },
	{ at: 19.9, text: 'Freedom is.', wps: 1.7, stress: ['freedom'] },

	// Number-heavy.
	{ at: 21.4, text: 'I failed 47 times before one worked.', wps: 3.0, stress: ['47'] },

	// Single word, spoken slowly.
	{ at: 24.4, text: 'Once.', wps: 1.2, stress: ['once'] },

	// Long run with no punctuation, has to be split by the word and character budgets.
	{
		at: 26.0,
		text: 'nobody is coming to save you and that is the best news you will ever hear',
		wps: 3.6,
	},

	// Emoji must never be chosen as the hero word.
	{ at: 31.0, text: 'Stay dangerous 🔥', wps: 2.0, stress: ['dangerous'] },

	// Devanagari — no uppercasing, looser line-height.
	{ at: 33.2, text: 'निकल पड़ो, रास्ता खुद बनता है।', wps: 2.6, stress: ['रास्ता'] },

	// Gujarati.
	{ at: 36.4, text: 'મહેનત કરો, બાકીનું ભૂલી જાઓ.', wps: 2.6, stress: ['મહેનત'] },

	{ at: 39.6, text: 'Confidence comes from surviving failure.', wps: 2.7, stress: ['surviving'] },
	{ at: 42.6, text: 'Not from winning.', wps: 2.1, stress: ['winning'] },
];

const HARD_PUNCT = /[.!?\u0964]$/;
const SOFT_PUNCT = /[,;:]$/;

const bare = (token: string): string =>
	token.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

/**
 * Expands the script into word-level timings.
 *
 * Word duration scales with length, which is roughly how speech works and — more importantly —
 * gives the hero-word scorer a real "drawn out delivery" signal to read.
 */
export const buildDummyTranscript = (): TranscriptWord[] => {
	const out: TranscriptWord[] = [];
	let cursor = 0;

	for (let li = 0; li < SCRIPT.length; li++) {
		const line = SCRIPT[li];
		const wps = line.wps ?? 2.6;
		const tokens = line.text.split(/\s+/).filter((t) => t.length > 0);
		if (tokens.length === 0) continue;

		const stress: Record<string, true> = {};
		if (line.stress) {
			for (let i = 0; i < line.stress.length; i++) stress[bare(line.stress[i])] = true;
		}

		let t = Math.max(line.at, cursor);

		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			const letters = Math.max(1, bare(token).length);
			// 1/wps is the average; long words take proportionally longer.
			const duration = (1 / wps) * (0.55 + 0.45 * Math.min(2.2, letters / 5));

			const start = t;
			const end = start + duration;

			out.push({
				text: token.replace(/[.,;:!?\u0964]+$/g, ''),
				punctuated: token,
				start: Number(start.toFixed(3)),
				end: Number(end.toFixed(3)),
				emphasis: stress[bare(token)] ? 0.85 : 0,
			});

			t = end;
			if (HARD_PUNCT.test(token)) t += 0.24;
			else if (SOFT_PUNCT.test(token)) t += 0.12;
			else t += 0.02;
		}

		cursor = t;
	}

	return out;
};

export const DUMMY_TRANSCRIPT: TranscriptWord[] = buildDummyTranscript();

/** Total spoken length of the dummy transcript, in seconds. */
export const DUMMY_TRANSCRIPT_SECONDS: number =
	DUMMY_TRANSCRIPT.length > 0 ? DUMMY_TRANSCRIPT[DUMMY_TRANSCRIPT.length - 1].end : 0;
