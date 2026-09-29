/**
 * Caption Engine — varied typography-lab transcript.
 *
 * This is intentionally unrelated to the original judge/tolerant script. Each sentence isolates a
 * different layout pressure so a handful of stills reveals more than watching one friendly phrase:
 *
 * - high-impact hero at the beginning, middle and end
 * - one helper side and both helper sides
 * - long helper text that needs density fitting and word splitting
 * - heroes with ascenders, descenders, both, and a completely open lower edge
 * - emotional, motivational, informational and Roman Hinglish language
 * - an overlong word that must degrade to the flat safety layout
 *
 * Timings are generated deterministically. "Random" here means varied test content, not
 * `Math.random()` — a preview has to remain identical every time it is opened.
 */

import { TranscriptWord } from './types';

interface LabLine {
	at: number;
	text: string;
	/** Spoken words per second. */
	wps: number;
	/** Bare lowercase tokens that receive a strong upstream-like emphasis signal. */
	stress: string[];
}

const LAB_SCRIPT: LabLine[] = [
	{
		at: 0.4,
		text: 'Discipline creates real freedom.',
		wps: 2.25,
		stress: ['discipline'],
	},
	{
		at: 3.2,
		text: 'Choose courage over comfort.',
		wps: 2.35,
		stress: ['courage'],
	},
	{
		at: 5.9,
		text: 'Quiet habits build unstoppable confidence.',
		wps: 2.65,
		stress: ['confidence'],
	},
	{
		at: 8.9,
		text: 'Your fear is not authority.',
		wps: 2.4,
		stress: ['fear'],
	},
	{
		at: 11.6,
		text: 'Kamyabi se pehle himmat aati hai.',
		wps: 2.85,
		stress: ['himmat'],
	},
	{
		at: 14.5,
		text: 'Rejection quietly redirects your future.',
		wps: 2.6,
		stress: ['rejection'],
	},
	{
		at: 17.4,
		text: 'Protect your focus from noise.',
		wps: 2.55,
		stress: ['focus'],
	},
	{
		at: 20.1,
		text: 'The internet rewards clear attention.',
		wps: 2.55,
		stress: ['attention'],
	},
	{
		at: 23.0,
		text: 'One decision can change everything.',
		wps: 2.35,
		stress: ['decision'],
	},
	{
		at: 25.9,
		text: 'Pain introduced your hidden strength.',
		wps: 2.5,
		stress: ['strength'],
	},
	{
		at: 28.8,
		text: 'Build quietly. Let success speak.',
		wps: 2.35,
		stress: ['build', 'success'],
	},
	{
		at: 32.1,
		text: 'Your family remembers your presence.',
		wps: 2.45,
		stress: ['family'],
	},
	{
		at: 35.0,
		text: 'Truth survives every performance.',
		wps: 2.3,
		stress: ['truth'],
	},
	{
		at: 37.8,
		text: 'Small habits shape massive outcomes.',
		wps: 2.55,
		stress: ['habits'],
	},
	{
		at: 40.6,
		text: 'Freedom starts after approval ends.',
		wps: 2.4,
		stress: ['freedom'],
	},
	{
		at: 43.6,
		text: 'Nobody sees the nights you survived.',
		wps: 2.7,
		stress: ['survived'],
	},
	{
		at: 46.5,
		text: 'Data without context creates confident mistakes.',
		wps: 2.75,
		stress: ['context'],
	},
	{
		at: 49.5,
		text: 'Purpose makes sacrifice meaningful.',
		wps: 2.25,
		stress: ['purpose'],
	},
	{
		at: 52.4,
		text: 'Transformation requires responsibility.',
		wps: 2.05,
		stress: ['transformation'],
	},
];

const bare = (token: string): string =>
	token.toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, '');

export const buildTypographyLabTranscript = (): TranscriptWord[] => {
	const words: TranscriptWord[] = [];
	let cursor = 0;

	for (let lineIndex = 0; lineIndex < LAB_SCRIPT.length; lineIndex++) {
		const line = LAB_SCRIPT[lineIndex];
		const tokens = line.text.split(/\s+/).filter((token) => token.length > 0);
		const stressed = new Set(line.stress.map(bare));
		let time = Math.max(line.at, cursor);

		for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex++) {
			const token = tokens[tokenIndex];
			const normalized = bare(token);
			const letters = Math.max(1, Array.from(normalized).length);
			// Longer words take longer, but sub-linearly; close to deliberate natural speech.
			const duration = (1 / line.wps) * (0.58 + 0.42 * Math.min(2.15, letters / 5));
			const start = time;
			const end = start + duration;

			words.push({
				text: token.replace(/[.,;:!?]+$/g, ''),
				punctuated: token,
				start: Number(start.toFixed(3)),
				end: Number(end.toFixed(3)),
				emphasis: stressed.has(normalized) ? 0.92 : 0,
			});

			time = end + (/[.!?]$/.test(token) ? 0.24 : /[,;:]$/.test(token) ? 0.12 : 0.025);
		}

		cursor = time;
	}

	return words;
};

export const TYPOGRAPHY_LAB_TRANSCRIPT = buildTypographyLabTranscript();

export const TYPOGRAPHY_LAB_SECONDS =
	TYPOGRAPHY_LAB_TRANSCRIPT.length === 0
		? 0
		: TYPOGRAPHY_LAB_TRANSCRIPT[TYPOGRAPHY_LAB_TRANSCRIPT.length - 1].end;
