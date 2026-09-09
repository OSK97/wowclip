import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, Easing, Img, staticFile } from "remotion";
import baseTableConfig from "./table-config.json";

export const TableAnimation: React.FC<{ config?: any }> = ({
	config: propConfig,
}) => {
	const config = (propConfig ?? baseTableConfig) as any;
  const frame = useCurrentFrame();
  const { width: frameWidth, height: frameHeight } = useVideoConfig();
  // A scene passes the slot it allocated; standalone this is the whole frame.
  const compositionWidth = config.composition?.width ?? frameWidth;
  const compositionHeight = config.composition?.height ?? frameHeight;

  const { theme, layout, animation, columns: rawColumns, data: rawData } = config;

  // ── Portrait Screen Safety Limits ─────────────────────────────────
  // On 1080x1920 portrait, more than 8 rows or 5 columns becomes unreadable
  const MAX_ROWS = 8;
  const MAX_COLUMNS = 5;
  const MIN_EFFECTIVE_FONT_SIZE = 18; // After auto-scale, font must never go below this

  const columns = rawColumns.slice(0, MAX_COLUMNS);
  const data = rawData.slice(0, MAX_ROWS);

  if (rawData.length > MAX_ROWS) {
    console.warn(`TableAnimation: ${rawData.length} rows exceeds max ${MAX_ROWS}. Truncated to ${MAX_ROWS} rows.`);
  }
  if (rawColumns.length > MAX_COLUMNS) {
    console.warn(`TableAnimation: ${rawColumns.length} columns exceeds max ${MAX_COLUMNS}. Truncated to ${MAX_COLUMNS} columns.`);
  }

  // Auto-Scaling Logic:
  // Dynamically scale the table to perfectly fit the screen, whether it has a few rows (scales up) or many rows (scales down).
  const expectedTableHeight = layout.headerHeight + (data.length * layout.minRowHeight) + 100;
  // Standalone the table needs its own margins; inside a scene the slot it was
  // handed is already inset, and taking the margin twice shrinks it visibly.
  const inSlot = Boolean(config.composition?.width);
  const maxSafeWidth = compositionWidth - (inSlot ? 0 : 100);
  const maxSafeHeight = compositionHeight - (inSlot ? 0 : 200);
  
  // This calculates the perfect multiplier to make the table as large as safely possible!
  let fitScale = Math.min(maxSafeWidth / layout.width, maxSafeHeight / expectedTableHeight);
  // Cap the scale at 1.5x so it doesn't look absurdly huge if there's only 1 row
  if (fitScale > 1.5) fitScale = 1.5;
  // Floor the scale so text never becomes unreadably tiny
  const baseFontSize = layout.cellFontSize || 24;
  const minScale = MIN_EFFECTIVE_FONT_SIZE / baseFontSize;
  if (fitScale < minScale) fitScale = minScale;

  // Calculate when the table fully finishes loading for default highlight delays
  const tableFinishFrame = (animation.entranceDurationFrames || 40) + 
                           ((data.length - 1) * (animation.rowStaggerFrames || 15)) + 
                           ((columns.length - 1) * (animation.cellStaggerFrames || 5)) + 20;

  // Dynamic background support with radial gradient fallback
  const bgGradient = (theme as any).backgroundGradient || theme.backgroundColor || `radial-gradient(circle at center, #ffffff 40%, #f1f5f9 100%)`;

  return (
    <AbsoluteFill
      style={{
        background: bgGradient,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: theme.fontFamily,
        overflow: "hidden",
      }}
    >
      {/* Studio Grid Overlay (if gridColor is specified in JSON) */}
      {theme.gridColor && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `linear-gradient(to right, ${theme.gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${theme.gridColor} 1px, transparent 1px)`,
            backgroundSize: "80px 80px",
            maskImage: "radial-gradient(ellipse 80% 85% at 50% 50%, black 25%, transparent 95%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 85% at 50% 50%, black 25%, transparent 95%)",
            pointerEvents: "none",
          }}
        />
      )}
      {/* Auto-scaling container wrapper */}
      <div
        style={{
          transform: `scale(${fitScale})`,
          transformOrigin: "center center",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
        }}
      >
        {/* Main floating container */}
        <div
          style={{
            position: "relative",
            width: layout.width,
            display: "flex",
            flexDirection: "column",
            zIndex: 1, 
          }}
        >
          {/* Header Row */}
          {layout.headerHeight > 0 && (
            <div
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "row",
                height: layout.headerHeight,
                alignItems: "center",
                paddingBottom: 10,
                marginBottom: 20,
              }}
            >
              {/* Aesthetic fading horizontal border for the header */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: 2,
                  background: `linear-gradient(to right, transparent 0%, ${theme.rowBorderColor} 20%, ${theme.rowBorderColor} 80%, transparent 100%)`,
                }}
              />

              {columns.map((col: any, colIndex: number) => {
                const isLastCol = colIndex === columns.length - 1;
                return (
                  <div
                    key={col.key}
                    style={{
                      position: "relative",
                      width: col.width,
                      textAlign: col.align as any,
                      color: theme.headerColor,
                      fontSize: layout.headerFontSize || 15,
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "1.5px",
                      boxSizing: "border-box",
                      padding: "0 20px",
                    }}
                  >
                    {/* Fading vertical border for columns */}
                    {!isLastCol && (
                      <div
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "10%",
                          bottom: "10%",
                          width: 1,
                          background: `linear-gradient(to bottom, transparent 0%, ${theme.rowBorderColor} 20%, ${theme.rowBorderColor} 80%, transparent 100%)`,
                        }}
                      />
                    )}
                    {col.label}
                  </div>
                );
              })}
            </div>
          )}

          {/* Data Rows */}
          {data.map((row: any, rowIndex: number) => {
            // Calculate base stagger time for the row
            let rowStartFrame = animation.entranceDurationFrames + (rowIndex * animation.rowStaggerFrames);
            
            // Allow LLM to override with absolute cinematic timing
            if ((row as any).revealFrame !== undefined) {
              rowStartFrame = (row as any).revealFrame;
            }
            
            // The row border and background logic
            const rowBorderOpacity = interpolate(
              frame,
              [rowStartFrame, rowStartFrame + 15],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.ease) }
            );

            const isLastRow = rowIndex === data.length - 1;

            return (
              <div
                key={rowIndex}
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "row",
                  minHeight: layout.minRowHeight, // Use minHeight for robust text wrapping
                  padding: "15px 0", // Generous padding to prevent overlap
                  alignItems: "center",
                }}
              >
                {/* Aesthetic fading horizontal border for data rows */}
                {!isLastRow && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 1,
                      opacity: rowBorderOpacity, // Border reveals before the cells pop in
                      background: `linear-gradient(to right, transparent 0%, ${theme.rowBorderColor} 20%, ${theme.rowBorderColor} 80%, transparent 100%)`,
                    }}
                  />
                )}

                {columns.map((col: any, colIndex: number) => {
                  const isLastCol = colIndex === columns.length - 1;
                  // Ensure key exists in row data
                  const cellData = (row as any)[col.key];
                  
                  // Allow direct strings (fallback) or objects with {text, image, color} placeholder pattern
                  const hasObject = typeof cellData === "object" && cellData !== null;
                  const cellText = hasObject ? cellData.text : cellData;
                  const cellImage = hasObject ? cellData.image : null;
                  const cellColor = hasObject && cellData.color ? cellData.color : (col.color || theme.textColor);
                  const cellDirection = hasObject && cellData.direction ? cellData.direction : "row";
                  const specificFontSize = hasObject && cellData.fontSize ? cellData.fontSize : (col.fontSize || layout.cellFontSize);
                  const specificImageSize = hasObject && cellData.imageSize ? cellData.imageSize : layout.imageSize;
                  const isHighlighted = hasObject && cellData.highlight;
                  
                  // Uniform Font Sizing System:
                  // All cells in a category/column maintain exact font size hierarchy.
                  // Only shrink gracefully for multi-line long descriptions (> 35 chars) to prevent overflow.
                  let scaleFactor = 1;
                  if (typeof cellText === "string" && cellText.length > 45) {
                    scaleFactor = 0.8;
                  } else if (typeof cellText === "string" && cellText.length > 35) {
                    scaleFactor = 0.9;
                  }
                  
                  const baseFontSize = specificFontSize || 24;
                  const finalFontSize = Math.round(baseFontSize * scaleFactor);
                  
                  // Cell-level animation logic: reveal one by one
                  let cellStartFrame = rowStartFrame + (colIndex * (animation.cellStaggerFrames || 5));
                  if (hasObject && cellData.revealFrame !== undefined) {
                    cellStartFrame = cellData.revealFrame;
                  } else if (hasObject && cellData.revealDelay !== undefined) {
                    cellStartFrame += cellData.revealDelay;
                  }
                  
                  // Spring-like smooth entrance with subtle blur
                  const cellProgress = interpolate(
                    frame,
                    [cellStartFrame, cellStartFrame + 18],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.22, 1.15, 0.36, 1) }
                  );

                  const cellOpacity = interpolate(
                    frame,
                    [cellStartFrame, cellStartFrame + 10],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.ease) }
                  );

                  const cellTranslateY = interpolate(
                    cellProgress,
                    [0, 1],
                    [24, 0]
                  );

                  const cellBlur = interpolate(
                    cellOpacity,
                    [0, 1],
                    [4, 0]
                  );

                  // ── INDIVIDUAL CELL HIGHLIGHT LOGIC ──
                  let highlightColor = theme.highlightColor || 'rgba(253, 224, 71, 0.8)';
                  let cellHighlightStart = tableFinishFrame + 60; // Default: 2s after whole table finishes
                  let cellHighlightDuration = 30;

                  if (isHighlighted && typeof cellData.highlight === 'object') {
                    highlightColor = cellData.highlight.color || highlightColor;
                    
                    if (cellData.highlight.startFrame !== undefined) {
                      cellHighlightStart = cellData.highlight.startFrame;
                    } else if (cellData.highlight.delayAfterCell !== undefined) {
                      cellHighlightStart = cellStartFrame + cellData.highlight.delayAfterCell;
                    } else if (cellData.highlight.delayAfterTable !== undefined) {
                      cellHighlightStart = tableFinishFrame + cellData.highlight.delayAfterTable;
                    }
                    
                    cellHighlightDuration = cellData.highlight.durationFrames || cellHighlightDuration;
                  }

                  const cellHighlightProgress = interpolate(
                    frame,
                    [cellHighlightStart, cellHighlightStart + cellHighlightDuration],
                    [0, 100],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.ease) }
                  );

                  return (
                    <div
                      key={`${rowIndex}-${col.key}`}
                      style={{
                        position: "relative",
                        width: col.width,
                        textAlign: col.align as any,
                        display: "flex",
                        flexDirection: cellDirection as any,
                        alignItems: "center",
                        justifyContent: cellDirection === "column" ? "center" : (col.align === "right" ? "flex-end" : col.align === "center" ? "center" : "flex-start"),
                        gap: cellDirection === "column" ? 10 : 16,
                        color: cellColor,
                        fontSize: finalFontSize,
                        fontWeight: (hasObject && cellData.fontWeight) || col.fontWeight || 400,
                        lineHeight: 1.45,
                        boxSizing: "border-box",
                        padding: "14px 20px",
                        opacity: cellOpacity,
                        transform: `translateY(${cellTranslateY}px)`,
                        filter: cellBlur > 0.1 ? `blur(${cellBlur}px)` : undefined,
                      }}
                    >
                      {/* Fading vertical border for columns */}
                      {!isLastCol && (
                        <div
                          style={{
                            position: "absolute",
                            right: 0,
                            top: "20%",
                            bottom: "20%",
                            width: 1,
                            background: `linear-gradient(to bottom, transparent 0%, ${theme.rowBorderColor} 20%, ${theme.rowBorderColor} 80%, transparent 100%)`,
                          }}
                        />
                      )}

                      {cellImage && (
                        <Img 
                          src={staticFile(cellImage)} 
                          style={{
                            width: specificImageSize,
                            height: specificImageSize,
                            minWidth: specificImageSize,
                            objectFit: "contain",
                            padding: "4px",
                          }}
                        />
                      )}
                      {cellText && (
                        <span
                          style={isHighlighted ? {
                            display: 'inline',
                            backgroundImage: cellHighlightProgress > 0 ? `linear-gradient(to right, ${highlightColor} 0%, ${highlightColor} 100%)` : 'none',
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'left center',
                            backgroundSize: `${cellHighlightProgress}% 90%`,
                            borderRadius: 6,
                            padding: '2px 6px',
                            boxDecorationBreak: 'clone' as any,
                            WebkitBoxDecorationBreak: 'clone' as any,
                          } : {}}
                        >
                          {cellText}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};


export default TableAnimation;
