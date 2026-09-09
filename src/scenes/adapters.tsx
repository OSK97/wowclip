// Bridges the scene JSON to the real templates.
//
// The components in ./components are copies of the standalone templates. Each
// one paints a full 1080x1920 stage of its own — background, vignette, grid,
// heading, a summary number — which is right full-screen and wrong inside a
// scene, where it becomes a grey box with the graphic cropped inside it. This
// file is where that chrome is switched off and where every template is told
// the exact rectangle the layout engine gave it, so nothing is ever cropped,
// stretched, or left floating in a slot it does not fill.

import React from "react";
import { TABLE_METRICS, pieRadius } from "./layout";
import type { Rect } from "./layout";
import type {
  BarGraphElement,
  ImageElement,
  LineGraphElement,
  NumberElement,
  PieChartElement,
  PortraitElement,
  ResolvedTheme,
  SceneElement,
  SmartTextElement,
  SocialEmbedElement,
  TableElement,
} from "./types";

import { BarGraph } from "./components/BarGraph";
import { LineGraph } from "./components/LineGraph";
import { PieChart } from "./components/PieChart";
import { LargeNumber } from "./components/LargeNumber";
import { TableAnimation } from "./components/TableAnimation";
import { SmartTextView } from "./components/SmartTextView";
import { SocialMediaEmbed } from "./components/SocialMediaEmbed";
import { PortraitAnimation } from "./components/PortraitAnimation";

import baseBar from "./components/bar-graph.config.json";
import baseLine from "./components/line-graph.config.json";
import basePie from "./components/pie-chart.config.json";
import baseNumber from "./components/large-number.config.json";
import baseTable from "./components/table-config.json";
import baseSocial from "./components/social-embed.json";
import basePortrait from "./components/portrait-animation.json";

const TRANSPARENT = {
  backgroundColor: "transparent",
  backgroundGradient: "none",
  gridColor: "transparent",
};

const muted = (theme: ResolvedTheme) =>
  theme.mode === "dark" ? "rgba(255,255,255,0.26)" : "rgba(27,32,41,0.24)";

/** Same hue as the accent but soft enough to read text through. */
const tint = (color: string, alpha: number) => {
  const hex = /^#?([0-9a-f]{6})$/i.exec(color.trim().replace("#", ""));
  if (!hex) return color;
  const n = parseInt(hex[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const isHot = (highlight: number | number[] | undefined, i: number) =>
  Array.isArray(highlight) ? highlight.includes(i) : highlight === i;

interface AdapterArgs {
  rect: Rect;
  theme: ResolvedTheme;
  fps: number;
}

// A chart's own heading is part of its full-screen chrome. Drawn here instead,
// it sits in the scene's type hierarchy and the chart keeps the rest of the
// slot to itself.
const HEADING_HEIGHT = 82;

const SlotHeading: React.FC<{ text: string; theme: ResolvedTheme }> = ({ text, theme }) => (
  <div
    style={{
      height: HEADING_HEIGHT,
      display: "flex",
      alignItems: "center",
      gap: 16,
    }}
  >
    {/* A short accent tab in front of the chart's name — the editorial mark
        that separates a data slide from a plain web widget. */}
    <div
      style={{
        width: 6,
        height: 40,
        borderRadius: 3,
        background: theme.accent,
        flex: "0 0 auto",
      }}
    />
    <div
      style={{
        fontSize: 40,
        fontWeight: 700,
        fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
        letterSpacing: "-0.8px",
        // Left, like the copy underneath it. A centred heading over a
        // left-anchored column reads as two different layouts in one frame.
        textAlign: "left",
        color: theme.text,
        lineHeight: 1.05,
      }}
    >
      {text}
    </div>
  </div>
);

const withHeading = (
  title: string | undefined,
  theme: ResolvedTheme,
  body: React.ReactNode,
) =>
  title ? (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column" }}>
      <SlotHeading text={title} theme={theme} />
      <div style={{ position: "relative", flex: 1 }}>{body}</div>
    </div>
  ) : (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>{body}</div>
  );

/** Height left for the graphic once the heading has taken its share. */
const bodyHeight = (rect: Rect, title?: string) =>
  Math.max(200, rect.height - (title ? HEADING_HEIGHT : 0));

const barGraphConfig = (el: BarGraphElement, { rect, theme }: AdapterArgs) => {
  const base = baseBar as any;
  const bars = (el.bars || []).slice(0, 8);
  return {
    ...base,
    composition: { width: rect.width, height: bodyHeight(rect, el.title) },
    // The template's own header is a kicker plus a big animated total. Both are
    // full-screen chrome, and the total repeats what the bars already say.
    title: { text: "", subtitle: "", show: false },
    unit: el.valueSuffix ?? "",
    logo: { show: false, url: "" },
    bars: bars.map((b, i) => {
      const hot = isHot(el.highlight, i);
      const color = hot ? b.color || theme.accent : muted(theme);
      return {
        label: b.label,
        value: b.value,
        gradientFrom: color,
        gradientTo: color,
        highlight: hot,
      };
    }),
    theme: {
      ...base.theme,
      ...TRANSPARENT,
      textColor: theme.text,
      mutedTextColor: theme.muted,
      accentColor: theme.accent,
      gridColor: theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)",
    },
  };
};

const lineGraphConfig = (el: LineGraphElement, { rect, theme, fps }: AdapterArgs) => {
  const base = baseLine as any;
  const points = (el.points || []).slice(0, 12);
  const values = points.map((p) => p.value);
  const max = Math.max(...values, 1);
  const height = bodyHeight(rect, el.title);

  return {
    ...base,
    composition: { ...base.composition, width: rect.width, height, fps },
    logo: { show: false, url: "" },
    // The base config ships a demo legend ("NVIDIA Revenue") that was leaking
    // into every embedded graph.
    legend: { ...base.legend, items: [] },
    // The heading and the big number are the full-screen chrome — off here.
    bottomHeading: { ...base.bottomHeading, show: false },
    indicator: { ...base.indicator, show: false },
    theme: {
      ...base.theme,
      ...TRANSPARENT,
      textColor: theme.text,
      subtextColor: theme.muted,
      gridColor: theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)",
    },
    graph: {
      ...base.graph,
      // Leave room on the left for the value labels and at the foot for the
      // year ticks, both of which are now set at a readable size.
      gridWidth: Math.max(200, rect.width - 110),
      gridHeight: Math.max(160, height - 150),
      positionY: "50%",
      // A floating card anchored to the last point hangs off the slot edge.
      showTooltip: false,
      // The template's own 16-18px ticks are illegible at reel scale.
      axisFontSize: 28,
    },
    data: {
      ...base.data,
      maxValue: max * 1.12,
      timeline: points.map((p) => p.label),
      yLabels: [
        { value: 0, label: "0" },
        { value: max * 0.5, label: String(Math.round(max * 0.5)) },
        { value: max, label: String(Math.round(max)) },
      ],
      series: [
        {
          name: el.title || "Series",
          values,
          color: theme.accent,
          strokeGradient: [theme.accent, theme.accent],
          areaColor: theme.accent,
          shadowColor: theme.accent,
        },
      ],
    },
  };
};

const pieChartConfig = (el: PieChartElement, { rect, theme, fps }: AdapterArgs) => {
  const base = basePie as any;
  const sectors = (el.sectors || []).slice(0, 6);
  const total = sectors.reduce((a, s) => a + (Math.abs(s.value) || 0), 0) || 1;
  const height = bodyHeight(rect);

  // Sector names sit outside the rim on leader lines, so the radius is limited
  // by the longest name — not by the slot. It comes from the same function the
  // layout engine used to size the box, so "Two wheelers" can never run off the
  // edge of the frame.
  const labelOffset = 34;
  const labelElbow = 24;
  const radius = pieRadius(rect.width, sectors.map((s) => s.label ?? ""));

  return {
    ...base,
    composition: { ...base.composition, width: rect.width, height, fps },
    logo: { show: false, url: "" },
    theme: {
      ...base.theme,
      ...TRANSPARENT,
      textColor: theme.text,
      subtextColor: theme.muted,
      gridColor: theme.mode === "dark" ? "rgba(255,255,255,0.06)" : "rgba(15,23,42,0.06)",
    },
    chart: {
      ...base.chart,
      cx: rect.width / 2,
      cy: height / 2,
      radius,
      labelOffset,
      labelElbow,
      gridWidth: rect.width,
      gridHeight: height,
      // Embedded the circle is smaller than the standalone template assumed, so
      // the names have to be set explicitly or they end up unreadably small.
      // Held to a floor regardless of how tight the chart gets.
      labelFontSize: Math.max(28, Math.round(radius * 0.13)),
      percentFontSize: Math.max(30, Math.round(radius * 0.15)),
    },
    sectors: sectors.map((s, i) => ({
      id: `s${i}`,
      name: s.label,
      percentage: Math.round(((Math.abs(s.value) || 0) / total) * 100),
      color: el.highlight === i ? s.color || theme.accent : s.color || muted(theme),
    })),
  };
};

const numberConfig = (el: NumberElement, { rect, theme, fps }: AdapterArgs) => {
  const base = baseNumber as any;
  const numeric = typeof el.value === "number" ? el.value : Number(el.value);

  return {
    ...base,
    composition: { ...base.composition, width: rect.width, height: rect.height, fps },
    theme: {
      ...base.theme,
      ...TRANSPARENT,
      textColor: theme.text,
      subtextColor: theme.muted,
      accentColor: theme.accent,
    },
    content: {
      ...base.content,
      showTopText: false,
      topText: "",
      prefix: el.prefix ?? "",
      number: isFinite(numeric) ? numeric : 0,
      suffix: el.suffix ?? "",
      showBottomText: Boolean(el.label),
      bottomText: el.label ?? "",
      // The standalone template sets its caption in a script face. Next to a
      // chart it reads as a wedding invitation, so the label stays plain.
      bottomTextStyle: "plain",
    },
    // The stock timings assume a heading counts in first; here the stat is the
    // whole element, and waiting three seconds for its label wastes the scene.
    animation: {
      ...base.animation,
      number: { startFrame: 6, durationFrames: 34 },
      bottomText: { style: "word-by-word-slide-up", startFrame: 30, staggerFrames: 3 },
    },
  };
};

const tableConfig = (el: TableElement, { rect, theme, fps }: AdapterArgs) => {
  const base = baseTable as any;
  const columns = (el.columns || []).slice(0, 5);
  const rows = (el.rows || []).slice(0, 8);
  const keys = columns.map((_, i) => `c${i}`);

  return {
    ...base,
    composition: { width: rect.width, height: rect.height },
    // Same metrics the layout engine reserved space with, and a bigger type
    // size than the standalone table: this one has no heading competing with it.
    layout: {
      ...base.layout,
      width: TABLE_METRICS.width,
      headerHeight: TABLE_METRICS.headerHeight,
      minRowHeight: TABLE_METRICS.rowHeight,
      cellFontSize: TABLE_METRICS.cellFontSize,
      headerFontSize: TABLE_METRICS.headerFontSize,
    },
    theme: {
      ...base.theme,
      backgroundColor: "transparent",
      backgroundGradient: "none",
      gridColor: "",
      rowBorderColor: "rgba(100,116,139,0.22)",
      textColor: theme.text,
      headerColor: theme.muted,
      // A solid accent fill turns the cell into an unreadable block; the marker
      // has to sit behind the text, not on top of it.
      highlightColor: tint(theme.accent, 0.24),
    },
    columns: columns.map((label, i) => ({
      key: keys[i],
      label,
      align: i === 0 ? "left" : "right",
      width: i === 0 ? `${Math.round(100 / columns.length) + 12}%` : undefined,
      fontWeight: 600,
      color: theme.muted,
    })),
    data: rows.map((row, r) => {
      const entry: Record<string, unknown> = {};
      keys.forEach((key, c) => {
        const hot = (el.highlight || []).some(([hr, hc]) => hr === r && hc === c);
        const value = row[c];
        entry[key] = {
          text: value === null || value === undefined ? "" : String(value),
          ...(hot
            ? {
                highlight: {
                  color: tint(theme.accent, 0.24),
                  startFrame: Math.round(fps * 0.8),
                  durationFrames: Math.round(fps * 0.8),
                },
              }
            : {}),
        };
      });
      return entry;
    }),
  };
};

const socialConfig = (el: SocialEmbedElement, { theme }: AdapterArgs) => {
  const base = baseSocial as any;
  return {
    ...base,
    platform: el.platform || base.platform || "twitter",
    theme: {
      ...(base.theme || {}),
      // Only the post card should show — its full-bleed backdrop and grid would
      // sit in the slot as a solid block behind everything else.
      backgroundColor: "transparent",
      backgroundGradient: "",
      showGrid: false,
      // The card itself follows the story theme so it reads as a real embed.
      darkMode: theme.mode === "dark",
    },
    profile: {
      ...(base.profile || {}),
      name: el.author ?? base.profile?.name ?? "",
      handle: el.handle ?? base.profile?.handle ?? "",
      avatar: el.avatar ?? base.profile?.avatar ?? "",
    },
    post: {
      ...(base.post || {}),
      text: el.text ?? base.post?.text ?? "",
      images: el.image ? [el.image] : [],
    },
  };
};

const portraitConfig = (el: PortraitElement, { rect, theme }: AdapterArgs) => {
  const base = basePortrait as any;
  const hasText = Boolean(el.name || el.subtitle);
  return {
    ...base,
    background: {
      ...(base.background || {}),
      backgroundColor: "transparent",
      backgroundGradient: "none",
      showGrid: false,
      showSpotlight: false,
    },
    avatar: {
      ...(base.avatar || {}),
      imagePath: el.src ?? base.avatar?.imagePath,
      // The portrait is a fixed-size graphic centred in its stage, so the
      // circle has to be derived from the slot or it floats in white space.
      circleSize: Math.round(
        Math.max(280, Math.min(rect.width * 0.7, rect.height * (hasText ? 0.56 : 0.78))),
      ),
    },
    text: {
      ...(base.text || {}),
      value: el.name ?? "",
      subtitle: el.subtitle ?? "",
      color: theme.text,
    },
  };
};

/**
 * Renders one element into the rect the layout engine assigned. Returns null
 * for types handled by the simple in-house renderers.
 */
export const renderTemplateElement = (
  element: SceneElement,
  args: AdapterArgs,
): React.ReactNode => {
  switch (element.type) {
    case "barGraph": {
      const bar = element as BarGraphElement;
      return withHeading(
        bar.title,
        args.theme,
        <BarGraph {...(barGraphConfig(bar, args) as any)} />,
      );
    }
    case "lineGraph": {
      const line = element as LineGraphElement;
      return withHeading(
        line.title,
        args.theme,
        <LineGraph {...(lineGraphConfig(line, args) as any)} />,
      );
    }
    case "pieChart":
      return <PieChart {...(pieChartConfig(element as PieChartElement, args) as any)} />;
    case "number":
      return <LargeNumber {...(numberConfig(element as NumberElement, args) as any)} />;
    case "table":
      return <TableAnimation config={tableConfig(element as TableElement, args)} />;
    case "smartText": {
      const rawSegments = ((element as SmartTextElement).segments || []) as any[];
      // If any segment has white text in light mode, remap to theme.text to prevent invisible text
      const segments = rawSegments.map((s) => {
        const c = (s.color || "").toLowerCase();
        if (args.theme.mode === "light" && (c === "#ffffff" || c === "#fff" || c === "#f8fafc")) {
          return { ...s, color: args.theme.text };
        }
        return s;
      });

      return (
        <SmartTextView
          segments={segments as never}
          isOverlay
          theme={{
            textAlign: "left",
            // It lays out at `1080 - contentPaddingX * 2`, using the canvas
            // constant rather than the slot — so padding has to absorb the
            // difference or the first word of each segment gets clipped.
            contentPaddingX: Math.max(0, Math.round((1080 - args.rect.width) / 2)),
            textFontSize: 58,
            numberFontSize: 120,
          }}
        />
      );
    }
    case "socialEmbed":
      return (
        <SocialMediaEmbed
          config={socialConfig(element as SocialEmbedElement, args) as never}
        />
      );
    case "portrait":
      return <PortraitAnimation config={portraitConfig(element as PortraitElement, args)} />;
    default:
      return null;
  }
};

export type { ImageElement };
