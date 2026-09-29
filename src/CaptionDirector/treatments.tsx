/**
 * The animators. Geometry is already solved by `layout.ts`, so everything here is a pure
 * function of the current frame — which is what makes the whole track seekable and identical
 * on every render.
 *
 * Two rules are shared by all five looks. Nothing carries a shadow, stroke or glow: legibility
 * comes from the dim and the scrim over the footage, so the letterforms stay clean. And every
 * entrance is masked rather than faded from nothing, because type that slides up from behind an
 * edge reads as placed, while type that materialises reads as a title card.
 */
import React from 'react';
import { Easing, interpolate } from 'remotion';
import { inkAnchor } from './metrics';
import type {
	CaptionDirectorTheme,
	CaptionDirectorTiming,
	PhraseLayout,
	PlacedRule,
	PlacedRun,
} from './types';

/** Fast out of the gate, slow into the last few pixels: arrives quickly, still settles calmly. */
const SETTLE = Easing.bezier(0.16, 1, 0.3, 1);

const ramp = (frame: number, at: number, dur: number, easing = SETTLE) =>
	interpolate(frame, [at, at + Math.max(1, dur)], [0, 1], {
		extrapolateLeft: 'clamp',
		extrapolateRight: 'clamp',
		easing,
	});

export type TreatmentViewProps = {
	layout: PhraseLayout;
	frame: number;
	theme: CaptionDirectorTheme;
	timing: CaptionDirectorTiming;
};

type RunProps = {
	run: PlacedRun;
	color: string;
	/** 0-1. Below 1 the run is masked and sitting below its final position. */
	rise?: number;
	opacity?: number;
	/** Extra vertical offset in px, applied after the rise */
	shiftY?: number;
	scale?: number;
	blur?: number;
	/** Clip from the right, 0-1, for a left-to-right draw-on */
	wipe?: number;
	transformOrigin?: string;
};

/**
 * One run of type, positioned so its ink top-left lands exactly on the solved point.
 *
 * The mask is clipped top and bottom only — `inset(-1px -45% 0 -45%)` — so the rise is hidden
 * while ink and blur still bleed sideways. Clipping all four sides would chop the overshoot off
 * an italic or a heavy `f` the moment it moved.
 */
const Run: React.FC<RunProps> = ({
	run,
	color,
	rise = 1,
	opacity = 1,
	shiftY = 0,
	scale = 1,
	blur = 0,
	wipe = 1,
	transformOrigin = '50% 100%',
}) => {
	const masked = rise < 1;
	const clip =
		wipe < 1
			? `inset(-12% ${((1 - wipe) * 100).toFixed(2)}% -12% -4%)`
			: masked
				? 'inset(-1px -45% 0px -45%)'
				: undefined;

	return (
		<div
			style={{
				position: 'absolute',
				left: run.x,
				top: run.y + shiftY,
				width: Math.ceil(run.ink.width) + 4,
				height: Math.ceil(run.ink.height) + 2,
				clipPath: clip,
				opacity,
				filter: blur > 0.2 ? `blur(${blur.toFixed(2)}px)` : undefined,
				transform: scale === 1 ? undefined : `scale(${scale.toFixed(4)})`,
				transformOrigin,
				willChange: 'transform, opacity',
				pointerEvents: 'none',
			}}
		>
			<div
				style={{
					position: 'relative',
					transform: masked ? `translateY(${((1 - rise) * 100).toFixed(3)}%)` : undefined,
				}}
			>
				<div
					style={{
						...inkAnchor(run.ink, { text: run.text, size: run.size, face: run.face }),
						color,
						WebkitFontSmoothing: 'antialiased',
						textRendering: 'geometricPrecision',
					}}
				>
					{run.text}
				</div>
			</div>
		</div>
	);
};

const Rule: React.FC<{ rule: PlacedRule; color: string; progress: number; opacity: number }> = ({
	rule,
	color,
	progress,
	opacity,
}) => (
	<div
		style={{
			position: 'absolute',
			left: rule.x,
			top: rule.y,
			width: rule.w,
			height: rule.h,
			backgroundColor: color,
			transform: `scaleX(${Math.max(0, progress).toFixed(4)})`,
			transformOrigin: rule.from === 'center' ? '50% 50%' : '0% 50%',
			opacity,
			pointerEvents: 'none',
		}}
	/>
);

/** Word state relative to the playhead. Drives colour in every look that tracks the audio. */
const stateOf = (layout: PhraseLayout, run: PlacedRun, frame: number) => {
	if (run.wordIndex < 0) return 'support' as const;
	const w = layout.phrase.words[run.wordIndex];
	if (!w) return 'support' as const;
	if (frame < w.startFrame) return 'pending' as const;
	if (frame >= w.endFrame) return 'spent' as const;
	return 'active' as const;
};

/** How far a run is clearing, 0-1. One value for the whole beat so it leaves as one object. */
const useExit = (layout: PhraseLayout, frame: number, out: number) =>
	ramp(frame, layout.outAt, out, Easing.in(Easing.quad));

// ---------------------------------------------------------------------------------------

const BaselineTrackView: React.FC<TreatmentViewProps> = ({ layout, frame, theme, timing }) => {
	const exit = useExit(layout, frame, timing.out);
	const { phrase } = layout;

	return (
		<>
			{layout.runs.map((run, i) => {
				// The line arrives as a line, staggered against the other line if there is one, so a
				// two-line phrase still reads as one movement.
				const at = phrase.startFrame + run.line * Math.min(timing.stagger, 3);
				const rise = ramp(frame, at, timing.wordIn + 3);
				const state = stateOf(layout, run, frame);

				const color =
					state === 'active'
						? run.hero
							? theme.palette.accent
							: theme.palette.ink
						: state === 'spent'
							? theme.palette.spent
							: theme.palette.pending;

				// A 3% lift and a 3.5% scale on the spoken word. Small enough that the line does not
				// appear to wobble, large enough that the eye is pulled to it without being told.
				const pop = state === 'active' ? ramp(frame, phrase.words[run.wordIndex].startFrame, 4) : 0;

				return (
					<Run
						key={i}
						run={run}
						color={color}
						rise={rise}
						opacity={1 - exit}
						shiftY={-run.ink.cap * 0.03 * pop}
						scale={1 + 0.035 * pop}
						blur={exit * run.size * 0.02}
					/>
				);
			})}
		</>
	);
};

// ---------------------------------------------------------------------------------------

const LitStackView: React.FC<TreatmentViewProps> = ({ layout, frame, theme, timing }) => {
	const exit = useExit(layout, frame, timing.out);
	const { phrase } = layout;

	// The tick is the only thing in this look that moves after the stack lands. It travels from
	// the previous line to the current one over four frames, so the eye is led down the stack
	// rather than having to find the newly-lit word for itself.
	const activeIdx = layout.runs.findIndex((r) => stateOf(layout, r, frame) === 'active');
	const tick = (() => {
		if (activeIdx < 0) return null;
		const cur = layout.runs[activeIdx];
		const prev = layout.runs[Math.max(0, activeIdx - 1)];
		const from = prev.y + prev.ink.height - prev.ink.cap;
		const to = cur.y + cur.ink.height - cur.ink.cap;
		const w = phrase.words[cur.wordIndex];
		const p = ramp(frame, w.startFrame, 4);
		return {
			y: from + (to - from) * p,
			h: cur.ink.cap,
			x: layout.box.x - cur.ink.cap * 0.42,
			w: Math.max(3, cur.ink.cap * 0.075),
		};
	})();

	return (
		<>
			{tick ? (
				<div
					style={{
						position: 'absolute',
						left: Math.round(tick.x),
						top: Math.round(tick.y),
						width: Math.round(tick.w),
						height: Math.round(tick.h),
						backgroundColor: theme.palette.accent,
						opacity: (1 - exit) * 0.9,
						pointerEvents: 'none',
					}}
				/>
			) : null}

			{layout.runs.map((run, i) => {
				const at = phrase.startFrame + run.line * timing.stagger;
				const rise = ramp(frame, at, timing.reveal);
				const state = stateOf(layout, run, frame);
				const color =
					state === 'active'
						? run.hero
							? theme.palette.accent
							: theme.palette.ink
						: state === 'spent'
							? theme.palette.spent
							: theme.palette.pending;

				// Out of focus for the first half of the rise. Cheap, and it does what a motion blur
				// does: tells the eye the type is moving rather than appearing.
				const focus = ramp(frame, at, timing.reveal * 0.55, Easing.out(Easing.quad));

				return (
					<Run
						key={i}
						run={run}
						color={color}
						rise={rise}
						opacity={(1 - exit) * ramp(frame, at, 4)}
						blur={(1 - focus) * run.size * 0.045 + exit * run.size * 0.03}
					/>
				);
			})}
		</>
	);
};

// ---------------------------------------------------------------------------------------

const SlamWordView: React.FC<TreatmentViewProps> = ({ layout, frame, theme, timing }) => {
	const exit = useExit(layout, frame, timing.out);
	const { phrase } = layout;
	const at = phrase.startFrame;

	const heroRun = layout.runs.find((r) => r.hero);
	const support = layout.runs.filter((r) => !r.hero);

	// Scaled down into place rather than up. Arriving oversized and shrinking onto its mark is
	// what reads as impact; growing into frame reads as a zoom.
	const land = ramp(frame, at, 7, Easing.out(Easing.cubic));
	const heroScale = 1.16 - 0.16 * land;
	// A copy of the word left behind and blown outwards as the real one lands. It is gone within
	// ten frames and is most of what sells the hit.
	const ghost = ramp(frame, at, 11, Easing.out(Easing.quad));

	return (
		<>
			{heroRun ? (
				<Run
					run={heroRun}
					color={theme.palette.accent}
					opacity={(1 - ghost) * 0.5 * (1 - exit)}
					scale={1 + 0.22 * ghost}
					blur={ghost * heroRun.size * 0.03}
					transformOrigin="50% 50%"
				/>
			) : null}

			{layout.rules.map((rule, i) => (
				<Rule
					key={`rule-${i}`}
					rule={rule}
					color={theme.palette.accent}
					progress={ramp(frame, at + 2, 9)}
					opacity={1 - exit}
				/>
			))}

			{heroRun ? (
				<Run
					run={heroRun}
					color={theme.palette.ink}
					opacity={ramp(frame, at, 2) * (1 - exit)}
					scale={heroScale}
					blur={(1 - land) * heroRun.size * 0.04 + exit * heroRun.size * 0.03}
					transformOrigin="50% 50%"
				/>
			) : null}

			{support.map((run, i) => (
				<Run
					key={`s-${i}`}
					run={run}
					color={theme.palette.spent}
					rise={ramp(frame, at + 6, timing.reveal)}
					opacity={(1 - exit) * ramp(frame, at + 6, 5)}
				/>
			))}
		</>
	);
};

// ---------------------------------------------------------------------------------------

const RibbonTailView: React.FC<TreatmentViewProps> = ({ layout, frame, theme, timing }) => {
	const exit = useExit(layout, frame, timing.out);
	const { phrase } = layout;
	const at = phrase.startFrame;

	const heroAt = at + timing.stagger;
	const ruleAt = heroAt + Math.round(timing.reveal * 0.6);
	const tailAt = ruleAt + 4;

	return (
		<>
			{layout.runs.map((run, i) => {
				if (run.hero) {
					const state = stateOf(layout, run, frame);
					return (
						<Run
							key={i}
							run={run}
							// Held at full ink before it is spoken — it is the subject of the composition,
							// not a word waiting its turn — and it takes the accent on the syllable.
							color={state === 'active' ? theme.palette.accent : theme.palette.ink}
							rise={ramp(frame, heroAt, timing.reveal)}
							opacity={(1 - exit) * ramp(frame, heroAt, 4)}
							blur={exit * run.size * 0.03}
						/>
					);
				}

				// The serif tail is drawn on left to right, the way it is read. The sans lead-in above
				// just rises, so the two supporting parts do not compete for attention.
				const isTail = run.face === 'serif';
				return (
					<Run
						key={i}
						run={run}
						// The tail is real text the viewer is meant to read, so it gets full ink — it is
						// already separated from the hero by face and size, and dimming it as well made
						// it marginal against a busy shot. The lead-in stays held back: it is context,
						// and it has been on screen since before the hero landed.
						color={isTail ? theme.palette.ink : theme.palette.spent}
						rise={isTail ? 1 : ramp(frame, at, timing.reveal)}
						wipe={isTail ? ramp(frame, tailAt, 12) : 1}
						opacity={(1 - exit) * ramp(frame, isTail ? tailAt : at, 4)}
					/>
				);
			})}

			{layout.rules.map((rule, i) => (
				<Rule
					key={`rule-${i}`}
					rule={rule}
					color={theme.palette.accent}
					progress={ramp(frame, ruleAt, 10)}
					opacity={(1 - exit) * 0.8}
				/>
			))}
		</>
	);
};

// ---------------------------------------------------------------------------------------

const CascadeView: React.FC<TreatmentViewProps> = ({ layout, frame, theme, timing }) => {
	const exit = useExit(layout, frame, timing.out);
	const { phrase } = layout;

	return (
		<>
			{layout.runs.map((run, i) => {
				const w = phrase.words[run.wordIndex];
				// Each word lands on its own timestamp. That is the whole look — the stair is built
				// at the speed the sentence is spoken, so the composition is the delivery.
				const at = w ? w.startFrame : phrase.startFrame;
				const land = ramp(frame, at, Math.max(5, timing.reveal - 2));
				const state = stateOf(layout, run, frame);

				const color =
					state === 'active'
						? run.hero
							? theme.palette.accent
							: theme.palette.ink
						: state === 'spent'
							? theme.palette.spent
							: theme.palette.pending;

				return (
					<Run
						key={i}
						run={run}
						color={color}
						// Dropped from above rather than risen from below: the words are falling down
						// the frame, so their entrance has to agree with the direction of the stack.
						shiftY={-(1 - land) * run.ink.cap * 0.42}
						opacity={(1 - exit) * ramp(frame, at, 3)}
						scale={1 + 0.04 * (1 - land)}
						blur={(1 - land) * run.size * 0.03 + exit * run.size * 0.025}
						transformOrigin="50% 50%"
					/>
				);
			})}
		</>
	);
};

// ---------------------------------------------------------------------------------------

const VIEWS: Record<PhraseLayout['treatment'], React.FC<TreatmentViewProps>> = {
	baseline: BaselineTrackView,
	lit: LitStackView,
	slam: SlamWordView,
	ribbon: RibbonTailView,
	cascade: CascadeView,
};

export const TreatmentView: React.FC<TreatmentViewProps> = (props) => {
	const View = VIEWS[props.layout.treatment] ?? BaselineTrackView;
	return <View {...props} />;
};
