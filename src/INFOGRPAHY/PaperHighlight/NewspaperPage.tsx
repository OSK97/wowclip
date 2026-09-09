import React from "react";
import { AbsoluteFill } from "remotion";
import { PageConfig, TypographyConfig, GlobalFocusConfig } from "./types";
import { ArticleRegion } from "./ArticleRegion";
import { getLayoutStyles } from "./layoutPresets";

interface NewspaperPageProps {
  page: PageConfig;
  typography: TypographyConfig;
  focus: GlobalFocusConfig;
  compositionWidth: number;
  compositionHeight: number;
}

export const NewspaperPage: React.FC<NewspaperPageProps> = ({
  page,
  typography,
  focus,
  compositionWidth,
  compositionHeight,
}) => {
  const canvasWidth = 1400;
  const canvasHeight = 2600;

  const anchorYComposition = focus.anchorY * compositionHeight;
  const canvasOffsetY = Math.abs(compositionHeight - canvasHeight) / 2;
  const oversizedAnchorY = anchorYComposition + canvasOffsetY;

  const styles = getLayoutStyles(page.layout, 0, oversizedAnchorY);

  return (
    <AbsoluteFill
      style={{
        width: canvasWidth,
        height: canvasHeight,
        left: (compositionWidth - canvasWidth) / 2,
        top: (compositionHeight - canvasHeight) / 2,
        transformOrigin: "center center",
        transform: `
          translate(${page.transform.translateX}px, ${page.transform.translateY}px)
          scale(${page.transform.scale})
          rotate(${page.transform.rotate}deg)
        `,
      }}
    >
      <ArticleRegion
        paragraphs={page.topParagraphs}
        typography={typography}
        style={{ ...styles.topRegion, display: "flex", justifyContent: "flex-end" }}
        align="justify"
      />

      <ArticleRegion
        headline={page.headline}
        subheadline={page.subheadline}
        paragraphs={page.bottomParagraphs}
        typography={typography}
        style={styles.bottomRegion}
        align="justify"
      />
    </AbsoluteFill>
  );
};
