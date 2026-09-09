import React from "react";
import { FocusLineConfig, TypographyConfig, GlobalFocusConfig, PageTransform } from "./types";
import { MarkerHighlight } from "./MarkerHighlight";

interface FocusLineProps {
  config: FocusLineConfig;
  typography: TypographyConfig;
  focus: GlobalFocusConfig;
  pageTransform: PageTransform;
  compositionWidth: number;
  compositionHeight: number;
  seed: number;
}

export const FocusLine: React.FC<FocusLineProps> = ({
  config,
  typography,
  focus,
  pageTransform,
  compositionWidth,
  compositionHeight,
  seed,
}) => {
  // We dampen the page's scale and rotation so it doesn't jump wildly off-center
  const focusScale = 1.0 + (pageTransform.scale - 1.0) * 0.5; 
  const focusRotate = pageTransform.rotate * 0.3;

  // Use the EXACT SAME typography as the current newspaper page so it blends in perfectly
  const dynamicFontFamily = typography.fontFamily;
  const dynamicFontSize = (typography.bodyFontSize || 50) * focusScale;
  
  // Force the text to NOT be bold so it looks like part of the normal body paragraphs
  const fontWeight = 400; 
  const lineHeight = 1.2;

  // Exact global anchor point
  const anchorX = focus.anchorX * compositionWidth;
  const anchorY = focus.anchorY * compositionHeight;

  return (
    <div
      className="focusLine"
      style={{
        position: "absolute",
        left: anchorX,
        top: anchorY,
        // Center the highlight exactly on the anchor
        transform: `translate(-50%, -50%) rotate(${focusRotate}deg)`,
        whiteSpace: "nowrap",
        pointerEvents: "none",
        fontFamily: dynamicFontFamily,
        fontSize: dynamicFontSize,
        lineHeight: lineHeight,
        letterSpacing: focus.letterSpacing,
        color: typography.textColor,
        textShadow: "0.25px 0 rgba(0, 0, 0, 0.16)",
      }}
    >
      <div style={{ position: "relative", fontWeight: fontWeight }}>
        {/* Prefix grows infinitely to the left */}
        <div className="prefix" style={{ 
          position: "absolute", 
          right: "100%", 
          top: 0,
          bottom: 0,
          paddingRight: "12px", 
          fontWeight: 400
        }}>
          {config.prefix}
        </div>

        {/* Center Highlight determines the width of the main container */}
        <MarkerHighlight config={focus} seed={seed} />
        <span style={{ position: "relative", zIndex: 1 }}>{config.highlight}</span>

        {/* Suffix grows infinitely to the right */}
        <div className="suffix" style={{ 
          position: "absolute", 
          left: "100%", 
          top: 0,
          bottom: 0,
          paddingLeft: "12px", 
          fontWeight: 400
        }}>
           {config.suffix}
        </div>
      </div>
    </div>
  );
};

