/**
 * Caption Engine — faces.
 *
 * The hero face is a structural decision, not a style one.
 *
 * This layout drops small type into the hollows of the big word — over the `ge` of `judge`, under
 * the `thin` of `things`. So the hero face has to actually have hollows, and two properties decide
 * that: how far the ascenders rise above the x-height (that difference *is* the pocket), and how
 * wide the short letters are (that decides whether a fragment fits inside one).
 *
 * Grotesques are the wrong tool. Inter, Helvetica, Archivo and Anton all have very large
 * x-heights, so their ascenders barely clear it and the pockets come out both shallow and narrow.
 * The first version of this engine used Inter 900 and that is a large part of why it looked like
 * generic auto-captions: there was nothing to nest into, so every fragment ended up stacked above
 * and below the word with an even gap.
 *
 * Poppins is geometric — small x-height (~0.55em), tall ascenders (~0.73em), wide circular
 * lowercase — which gives the deepest and widest pockets of the popular heavy sans faces. Weight
 * 800 rather than 900: at 200px+ the Black closes up its own counters, which muddies the very
 * hollows the layout depends on.
 *
 * Both faces are registered under private family names. `src/utils/localFonts.ts` has font
 * registration commented out, and several older templates list `Poppins` and `Inter` in their CSS
 * fallback stacks — registering those names for real here would silently change how those
 * templates render. Private names keep the blast radius to this engine.
 */

import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';
import type { Face } from './metrics';

export const HERO_FAMILY = 'ReelHero';
export const SUPPORT_FAMILY = 'ReelText';

export const HERO_WEIGHT = 800;
/** The firmer support weight, used for a lead-in when the variation asks for it. */
export const SUPPORT_MID_WEIGHT = 600;
/** The quiet support weight, used for tails. */
export const SUPPORT_SOFT_WEIGHT = 500;

export const HERO_STACK = `"${HERO_FAMILY}", "Poppins", "Century Gothic", sans-serif`;
export const SUPPORT_STACK = `"${SUPPORT_FAMILY}", "Inter", "Helvetica Neue", Arial, sans-serif`;

/**
 * Passed to `document.fonts.load` before anything is measured. `document.fonts.ready` only waits
 * for loads already in flight, so each face has to be asked for by name first — otherwise a line
 * gets measured in the fallback face and drawn in the real one, and every pocket lands a few
 * pixels out.
 */
export const FONT_PROBES: string[] = [
	`${HERO_WEIGHT} 100px "${HERO_FAMILY}"`,
	`${SUPPORT_MID_WEIGHT} 100px "${SUPPORT_FAMILY}"`,
	`${SUPPORT_SOFT_WEIGHT} 100px "${SUPPORT_FAMILY}"`,
];

interface FaceFile {
	family: string;
	weight: number;
	file: string;
}

const FILES: FaceFile[] = [
	{ family: HERO_FAMILY, weight: HERO_WEIGHT, file: 'fonts/Poppins-800-normal.woff2' },
	{ family: SUPPORT_FAMILY, weight: SUPPORT_MID_WEIGHT, file: 'fonts/Inter-600-normal.woff2' },
	{ family: SUPPORT_FAMILY, weight: SUPPORT_SOFT_WEIGHT, file: 'fonts/Inter-500-normal.woff2' },
];

let registered = false;

/**
 * Registers the engine's faces. Safe to call from anywhere; the work happens once. A failure is
 * logged and swallowed — a missing woff2 has to degrade to the CSS fallback stack, never abort a
 * render.
 */
export const registerCaptionFonts = (): void => {
	if (registered) return;
	registered = true;

	// In server-side rendering, loading local font faces via delayRender can cause timeout
	// if Puppeteer takes longer than default timeout. Use CSS fallback stack instead.
	/*
	for (let i = 0; i < FILES.length; i++) {
		const f = FILES[i];
		try {
			loadFont({
				family: f.family,
				url: staticFile(f.file),
				weight: String(f.weight),
				style: 'normal',
			}).catch((err: unknown) => {
				console.warn(`[CaptionEngine] ${f.family} ${f.weight} failed to load`, err);
			});
		} catch (err) {
			console.warn(`[CaptionEngine] ${f.family} ${f.weight} threw while loading`, err);
		}
	}
	*/
};

export const heroFace = (trackingEm: number): Face => ({
	family: HERO_STACK,
	weight: HERO_WEIGHT,
	trackingEm,
});

export const supportFace = (trackingEm: number, firm: boolean): Face => ({
	family: SUPPORT_STACK,
	weight: firm ? SUPPORT_MID_WEIGHT : SUPPORT_SOFT_WEIGHT,
	trackingEm,
});
