import React from 'react';
import { getPenPosition } from '../AestheticNews/AestheticHighlighter';

export interface DocumentBlock {
  type: "heading" | "bold" | "normal" | "separator" | "spacer";
  content: string;
}

export interface HighlightInstruction {
  fromWord: number;
  toWord: number;
  startFrame: number;
  endFrame: number;
  cameraMode?: "auto" | "wide";
  wordDurations?: number | string | number[];
  speedMultiplier?: number;
  forceZoom?: boolean;
  highlightColor?: string;
}

interface Props {
  blocks: DocumentBlock[];
  script: { instructions: HighlightInstruction[] };
  frame: number;
  fontSize: number;
  lineHeight: number;
  color: string;
  accentColor: string;
  idPrefix?: string;
  wordOffset?: number; // Start counting global words from this offset
}

export const GovernmentHighlighter: React.FC<Props> = ({
  blocks,
  script,
  frame,
  fontSize,
  lineHeight,
  color,
  accentColor,
  idPrefix = "highlight-word-",
  wordOffset = 0,
}) => {
  // Force accentColor to be opaque to prevent double-transparency overlapping lines
  const opaqueAccent = accentColor.startsWith("rgba")
    ? accentColor.replace(/[\d.]+\)$/, "1)")
    : accentColor;

  const instructionFills = (script?.instructions || []).map((inst: HighlightInstruction) => {
    const penPosition = getPenPosition(inst, frame);
    return {
      inst,
      penPosition,
    };
  });

  let globalWordIndex = wordOffset;

  return (
    <div style={{ fontSize, lineHeight, color, width: '100%', textAlign: 'justify' }}>
      {blocks.map((block, blockIdx) => {
        if (block.type === "separator") {
          return (
            <div
              key={`block-${blockIdx}`}
              style={{
                width: '100%',
                height: '2px',
                backgroundColor: '#333',
                margin: '15px 0',
              }}
            />
          );
        }

        if (block.type === "spacer") {
          return <div key={`block-${blockIdx}`} style={{ height: '34px' }} />;
        }

        const isHeading = block.type === "heading";
        const isBold = block.type === "bold" || isHeading;
        const blockFontWeight = isBold ? 'bold' : 'normal';
        const blockFontSize = isHeading ? fontSize * 1.15 : fontSize;
        const blockTextAlign = isHeading ? 'center' : 'justify';
        
        const lines = block.content.split('\n');

        return (
          <div
            key={`block-${blockIdx}`}
            style={{
              marginBottom: '34px', // Standard paragraph gap in GovernmentDocument
              textAlign: blockTextAlign as "center" | "justify",
              fontWeight: blockFontWeight,
              fontSize: blockFontSize,
            }}
          >
            {lines.map((lineContent, lineIdx) => {
              const words = lineContent.split(/\s+/);
              return (
                <div key={`line-${lineIdx}`} style={{ minHeight: lineContent.trim() ? 'auto' : '34px' }}>
                  {words.map((word) => {
                    if (!word) return null;
                    
                    const currentWordIndex = globalWordIndex++;
                    const fillData = instructionFills.find((f) => currentWordIndex >= f.inst.fromWord && currentWordIndex <= f.inst.toWord);

                    if (!fillData) {
                      return (
                        <span key={currentWordIndex} id={`${idPrefix}${currentWordIndex}`} style={{ verticalAlign: 'baseline', display: 'inline' }}>
                          {word}{' '}
                        </span>
                      );
                    }

                    const wordIndexInHighlight = currentWordIndex - fillData.inst.fromWord;
                    let wordFill = (fillData.penPosition - wordIndexInHighlight) * 100;
                    wordFill = Math.max(0, Math.min(100, wordFill));
                    
                    const isFirstWord = currentWordIndex === fillData.inst.fromWord;
                    const isLastWord = currentWordIndex === fillData.inst.toWord;

                    // Standard square highlighter for Government Redaction look
                    let bRadius = "0px";
                    let pad = "4px 0";
                    
                    // Give extra space if not highlighting the whole word perfectly
                    if (isFirstWord && isLastWord) {
                      bRadius = "255px 15px 225px 15px/15px 225px 15px 255px";
                      pad = "4px 8px";
                    } else if (isFirstWord) {
                      bRadius = "255px 0px 0px 15px/15px 0px 0px 255px";
                      pad = "4px 0 4px 8px";
                    } else if (isLastWord) {
                      bRadius = "0px 15px 225px 0px/0px 225px 15px 0px";
                      pad = "4px 8px 4px 0";
                    }

                    return (
                      <React.Fragment key={currentWordIndex}>
                        <span
                          id={`${idPrefix}${currentWordIndex}`}
                          style={{
                            position: 'relative',
                            display: 'inline-block',
                            margin: '0 -0.8px',
                            backgroundImage: wordFill > 0 ? `linear-gradient(to right, ${opaqueAccent} 0%, ${opaqueAccent} 100%)` : 'none',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'left center',
                            backgroundSize: wordFill === 100 && !isLastWord ? '115% 100%' : `${wordFill}% 100%`,
                            borderRadius: bRadius,
                            padding: pad,
                            whiteSpace: 'pre',
                          }}
                        >
                          <span style={{ color: wordFill > 50 ? '#000' : color }}>
                            {word}{isLastWord ? '' : ' '}
                          </span>
                        </span>
                        {isLastWord ? ' ' : ''}
                      </React.Fragment>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};
