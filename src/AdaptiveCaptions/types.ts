export type CaptionPlacement = 'bottom' | 'empty-right' | 'empty-left' | 'empty-anchor';

export interface AdaptiveCaptionWord {
	text: string;
	punctuated: string;
	start: number;
	end: number;
	startFrame: number;
	endFrame: number;
}

export interface AdaptiveChunkSlot {
	x: number;
	y: number;
	width: number;
	maxHeight: number;
	textAlign: 'left' | 'center' | 'right';
}

export interface AdaptiveCaptionChunk {
	id: number;
	words: AdaptiveCaptionWord[];
	startFrame: number;
	endFrame: number;
	placement: CaptionPlacement;
	slot: AdaptiveChunkSlot;
	fontSize: number;
	accentFontSize: number;
}

export interface AdaptiveCaptionsProps {
	frame: number;
	screenW: number;
	screenH: number;
	mediaScale?: number;
	mediaOffsetY?: number;
	videoAspect?: number;
	creativeRatio?: number; // e.g. 0.4 for ~40% creative empty space, 60% bottom
	showDebugSlot?: boolean;
	cursiveFont?: string;
	boldFont?: string;
	primaryColor?: string;
	/** Frame ranges [start, end][] where adaptive captions should completely hide */
	blackoutRanges?: [number, number][];
}
