import { AdaptiveCaptionChunk, AdaptiveCaptionWord, CaptionPlacement } from './types';
import rawTranscript from '../transcript.json';
import personTrackingData from '../person_tracking.json';

// Character width heuristic ratio (bold uppercase ~0.62, cursive italic ~0.50)
export const estimateWordWidth = (word: string, size: number, isItalic: boolean): number => {
	const ratio = isItalic ? 0.50 : 0.62;
	return Math.ceil(word.length * size * ratio);
};

export interface BuildChunksOptions {
	fps: number;
	screenW: number;
	screenH: number;
	mediaScale?: number;
	mediaOffsetY?: number;
	videoAspect?: number;
	creativeRatio?: number;
}

export const buildAdaptiveChunks = ({
	fps,
	screenW,
	screenH,
	mediaOffsetY = 0,
}: BuildChunksOptions): AdaptiveCaptionChunk[] => {
	const wordsList: AdaptiveCaptionWord[] = (rawTranscript as any[]).map((w) => ({
		text: w.text || '',
		punctuated: w.punctuated || w.text || '',
		start: w.start,
		end: w.end,
		startFrame: Math.round(w.start * fps),
		endFrame: Math.round(w.end * fps),
	}));

	// 1. Group transcript words into natural 2-3 word phrases (respecting hard punctuation)
	const groupedWords: AdaptiveCaptionWord[][] = [];
	let currentGroup: AdaptiveCaptionWord[] = [];

	for (let i = 0; i < wordsList.length; i++) {
		const word = wordsList[i];
		currentGroup.push(word);

		const isHardPunct = /[.?!]/.test(word.punctuated);
		const isComma = /[,]/.test(word.punctuated);
		const nextWord = wordsList[i + 1];
		const nextIsHardPunct = nextWord ? /[.?!]/.test(nextWord.punctuated) : false;
		const nextIsComma = nextWord ? /[,]/.test(nextWord.punctuated) : false;
		const pause = nextWord ? nextWord.start - word.end : 1;

		if (isHardPunct) {
			groupedWords.push(currentGroup);
			currentGroup = [];
		} else if (isComma) {
			groupedWords.push(currentGroup);
			currentGroup = [];
		} else if (currentGroup.length === 2 && !nextIsHardPunct && !nextIsComma && pause > 0.3) {
			groupedWords.push(currentGroup);
			currentGroup = [];
		} else if (currentGroup.length >= 3) {
			// If next word finishes a clause with punctuation, absorb it to keep quotes standalone
			if (nextWord && (nextIsHardPunct || nextIsComma) && currentGroup.length === 3) {
				currentGroup.push(nextWord);
				i++;
			}
			groupedWords.push(currentGroup);
			currentGroup = [];
		}
	}

	if (currentGroup.length > 0) {
		if (
			currentGroup.length === 1 &&
			groupedWords.length > 0 &&
			groupedWords[groupedWords.length - 1].length <= 3
		) {
			groupedWords[groupedWords.length - 1].push(...currentGroup);
		} else {
			groupedWords.push(currentGroup);
		}
	}

	// 2. Safe padding constraints inside CRT frame
	const safePadX = Math.round(screenW * 0.075); // ~71px on 950w

	return groupedWords.map((group, idx) => {
		const startFrame = group[0].startFrame;
		const endFrame = group[group.length - 1].endFrame + 8;

		const words = group.map((w) => w.punctuated);
		const text = words.join(' ');
		const maxWordLen = Math.max(...words.map((w) => w.replace(/[^a-zA-Z]/g, '').length));

		// STRICT RULE: Only short, punchy 2-3 word quotes qualify for creative side placement
		// All longer phrases and complex sentences go to the general bottom subtitle!
		// Increase percentage of creative text: any short phrase (1-4 words) with reasonable word lengths
		const isShort = group.length >= 1 && group.length <= 4;
		const isCompactWords = maxWordLen <= 9;
		// Ensure 50% of captions go to the general 'bottom' placement
		const isCreative = isShort && isCompactWords && (idx % 2 === 0);
		let placement: CaptionPlacement = 'bottom';
		if (isCreative) {
			placement = (idx % 4 === 0) ? 'empty-anchor' : 'empty-right';
		}

		let slotX: number;
		let slotY: number;
		let slotWidth: number;
		let maxHeight: number;
		let textAlign: 'left' | 'center' | 'right';
		let baseFontSize: number;
		let accentFontSize: number;

		if (placement === 'bottom') {
			// GENERAL BOTTOM PLACEMENT
			// Centered horizontally, positioned directly over the CRT bottom shadow area
			slotX = safePadX;
			slotWidth = screenW - 2 * safePadX;
			slotY = screenH - Math.round(screenH * 0.14);
			maxHeight = Math.round(screenH * 0.14);
			textAlign = 'center';

			baseFontSize = Math.min(80, Math.max(60, Math.round(screenW * 0.082))); // ~78px on 950w
			accentFontSize = baseFontSize;
		} else {
			// CREATIVE EMPTY-SPACE PLACEMENT (Hero-sized, bold viral quote style)
			const trackingList = (personTrackingData as any).tracking || [];
			const validFrame = Math.max(0, Math.min(startFrame, trackingList.length - 1));
			const personInfo = trackingList[validFrame];

			const headBox = personInfo?.head || personInfo?.box;
			const headX = headBox ? Math.round(screenW * (headBox.x + (headBox.w || headBox.width || 0) / 2)) : Math.round(screenW * 0.5);
			const headY = headBox ? Math.round(screenH * headBox.y) : Math.round(screenH * 0.3);

			let avgHeadRight = 0.51;
			let avgHeadLeft = 0.49;

			if (personInfo && personInfo.head) {
				avgHeadRight = personInfo.head.x + personInfo.head.w;
				avgHeadLeft = personInfo.head.x;
			} else if (personInfo && personInfo.box) {
				avgHeadRight = personInfo.box.x + personInfo.box.w;
				avgHeadLeft = personInfo.box.x;
			}

			const pixelHeadRight = Math.round(screenW * avgHeadRight);
			const pixelHeadLeft = Math.round(screenW * avgHeadLeft);

			if (placement === 'empty-anchor') {
				// AnchorStack needs wide slots to avoid aggressively shrinking long words.
				const useRight = (headX < screenW * 0.5);
				if (useRight) {
					const safeX = headX + Math.round((headBox?.w || headBox?.width || 0) * screenW * 0.35); // generous overlap
					slotX = Math.max(safeX, Math.round(screenW * 0.40));
					slotY = Math.max(mediaOffsetY + Math.round(screenH * 0.15), headY);
					slotWidth = Math.round(screenW * 0.95) - slotX;
				} else {
					slotX = Math.round(screenW * 0.05);
					slotY = Math.max(mediaOffsetY + Math.round(screenH * 0.15), headY);
					const safeMaxX = headX + Math.round((headBox?.w || headBox?.width || 0) * screenW * 0.2); // generous overlap
					slotWidth = safeMaxX - slotX;
				}
				textAlign = 'center';
			} else if (placement === 'empty-right') {
				slotX = pixelHeadRight + Math.round(screenW * 0.05);
				slotY = Math.max(mediaOffsetY + Math.round(screenH * 0.15), headY);
				slotWidth = Math.round(screenW * 0.95) - slotX;
				textAlign = 'center';
			} else { // empty-left
				slotX = Math.round(screenW * 0.05);
				slotY = Math.max(mediaOffsetY + Math.round(screenH * 0.15), headY);
				slotWidth = pixelHeadLeft - Math.round(screenW * 0.05) - slotX;
				textAlign = 'center';
			}

			maxHeight = Math.round(screenH * 0.52);
			baseFontSize = Math.min(76, Math.max(62, Math.round(screenW * 0.078)));
			accentFontSize = Math.min(70, Math.max(56, Math.round(screenW * 0.070)));

			const longestWord = group.reduce((a, b) => (b.punctuated.length > a.length ? b.punctuated : a), '');
			// Estimate width using a heavy bold ratio for the hero word
			const longestEst = estimateWordWidth(longestWord.toUpperCase(), baseFontSize, false);
			
			if (placement === 'empty-anchor' && longestEst > slotWidth * 0.95) {
				// The word is too long for the side slot and will be shrunk to a tiny size.
				// As requested by user, fallback to 'general' (bottom) placement.
				placement = 'bottom';
				slotX = safePadX;
				slotWidth = screenW - 2 * safePadX;
				slotY = screenH - Math.round(screenH * 0.14);
				maxHeight = Math.round(screenH * 0.14);
				textAlign = 'center';
				baseFontSize = Math.min(80, Math.max(60, Math.round(screenW * 0.082)));
				accentFontSize = baseFontSize;
			} else if (longestEst > slotWidth - 20) {
				const scale = (slotWidth - 20) / longestEst;
				baseFontSize = Math.max(42, Math.round(baseFontSize * scale));
				accentFontSize = Math.max(38, Math.round(accentFontSize * scale));
			}
		}

		return {
			id: idx,
			words: group,
			startFrame,
			endFrame,
			placement,
			slot: {
				x: slotX,
				y: slotY,
				width: slotWidth,
				maxHeight,
				textAlign,
			},
			fontSize: baseFontSize,
			accentFontSize,
		};
	});
};
