/**
 * Faces for the CaptionDirector, registered under private family names.
 *
 * Private names on purpose. This folder is meant to be dropped into other Remotion projects
 * unchanged, and those projects load their own Poppins/Inter from elsewhere — @fontsource,
 * a Google URL, whatever. Two `@font-face` rules claiming the same family and weight in one
 * bundle is a coin flip over which file wins, and since every treatment here is composed
 * against measured glyph boxes, losing that coin flip moves every edge in the layout. Under
 * its own name the director always measures and draws the same file.
 *
 * This is the ONLY file that differs between projects — it points at that project's
 * `public/fonts` paths. Everything else in the folder is portable as-is.
 */
import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';

export const CD_SANS = 'CDSans';
export const CD_SERIF = 'CDSerif';

/** Geometric sans with a small x-height and tall ascenders, in three weights. */
export const SANS_STACK = `"${CD_SANS}", "Poppins", "Century Gothic", sans-serif`;
/** The one serif, italic only. It is an accent, never a body face. */
export const SERIF_STACK = `"${CD_SERIF}", "Playfair Display", Georgia, serif`;

export const W_HEAVY = 800;
export const W_MEDIUM = 600;
export const W_LIGHT = 400;

const register = (family: string, path: string, weight: number, style: 'normal' | 'italic') => {
	// Swallowed rather than thrown: a missing file should fall back to the next face in the
	// stack and still render, because a caption track that renders in Poppins-instead-of-
	// nothing is recoverable and a crashed 40-minute Lambda render is not.
	loadFont({ family, url: staticFile(path), weight: String(weight), style, format: 'woff2' }).catch(
		() => undefined,
	);
};

register(CD_SANS, 'fonts/Poppins/poppins-latin-800-normal.woff2', W_HEAVY, 'normal');
register(CD_SANS, 'fonts/Poppins/poppins-latin-600-normal.woff2', W_MEDIUM, 'normal');
register(CD_SANS, 'fonts/Poppins/poppins-latin-400-normal.woff2', W_LIGHT, 'normal');
register(
	CD_SERIF,
	'fonts/playfair-display/playfair-display-latin-400-italic.woff2',
	W_LIGHT,
	'italic',
);

/** Named roles, so a treatment asks for `heavy` rather than for a weight number. */
export type FaceName = 'heavy' | 'medium' | 'light' | 'serif';

export const FACES: Record<
	FaceName,
	{ family: string; weight: number; italic: boolean; tracking: string }
> = {
	// Tight. That tightness is most of what makes a word look set rather than typed.
	heavy: { family: SANS_STACK, weight: W_HEAVY, italic: false, tracking: '-0.035em' },
	medium: { family: SANS_STACK, weight: W_MEDIUM, italic: false, tracking: '-0.015em' },
	light: { family: SANS_STACK, weight: W_LIGHT, italic: false, tracking: '-0.005em' },
	// Playfair italic is already narrow; tracking it in closes the joins.
	serif: { family: SERIF_STACK, weight: W_LIGHT, italic: true, tracking: '0.005em' },
};

/**
 * Passed to `document.fonts.load` before anything is measured. `document.fonts.ready` only
 * waits for loads already in flight, so each face has to be asked for by name first —
 * otherwise a line gets measured in the fallback and drawn in the real face, and every
 * position in the layout lands a few pixels out.
 */
export const FONT_PROBES = [
	`${W_HEAVY} 100px "${CD_SANS}"`,
	`${W_MEDIUM} 100px "${CD_SANS}"`,
	`${W_LIGHT} 100px "${CD_SANS}"`,
	`italic ${W_LIGHT} 100px "${CD_SERIF}"`,
];
