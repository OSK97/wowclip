import type { Palette } from './types';

/**
 * Five palettes, and four of them are nearly monochrome on purpose.
 *
 * The emphasis in this template is carried by size, weight and light — not by hue. A caption
 * track that changes colour every few seconds reads as a tool's output; one that stays a
 * single colour and changes scale reads as an edit. `accent` exists for the one or two frames
 * in a clip where a colour genuinely helps, and in `bone` it is deliberately still white.
 *
 * `pending` sits lower than `spent`: a word that has not been said yet should be quieter than
 * one that has, so the eye is pulled forward through the line rather than back over it.
 */
export const PALETTES: Record<string, Palette> = {
	/** No colour at all. The one to reach for by default — nothing to get wrong. */
	bone: {
		ink: '#ffffff',
		spent: 'rgba(255,255,255,0.46)',
		pending: 'rgba(255,255,255,0.26)',
		accent: '#ffffff',
		onAccent: '#0a0a0a',
	},
	/** A single hot red on the hero word. Reads as anger or urgency. */
	ember: {
		ink: '#ffffff',
		spent: 'rgba(255,255,255,0.42)',
		pending: 'rgba(255,255,255,0.22)',
		accent: '#ff3b2f',
		onAccent: '#ffffff',
	},
	/** Electric yellow, the reel-app signature. Loud; use it on fast, punchy clips. */
	acid: {
		ink: '#ffffff',
		spent: 'rgba(255,255,255,0.44)',
		pending: 'rgba(255,255,255,0.24)',
		accent: '#e2fb00',
		onAccent: '#0a0a0a',
	},
	/** Warm and expensive-looking. Suits slow, spoken-quietly lines. */
	gold: {
		ink: '#fdf8f0',
		spent: 'rgba(253,248,240,0.44)',
		pending: 'rgba(253,248,240,0.22)',
		accent: '#e8b44a',
		onAccent: '#14100a',
	},
	/** Cold and clinical. Good for reality-check and money lines. */
	ice: {
		ink: '#f4fbff',
		spent: 'rgba(244,251,255,0.42)',
		pending: 'rgba(244,251,255,0.22)',
		accent: '#7dd3fc',
		onAccent: '#04131c',
	},
};

export const resolvePalette = (name?: string, override?: Partial<Palette>): Palette => ({
	...(PALETTES[name ?? 'bone'] ?? PALETTES.bone),
	...override,
});
