import React from "react";

// The presets return CSS objects to position the top, bottom, and side regions around the FocusLine.
// anchorY is the Y coordinate on the OVERSIZED canvas.

export const getLayoutStyles = (preset: string, anchorX: number, anchorY: number): Record<string, React.CSSProperties> => {
  // Common base style for regions
  const baseRegion: React.CSSProperties = {
    position: "absolute",
    width: "80%",
    left: "10%",
  };

  // Give generous space above and below the focus band
  // so text never collides with the marker
  const topClearance = 80;
  const bottomClearance = 100;

  switch (preset) {
    case "body-focus":
    default:
      return {
        topRegion: {
          ...baseRegion,
          bottom: `calc(100% - ${anchorY}px + ${topClearance}px)`, 
        },
        bottomRegion: {
          ...baseRegion,
          top: `${anchorY + bottomClearance}px`, 
        },
      };

    case "body-focus-with-lower-headline":
      return {
        topRegion: {
          ...baseRegion,
          bottom: `calc(100% - ${anchorY}px + ${topClearance}px)`,
        },
        bottomRegion: {
          ...baseRegion,
          top: `${anchorY + bottomClearance + 20}px`,
        },
      };

    case "headline-focus":
      return {
        topRegion: {
          ...baseRegion,
          bottom: `calc(100% - ${anchorY}px + ${topClearance + 40}px)`,
        },
        bottomRegion: {
          ...baseRegion,
          top: `${anchorY + bottomClearance + 40}px`,
        },
      };

    case "two-line-headline-focus":
      return {
        topRegion: {
          ...baseRegion,
          bottom: `calc(100% - ${anchorY}px + ${topClearance + 60}px)`,
        },
        bottomRegion: {
          ...baseRegion,
          top: `${anchorY + bottomClearance + 80}px`,
        },
      };

    case "dense-column-focus":
      return {
        topRegion: {
          ...baseRegion,
          bottom: `calc(100% - ${anchorY}px + ${topClearance}px)`,
        },
        bottomRegion: {
          ...baseRegion,
          top: `${anchorY + bottomClearance}px`,
          columnCount: 2,
          columnGap: "60px",
          width: "90%",
          left: "5%",
        },
      };

    case "sparse-paper-focus":
      return {
        topRegion: {
          ...baseRegion,
          bottom: `calc(100% - ${anchorY}px + ${topClearance + 80}px)`,
          width: "60%",
          left: "20%",
        },
        bottomRegion: {
          ...baseRegion,
          top: `${anchorY + bottomClearance + 80}px`,
          width: "60%",
          left: "20%",
        },
      };

    case "cropped-headline-focus":
      return {
        topRegion: {
          ...baseRegion,
          bottom: `calc(100% - ${anchorY}px + ${topClearance + 50}px)`,
        },
        bottomRegion: {
          ...baseRegion,
          top: `${anchorY + bottomClearance + 30}px`,
        },
      };
  }
};
