import React from "react";
import { TypographyConfig } from "./types";

interface ArticleRegionProps {
  paragraphs?: string[];
  headline?: string;
  subheadline?: string;
  typography: TypographyConfig;
  style?: React.CSSProperties;
  align?: "left" | "justify" | "center";
}

export const ArticleRegion: React.FC<ArticleRegionProps> = ({
  paragraphs,
  headline,
  subheadline,
  typography,
  style = {},
  align = "justify"
}) => {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "1.5em",
        fontFamily: typography.fontFamily,
        color: typography.textColor,
        textShadow: "0.25px 0 rgba(0, 0, 0, 0.16)",
        textAlign: align,
        textAlignLast: align === "justify" ? "left" : align,
        ...style,
      }}
    >
      {headline && (
        <h1
          style={{
            fontSize: typography.headlineFontSize,
            lineHeight: typography.headlineLineHeight,
            fontWeight: 700,
            margin: 0,
            letterSpacing: "-1.2px",
            textAlign: "left" // headlines are typically left aligned
          }}
        >
          {headline}
        </h1>
      )}

      {subheadline && (
        <h2
          style={{
            fontSize: typography.headlineFontSize * 0.5,
            lineHeight: typography.headlineLineHeight,
            fontWeight: 700,
            margin: 0,
            marginTop: "-0.5em",
            textAlign: "left"
          }}
        >
          {subheadline}
        </h2>
      )}

      {paragraphs?.map((p, i) => (
        <p
          key={i}
          style={{
            fontSize: typography.bodyFontSize,
            lineHeight: typography.bodyLineHeight,
            margin: 0,
            letterSpacing: "-0.4px",
          }}
        >
          {p}
        </p>
      ))}
    </div>
  );
};
