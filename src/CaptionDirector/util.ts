/**
 * The two primitives the director needs, kept free of React, Remotion and the DOM.
 *
 * Separated out so `director.ts` — the phrasing, weighting and scheduling — has no runtime
 * dependency on anything browser-shaped. That means the plan for a clip can be computed
 * anywhere: in a node script, in a test, or upstream in the pipeline before a renderer exists.
 * Which is the point, because the plan is the part of this template worth checking.
 */

export const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

/**
 * FNV-1a, normalised to 0-1. Used wherever a choice should look arbitrary but must not drift:
 * which look a beat gets, which way a cascade leans. Derived from the phrase's own words, so
 * the same transcript always produces the same schedule and re-cutting one phrase does not
 * reshuffle every phrase after it.
 */
export const hash = (s: string) => {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0) / 4294967295;
};
