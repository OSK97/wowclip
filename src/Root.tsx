import "./index.css";
import { Composition } from "remotion";
import {
  AestheticNewsLayout,
  getAestheticNewsDuration,
} from "./INFOGRPAHY/AestheticNews/AestheticNewsLayout";
import type { NewsConfigInput } from "./INFOGRPAHY/AestheticNews/timeline";
import { DEFAULT_FPS as AESTHETIC_NEWS_FPS } from "./INFOGRPAHY/AestheticNews/timeline";
import aestheticNewsConfig from "./INFOGRPAHY/AestheticNews/aesthetic-news.config.json";
import { CommanderTable } from "./INFOGRPAHY/CommanderTable/CommanderTable";
import { PaperHighlight } from "./INFOGRPAHY/PaperHighlight/PaperHighlight";
import paperHighlightConfig from "./INFOGRPAHY/PaperHighlight/paper-highlight.config.json";
import { resolveConfig } from "./INFOGRPAHY/PaperHighlight/resolveConfig";
import { GovernmentDocument } from "./INFOGRPAHY/GovernmentDocument";
import { getGovernmentDocumentDuration } from "./INFOGRPAHY/GovernmentDocument/duration";
import {
  ElonRocketNews,
  ELON_FPS,
  ELON_TOTAL_FRAMES,
  getPersonNewsDuration,
} from "./INFOGRPAHY/ElonRocketNews";
import rocketNewsConfig from "./INFOGRPAHY/ElonRocketNews/rocket-news.config.json";
import { BarGraph, getBarGraphDuration, LineGraph, PieChart } from "./graphs";
import { GrossVolume } from "./graphs/GrossVolume/GrossVolume";
import barGraphConfigAny from "./graphs/BarGraph/bar-graph.config.json";
import lineGraphConfigAny from "./graphs/LineGraph/line-graph.config.json";
import pieChartConfigAny from "./graphs/PieChart/pie-chart.config.json";

const barGraphConfig = barGraphConfigAny as any;
const lineGraphConfig = lineGraphConfigAny as any;
const pieChartConfig = pieChartConfigAny as any;


import grossVolumeConfigAny from "./graphs/GrossVolume/gross-volume.config.json";
const grossVolumeConfig = grossVolumeConfigAny as any;
import { LargeNumber } from "./LargeNumber";
import largeNumberConfigAny from "./LargeNumber/large-number.config.json";
const largeNumberConfig = largeNumberConfigAny as any;
import { TableAnimation } from "./component/table_animation/TableAnimation";
import tableAnimationConfigAny from "./component/table_animation/table-config.json";
const tableAnimationConfig = tableAnimationConfigAny as any;
import {
  SmartTextView,
  getSmartTextDuration,
} from "./component/SmartTextView/SmartTextView";
import smartTextConfig from "./component/SmartTextView/smart-text.json";
import { PortraitAnimation } from "./component/PortraitAnimation/PortraitAnimation";
import portraitAnimationConfig from "./component/PortraitAnimation/portrait-animation.json";
import { ShowcaseCard } from "./component/ShowcaseCard/ShowcaseCard";
import showcaseCardConfig from "./component/ShowcaseCard/showcase-card.json";
import { DynamicShowcase } from "./component/DynamicShowcase/DynamicShowcase";
import dynamicShowcaseConfig from "./component/DynamicShowcase/dynamic-showcase.json";
import {
  BlurredBackgroundVideo,
  getBlurredVideoDuration,
} from "./component/BlurredBackgroundVideo/BlurredBackgroundVideo";
import blurredVideoConfig from "./component/BlurredBackgroundVideo/blurred-video.json";
import { CalendarComposition } from "./time/calendar/CalendarComposition";
import calendarConfigAny from "./time/calendar/calendar.config.json";
import { ChecklistView } from "./component/ChecklistView/ChecklistView";
import checklistConfig from "./component/ChecklistView/checklist.json";
import {
  ProductReveal,
  getProductRevealDuration,
} from "./component/ProductReveal/ProductReveal";
import productRevealConfigAny from "./component/ProductReveal/product-reveal.json";
import { TvText, getTvTextDuration } from "./tvtext/TvText";
import tvTextConfig from "./tvtext/tvtext-config.json";
import { YearTimeline, getYearTimelineDuration } from "./tvtext/YearTimeline";
import yearTimelineConfig from "./tvtext/year-timeline.json";
import { SocialMediaEmbed } from "./SocialMediaEmbed/SocialMediaEmbed";
import socialEmbedConfig from "./SocialMediaEmbed/social-embed.json";
import { SingleMap } from "./maps/SingleMap";
// import { ComparisonMap } from "./maps/ComparisonMap";
import { TableMap } from "./maps/TableMap";
import { CountryMap } from "./maps/TimelineMap";
import { FullCountryMap } from "./maps/FullCountryMap";
import singleMapConfig from "./maps/SingleMap/config.json";
import timelineMapConfig from "./maps/TimelineMap/config.json";
import fullCountryMapConfig from "./maps/FullCountryMap/config.json";
// import comparisonMapConfig from "./maps/ComparisonMap/config.json";
import tableMapConfig from "./maps/TableMap/config.json";
import { DynamicComparison } from "./component/DynamicComparison/DynamicComparison";
import dynamicComparisonConfig from "./component/DynamicComparison/dynamic-comparison.json";
import { MediaShowcase } from "./component/MediaShowcase";
import mediaShowcaseConfig from "./component/MediaShowcase/media-showcase.json";
import { QuoteCard } from "./component/QuoteCard/QuoteCard";
import quoteCardConfig from "./component/QuoteCard/quote-card.json";
import { TextBehindPerson } from "./component/TextBehindPerson/TextBehindPerson";
import tbpConfig from "./component/TextBehindPerson/text-behind-person.json";
import {
  CinematicFocusShift,
  getCinematicDuration,
} from "./motion-graphic/CinematicFocusShift";
import cinematicConfig from "./motion-graphic/cinematic-config.json";
import {
  ProductShowcase,
  getProductShowcaseDuration,
} from "./ProductShowcase/ProductShowcase";
import showcaseConfig from "./ProductShowcase/showcase-config.json";
import { AppleAnimation } from "./AppleAnimation/AppleAnimation";
import { Story, getStoryDuration, STORY_FPS } from "./scenes/Story";
import type { StoryConfig } from "./scenes/Story";
import storyConfig from "./scenes/story.config.json";
import { CircularIntro } from "./building_blocks/circular_intro/CircularIntro";
import { Quote_Style } from "./Quote_Style";
import { AbsoluteFill } from "remotion";

const CircularIntroPreview: React.FC<{ size?: number }> = ({ size = 800 }) => {
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "white",
      }}
    >
      <CircularIntro size={size} />
    </AbsoluteFill>
  );
};

const getSingleMapDuration = () => {
  const raw = singleMapConfig as any;
  if (raw.durationInSeconds) return Math.round(raw.durationInSeconds * 24);
  if (raw.composition?.durationSeconds) return Math.round(raw.composition.durationSeconds * 24);

  let maxFrame = 0;
  const steps = raw.steps;

  if (steps && steps.length > 0) {
    steps.forEach((step: any, idx: number) => {
      const nextStart = steps[idx + 1]?.startFrame;
      const end =
        nextStart !== undefined
          ? nextStart
          : (step.startFrame || 0) + (step.durationInFrames || 80);
      if (end > maxFrame) maxFrame = end;
    });
  }

  // 1-second buffer (assuming 24fps) after the final animation ends
  const minRequiredDuration = maxFrame > 0 ? maxFrame + 24 : 300;

  if (
    raw.totalDurationInFrames &&
    raw.totalDurationInFrames > minRequiredDuration
  ) {
    return raw.totalDurationInFrames;
  }

  return minRequiredDuration;
};

const getTimelineMapDuration = () => {
  const raw = timelineMapConfig as any;
  if (raw.totalDurationInFrames) return raw.totalDurationInFrames;
  const timeline = raw.timeline || [];
  let currentFrameOffset = 15;
  timeline.forEach((event: any) => {
    const eventSteps =
      event.steps && event.steps.length > 0
        ? event.steps
        : [
            {
              mode: event.image ? "png" : "image",
              image: event.image,
              durationInFrames: 80,
            },
          ];
    eventSteps.forEach((step: any) => {
      currentFrameOffset += step.durationInFrames || 80;
    });
  });
  return currentFrameOffset + 60;
};

const getFullCountryMapDuration = () => {
  const raw = fullCountryMapConfig as any;
  if (raw.durationInSeconds) return Math.round(raw.durationInSeconds * 24);
  if (raw.durationInFrames) return raw.durationInFrames;
  let maxFrame = 0;
  (raw.steps || []).forEach((step: any) => {
    const endF = (step.startFrame ?? 0) + (step.durationInFrames ?? 60);
    maxFrame = Math.max(maxFrame, endF);
  });
  return maxFrame > 0 ? maxFrame + 30 : 240;
};

// const getComparisonMapDuration = () => {
//   const raw = comparisonMapConfig as any;
//   const states = raw.states || [];
//   const count = states.length;
//   if (count <= 1) return 150;
//   const lastPanelStart = 10 + (count - 1) * 18;
//   const animationEnd = lastPanelStart + 55;
//   return animationEnd + 150; // 5 seconds of post-read time at 30 fps
// };

const getTableMapDuration = () => {
  const raw = tableMapConfig as any;
  if (raw.totalDurationInFrames) return raw.totalDurationInFrames;
  const rows = raw.rows || [];
  const entrance = raw.animation?.entranceDurationFrames || 35;
  const rowStagger = raw.animation?.rowStaggerFrames || 12;
  const tableFinishFrame = entrance + (rows.length - 1) * rowStagger + 30;

  let maxHighlightFrame = tableFinishFrame;
  rows.forEach((row: any) => {
    row.forEach((cell: any) => {
      if (cell && typeof cell === "object" && cell.highlight) {
        const end =
          cell.highlight.startFrame + (cell.highlight.durationFrames || 60);
        if (end > maxHighlightFrame) maxHighlightFrame = end;
      }
    });
  });

  return maxHighlightFrame + 60;
};

const getDynamicComparisonDuration = () => {
  const leftBlocks = dynamicComparisonConfig.left?.blocks || [];
  const rightBlocks = dynamicComparisonConfig.right?.blocks || [];
  let maxFrame = 0;
  for (const b of leftBlocks) {
    if (b.startFrame && b.startFrame > maxFrame) maxFrame = b.startFrame;
  }
  for (const b of rightBlocks) {
    if (b.startFrame && b.startFrame > maxFrame) maxFrame = b.startFrame;
  }

  if (maxFrame === 0) return 20 * 30; // fallback

  return maxFrame + 150; // Add 5 seconds of padding at the end
};

const smartTextConfigAny = smartTextConfig as any;
const portraitAnimationConfigAny = portraitAnimationConfig as any;
const showcaseCardConfigAny = showcaseCardConfig as any;
const dynamicShowcaseConfigAny = dynamicShowcaseConfig as any;
const checklistConfigAny = checklistConfig as any;
const socialEmbedConfigAny = socialEmbedConfig as any;
const calendarConfig = calendarConfigAny as any;

const getTableAnimationDuration = () => {
  const { animation, data, columns, durationInSeconds, durationInFrames } = tableAnimationConfig;
  if (durationInFrames) return durationInFrames;
  if (durationInSeconds) return durationInSeconds * 30;
  if (animation?.durationInFrames) return animation.durationInFrames;
  if (animation?.durationInSeconds) return animation.durationInSeconds * 30;

  let maxFrame =
    (animation.entranceDurationFrames || 40) +
    (data.length - 1) * (animation.rowStaggerFrames || 15) +
    (columns.length - 1) * (animation.cellStaggerFrames || 5) +
    20;

  data.forEach((row: any, rowIndex: number) => {
    let rowStartFrame =
      (animation.entranceDurationFrames || 40) +
      rowIndex * (animation.rowStaggerFrames || 15);
    if (row.revealFrame !== undefined) {
      rowStartFrame = row.revealFrame;
      maxFrame = Math.max(maxFrame, rowStartFrame);
    }

    columns.forEach((col: any, colIndex: number) => {
      const cellData = row[col.key];
      const hasObject = typeof cellData === "object" && cellData !== null;
      let cellStartFrame =
        rowStartFrame + colIndex * (animation.cellStaggerFrames || 5);

      if (hasObject && cellData.revealFrame !== undefined) {
        cellStartFrame = cellData.revealFrame;
      }
      maxFrame = Math.max(maxFrame, cellStartFrame + 20);

      if (hasObject && cellData.highlight) {
        let cellHighlightStart = maxFrame;
        let durationFrames = cellData.highlight.durationFrames || 30;

        if (cellData.highlight.startFrame !== undefined) {
          cellHighlightStart = cellData.highlight.startFrame;
        } else if (cellData.highlight.delayAfterCell !== undefined) {
          cellHighlightStart =
            cellStartFrame + cellData.highlight.delayAfterCell;
        } else if (cellData.highlight.delayAfterTable !== undefined) {
          cellHighlightStart = maxFrame + cellData.highlight.delayAfterTable;
        }

        maxFrame = Math.max(maxFrame, cellHighlightStart + durationFrames);
      }
    });
  });

  return maxFrame + 90; // Generous 3 seconds cinematic hold at the end
};

const resolvedPaperConfig = resolveConfig(paperHighlightConfig);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AestheticNewsLayout"
        component={AestheticNewsLayout}
        width={1080}
        height={1920}
        fps={AESTHETIC_NEWS_FPS}
        durationInFrames={getAestheticNewsDuration()}
        defaultProps={{ config: aestheticNewsConfig as NewsConfigInput }}
        calculateMetadata={({ props }) => {
          const config = (props as { config?: NewsConfigInput }).config;
          return {
            fps: config?.fps ?? AESTHETIC_NEWS_FPS,
            durationInFrames: getAestheticNewsDuration(config),
          };
        }}
      />
      <Composition
        id="PaperHighlightReplica"
        component={PaperHighlight}
        width={resolvedPaperConfig.composition.width}
        height={resolvedPaperConfig.composition.height}
        fps={resolvedPaperConfig.composition.fps}
        durationInFrames={Math.ceil(
          resolvedPaperConfig.composition.durationSeconds *
            resolvedPaperConfig.composition.fps,
        )}
        defaultProps={{
          config: paperHighlightConfig,
        }}
      />

      <Composition
        id="ElonRocketNews"
        component={ElonRocketNews}
        width={1080}
        height={1920}
        fps={ELON_FPS}
        durationInFrames={getPersonNewsDuration(rocketNewsConfig as any, ELON_FPS)}
        defaultProps={{
          config: rocketNewsConfig as any,
        }}
      />
      <Composition
        id="BarGraph"
        component={BarGraph as any}
        width={barGraphConfig.composition?.width ?? 1080}
        height={barGraphConfig.composition?.height ?? 1920}
        fps={barGraphConfig.composition?.fps ?? 30}
        durationInFrames={getBarGraphDuration(barGraphConfig)}
        defaultProps={barGraphConfig as any}
      />
      <Composition
        id="LineGraph"
        component={LineGraph as any}
        width={lineGraphConfig.composition.width}
        height={lineGraphConfig.composition.height}
        fps={lineGraphConfig.composition.fps}
        durationInFrames={
          (lineGraphConfig.durationInSeconds ??
            lineGraphConfig.composition?.durationSeconds ??
            6) * (lineGraphConfig.composition?.fps ?? 30)
        }
        defaultProps={lineGraphConfig}
      />
      <Composition
        id="PieChart"
        component={PieChart as any}
        width={pieChartConfig.composition.width}
        height={pieChartConfig.composition.height}
        fps={pieChartConfig.composition.fps}
        durationInFrames={
          (pieChartConfig.durationInSeconds ??
            pieChartConfig.composition?.durationSeconds ??
            4) * (pieChartConfig.composition?.fps ?? 30)
        }
        defaultProps={pieChartConfig}
      />
      <Composition
        id="GrossVolume"
        component={GrossVolume as any}
        width={grossVolumeConfig.composition?.width ?? 1080}
        height={grossVolumeConfig.composition?.height ?? 1920}
        fps={grossVolumeConfig.composition?.fps ?? 30}
        durationInFrames={
          (grossVolumeConfig.composition?.durationSeconds ?? 8) *
          (grossVolumeConfig.composition?.fps ?? 30)
        }
        defaultProps={grossVolumeConfig}
      />
      <Composition
        id="LargeNumber"
        component={LargeNumber as any}
        width={largeNumberConfig.composition?.width ?? 1080}
        height={largeNumberConfig.composition?.height ?? 1920}
        fps={largeNumberConfig.composition?.fps ?? 30}
        durationInFrames={
          (largeNumberConfig.durationInSeconds ??
            largeNumberConfig.composition?.durationSeconds ??
            5) * (largeNumberConfig.composition?.fps ?? 30)
        }
        defaultProps={largeNumberConfig}
      />
      <Composition
        id="TableAnimation"
        component={TableAnimation}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={getTableAnimationDuration()}
      />
      <Composition
        id="SmartTextView"
        component={SmartTextView as any}
        width={smartTextConfigAny.composition?.width ?? 1080}
        height={smartTextConfigAny.composition?.height ?? 1920}
        fps={smartTextConfigAny.composition?.fps ?? 60}
        durationInFrames={getSmartTextDuration()}
        defaultProps={{
          segments: smartTextConfigAny.segments,
        }}
      />
      <Composition
        id="PortraitAnimation"
        component={PortraitAnimation as any}
        width={portraitAnimationConfigAny.composition?.width ?? 1080}
        height={portraitAnimationConfigAny.composition?.height ?? 1920}
        fps={portraitAnimationConfigAny.composition?.fps ?? 60}
        durationInFrames={
          (portraitAnimationConfigAny.composition?.durationSeconds ?? 5) *
          (portraitAnimationConfigAny.composition?.fps ?? 60)
        }
        defaultProps={{
          config: portraitAnimationConfigAny,
        }}
      />
      <Composition
        id="BlurredBackgroundVideo"
        component={BlurredBackgroundVideo}
        durationInFrames={getBlurredVideoDuration()}
        fps={24}
        width={1080}
        height={1920}
        defaultProps={{
          config: blurredVideoConfig,
        }}
      />
      <Composition
        id="CalendarComposition"
        component={CalendarComposition}
        width={1080}
        height={1920}
        fps={24}
        durationInFrames={
          calendarConfig.durationInSeconds
            ? Math.round(calendarConfig.durationInSeconds * 24)
            : (calendarConfig.composition?.durationSeconds
              ? Math.round(calendarConfig.composition.durationSeconds * 24)
              : (calendarConfig.timings?.totalDurationInFrames ?? 300))
        }
      />
      <Composition
        id="ChecklistView"
        component={ChecklistView as any}
        width={checklistConfigAny.composition?.width ?? 1080}
        height={checklistConfigAny.composition?.height ?? 1920}
        fps={checklistConfigAny.composition?.fps ?? 60}
        durationInFrames={
          (checklistConfigAny.composition?.durationSeconds ?? 8) *
          (checklistConfigAny.composition?.fps ?? 60)
        }
        defaultProps={{
          items: checklistConfigAny.items,
        }}
      />
      <Composition
        id="ProductReveal"
        component={ProductReveal as any}
        width={1080}
        height={1920}
        fps={24}
        durationInFrames={getProductRevealDuration()}
        defaultProps={{
          config: productRevealConfigAny,
        }}
      />
      <Composition
        id="TvText"
        component={TvText}
        width={1080}
        height={1920}
        fps={24}
        durationInFrames={getTvTextDuration()}
        defaultProps={{
          theme: tvTextConfig.theme as any,
          segments: tvTextConfig.captions as any,
          mediaSrc: tvTextConfig.media?.src,
          objectFit: tvTextConfig.media?.objectFit as any,
          mediaScale: tvTextConfig.media?.scale,
        }}
      />
      <Composition
        id="YearTimelineOverlay"
        component={YearTimeline}
        width={1080}
        height={1920}
        fps={24}
        durationInFrames={getYearTimelineDuration()}
        defaultProps={yearTimelineConfig as any}
      />
      <Composition
        id="SocialMediaEmbed"
        component={SocialMediaEmbed}
        width={1080}
        height={1920}
        fps={60}
        durationInFrames={300}
        defaultProps={{ config: socialEmbedConfigAny }}
      />
      <Composition
        id="SingleMap"
        component={SingleMap}
        width={1080}
        height={1920}
        fps={24}
        durationInFrames={getSingleMapDuration()}
      />
      <Composition
        id="TableMap"
        component={TableMap}
        width={1080}
        height={1920}
        fps={24}
        durationInFrames={getTableMapDuration()}
      />
      <Composition
        id="CountryMap"
        component={CountryMap}
        width={1080}
        height={1920}
        fps={24}
        durationInFrames={getTimelineMapDuration()}
      />
      <Composition
        id="FullCountryMap"
        component={FullCountryMap}
        width={1080}
        height={1920}
        fps={24}
        durationInFrames={getFullCountryMapDuration()}
      />
      <Composition
        id="DynamicComparison"
        component={DynamicComparison}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={getDynamicComparisonDuration()}
      />
      <Composition
        id="CinematicFocusShift"
        component={CinematicFocusShift}
        width={1080}
        height={1920}
        fps={cinematicConfig.fps || 24}
        durationInFrames={getCinematicDuration()}
      />
      <Composition
        id="ProductShowcase"
        component={ProductShowcase}
        width={1080}
        height={1920}
        fps={showcaseConfig.fps || 24}
        durationInFrames={getProductShowcaseDuration()}
      />
      <Composition
        id="AppleAnimation"
        component={AppleAnimation}
        width={1080}
        height={1920}
        fps={60}
        durationInFrames={4800}
      />
      <Composition
        id="Story"
        component={Story}
        width={1080}
        height={1920}
        fps={STORY_FPS}
        durationInFrames={getStoryDuration(storyConfig as StoryConfig)}
        defaultProps={{ config: storyConfig as StoryConfig }}
        calculateMetadata={({ props }) => {
          const config = (props as { config?: StoryConfig }).config;
          return {
            fps: config?.fps ?? STORY_FPS,
            durationInFrames: getStoryDuration(config),
          };
        }}
      />
      <Composition
        id="CircularIntroPreview"
        component={CircularIntroPreview}
        width={1080}
        height={1920}
        fps={60}
        durationInFrames={300}
        defaultProps={{ size: 800 }}
      />
      <Composition
        id="MediaShowcase"
        component={MediaShowcase}
        width={1080}
        height={1920}
        fps={mediaShowcaseConfig.fps || 30}
        durationInFrames={(mediaShowcaseConfig.durationInSeconds || 10) * (mediaShowcaseConfig.fps || 30)}
      />
      <Composition
        id="QuoteCard"
        component={QuoteCard as any}
        width={1080}
        height={1920}
        fps={quoteCardConfig.fps || 30}
        durationInFrames={(quoteCardConfig.durationInSeconds || 10) * (quoteCardConfig.fps || 30)}
        defaultProps={{
          config: quoteCardConfig as any,
        }}
      />
      <Composition
        id="TextBehindPerson"
        component={TextBehindPerson as any}
        width={1080}
        height={1920}
        fps={tbpConfig.fps || 24}
        durationInFrames={(tbpConfig.durationInSeconds || 4) * (tbpConfig.fps || 24)}
        defaultProps={{
          config: tbpConfig as any,
        }}
      />
      <Composition
        id="Quote-Style"
        component={Quote_Style}
        width={1080}
        height={1920}
        fps={30}
        durationInFrames={300}
        defaultProps={{
          mediaSrc: "test_frame.jpg",
          objectFit: "cover" as const,
          objectPosition: "center 22%",
          mediaScale: 1.0,
          stageBackground: "#000000",
          glowColor: "#ff4d4d",
          glowStrength: 0.16,
          backdropBlur: 100,
          backdropDim: 0.58,
          quoteText: "Stay focused. Your time is coming.",
          showInstagramUI: true,
          instagramUI: {
            username: "realityquotes.hub",
            verified: true,
            caption: "Follow @realityquotes.hub for daily motivation 💡",
            audioTitle: "Ishuq Haque · AIRTEL PHONK",
            likes: 245000,
            comments: 482,
            reposts: 9120,
            shares: 34100,
          },
        }}
      />
    </>
  );
};
