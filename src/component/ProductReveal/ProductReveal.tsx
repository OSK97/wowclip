import React from "react";
import {
  AbsoluteFill,
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  spring,
  delayRender,
  continueRender,
} from "remotion";

import { loadInter } from "../../utils/localFonts";

// ─── Font Loading ────────────────────────────────────────────────────────────

const { fontFamily: interFamily } = loadInter("normal", {
  weights: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
});

// ─── Types ───────────────────────────────────────────────────────────────────

type FooterBlockType = "label" | "title" | "price" | "description" | "badge" | "button" | "rating" | "spacer";

interface FooterBlock {
  type: FooterBlockType;
  value?: string;
  enterFrame?: number;
  transitionFrame?: number;
  transitionValue?: string;
  transitionColor?: string;
  transitionDuration?: number; // frames for counting effect (default 30)
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  bgColor?: string;
  align?: "left" | "center" | "right";
  ratingValue?: number; // For rating type (out of 5)
  ratingColor?: string;
}

interface ProductRevealTheme {
  initialBg?: string;
  initialBgShade?: string;
  cardBg?: string;
  cardRadius?: number;
  cardWidth?: number;
  cardHeight?: number;
  imageAreaHeight?: number;
  finalBg?: string;
  finalBgGradient?: string;
  showGrid?: boolean;
  gridColor?: string;
  gridOpacity?: number;
  showOrbs?: boolean;
  orb1Color?: string;
  orb2Color?: string;
  floatAmplitude?: number;
  floatFrequency?: number;
  // Timing
  imageHoldFrames?: number;
}

interface ProductRevealImage {
  src?: string;
  objectFit?: "contain" | "cover";
}

interface ProductRevealConfig {
  composition?: {
    width?: number;
    height?: number;
    fps?: number;
    durationSeconds?: number;
  };
  theme?: ProductRevealTheme;
  image?: ProductRevealImage;
  footer?: FooterBlock[];
}

export interface ProductRevealProps {
  config?: ProductRevealConfig;
}

// ─── Defaults ──────────────────────────────────────────────────────────────

const DEFAULTS = {
  initialBg: "#2563eb",
  initialBgShade: "rgba(0,0,0,0.1)",
  cardBg: "hsl(0, 0%, 16%)",
  cardRadius: 40,
  cardWidth: 680,
  cardHeight: 880,
  imageAreaHeight: 520,
  finalBg: "#000000",
  finalBgGradient: "",
  showGrid: true,
  gridColor: "rgba(255,255,255,0.5)",
  gridOpacity: 0.06,
  showOrbs: true,
  orb1Color: "rgba(59, 130, 246, 0.08)",
  orb2Color: "rgba(139, 92, 246, 0.06)",
  floatFrequency: 0.04,
  imageHoldFrames: 60,
};

// ─── Footer Block Renderer ───────────────────────────────────────────────────

const FooterBlockRenderer: React.FC<{
  block: FooterBlock;
  cardWidth: number;
}> = ({ block, cardWidth }) => {
  const frame = useCurrentFrame();

  const startFrame = block.enterFrame ?? 0;
  
  const entrance = interpolate(
    frame,
    [startFrame, startFrame + 18],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.22, 1.15, 0.36, 1) }
  );

  const opacity = interpolate(
    frame,
    [startFrame, startFrame + 10],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }
  );

  const translateY = interpolate(entrance, [0, 1], [24, 0]);
  const blur = interpolate(opacity, [0, 1], [4, 0]);

  const isTransitioned = block.transitionFrame && frame >= block.transitionFrame;
  let displayValue = block.value;
  
  if (block.transitionFrame && block.transitionValue !== undefined && frame >= block.transitionFrame) {
    const isNumberStr = (str: string) => /[\d]/.test(str);
    if (isNumberStr(block.value || "") && isNumberStr(block.transitionValue)) {
      const extract = (str: string) => {
        const match = str.match(/([^\d]*)([\d,.]+)(.*)/);
        if (!match) return { prefix: "", num: 0, suffix: "", raw: "" };
        return { prefix: match[1], num: parseFloat(match[2].replace(/,/g, '')), suffix: match[3], raw: match[2] };
      };
      
      const from = extract(block.value || "");
      const to = extract(block.transitionValue);
      
      if (!isNaN(from.num) && !isNaN(to.num)) {
        const countDuration = block.transitionDuration ?? 30;
        const transitionProgress = interpolate(frame, [block.transitionFrame, block.transitionFrame + countDuration], [0, 1], {
          extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic)
        });
        
        const currentNum = interpolate(transitionProgress, [0, 1], [from.num, to.num]);
        const decimals = to.raw.split('.')[1]?.length || 0;
        
        let numStr = currentNum.toFixed(decimals);
        if (to.raw.includes(',')) {
          numStr = Number(currentNum.toFixed(decimals)).toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
          });
        }
        
        // Transition suffix smoothly too (wait until halfway to swap text)
        const currentPrefix = transitionProgress > 0.5 ? to.prefix : from.prefix;
        const currentSuffix = transitionProgress > 0.5 ? to.suffix : from.suffix;
        
        displayValue = `${currentPrefix}${numStr}${currentSuffix}`;
      } else {
        displayValue = block.transitionValue;
      }
    } else {
      displayValue = block.transitionValue;
    }
  }
  const displayColor = isTransitioned && block.transitionColor !== undefined ? block.transitionColor : block.color;

  const align = block.align || "left";

  if (block.type === "spacer") {
    return <div style={{ height: block.fontSize || 20 }} />;
  }

  if (block.type === "rating") {
    const stars = block.ratingValue ?? 4.5;
    const fullStars = Math.floor(stars);
    const halfStar = stars % 1 >= 0.5;
    const starColor = block.ratingColor || "#f59e0b";

    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          opacity,
          transform: `translateY(${translateY}px)`,
          padding: "0 24px",
        }}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} width={32} height={32} viewBox="0 0 24 24">
            <path
              d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
              fill={i < fullStars || (i === fullStars && halfStar) ? starColor : "rgba(255,255,255,0.15)"}
            />
          </svg>
        ))}
        {block.value && (
          <span
            style={{
              fontFamily: interFamily,
              fontSize: block.fontSize || 28,
              fontWeight: 500,
              color: displayColor || "#9a9a99",
              marginLeft: 8,
            }}
          >
            {displayValue}
          </span>
        )}
      </div>
    );
  }

  if (block.type === "badge") {
    return (
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          padding: "0 24px",
        }}
      >
        <span
          style={{
            fontFamily: interFamily,
            fontSize: block.fontSize || 22,
            fontWeight: block.fontWeight || 700,
            color: block.color || "#ffffff",
            backgroundColor: block.bgColor || "rgba(59, 130, 246, 0.3)",
            padding: "8px 22px",
            borderRadius: 999,
            letterSpacing: "0.5px",
            textTransform: "uppercase" as const,
          }}
        >
          {displayValue}
        </span>
      </div>
    );
  }

  if (block.type === "button") {
    return (
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          padding: "12px 24px 0 24px",
          display: "flex",
          justifyContent: align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start",
        }}
      >
        <div
          style={{
            fontFamily: interFamily,
            fontSize: block.fontSize || 26,
            fontWeight: block.fontWeight || 700,
            color: block.color || "#ffffff",
            backgroundColor: block.bgColor || "#2563eb",
            padding: "16px 48px",
            borderRadius: 14,
            letterSpacing: "0.5px",
            textAlign: "center",
          }}
        >
          {displayValue}
        </div>
      </div>
    );
  }

  // Default text blocks: label, title, price, description
  const fontSizeMap: Record<string, number> = {
    label: 22,
    title: 48,
    price: 38,
    description: 26,
  };

  const fontWeightMap: Record<string, number> = {
    label: 800,
    title: 600,
    price: 300,
    description: 400,
  };

  const colorMap: Record<string, string> = {
    label: "#9a9a99",
    title: "#cfcfce",
    price: "#91918f",
    description: "#7a7a79",
  };

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        padding: "0 24px",
        textAlign: align,
      }}
    >
      <span
        style={{
          fontFamily: interFamily,
          fontSize: block.fontSize || fontSizeMap[block.type] || 24,
          fontWeight: block.fontWeight || fontWeightMap[block.type] || 500,
          color: displayColor || colorMap[block.type] || "#ffffff",
          letterSpacing: block.type === "label" ? "1.5px" : "-0.3px",
          textTransform: block.type === "label" ? ("uppercase" as const) : ("none" as const),
          lineHeight: 1.25,
        }}
      >
        {displayValue}
      </span>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const ProductReveal: React.FC<ProductRevealProps> = ({ config: propConfig }) => {
  const frame = useCurrentFrame();
  const { fps, width: compWidth, height: compHeight } = useVideoConfig();

  // Load JSON config
  let fileConfig: ProductRevealConfig;
  try {
    fileConfig = require("./product-reveal.json") as ProductRevealConfig;
  } catch {
    fileConfig = {};
  }

  const merged: ProductRevealConfig = {
    theme: { ...(fileConfig.theme || {}), ...(propConfig?.theme || {}) },
    image: { ...(fileConfig.image || {}), ...(propConfig?.image || {}) },
    footer: propConfig?.footer || fileConfig.footer || [],
  };

  const t = { ...DEFAULTS, ...(merged.theme || {}) };
  const img = merged.image || {};
  const footer = merged.footer || [];
  const imgPath = img.src || "";
  const imgSrc = imgPath.startsWith("http") || imgPath.startsWith("data:") || imgPath.startsWith("/")
    ? imgPath
    : staticFile(imgPath);

  // ─── Image dimension loading ───
  const [imgDims, setImgDims] = React.useState<{ w: number; h: number } | null>(null);
  const [handle] = React.useState(() => delayRender("Loading ProductReveal image"));

  React.useEffect(() => {
    if (!imgPath) {
      setImgDims({ w: 400, h: 400 });
      continueRender(handle);
      return;
    }
    const i = new window.Image();
    i.src = imgSrc;
    i.onload = () => {
      setImgDims({ w: i.naturalWidth, h: i.naturalHeight });
      continueRender(handle);
    };
    i.onerror = () => {
      setImgDims({ w: 400, h: 400 });
      continueRender(handle);
    };
  }, [imgSrc, handle, imgPath]);

  if (!imgDims) return null;

  // ─── Phase Timing ───
  const shrinkStart = t.imageHoldFrames ?? 60;
  const shrinkEnd = shrinkStart + 60;

  // Smooth transition progress (0 = full screen, 1 = card view)
  const transitionProgress = interpolate(frame, [shrinkStart, shrinkEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 1, 0.4, 1),
  });

  // ─── Background Transition ───
  // Phase 1: solid color. Phase 2+: dark background with orbs
  const bgTransition = interpolate(frame, [shrinkStart, shrinkEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // ─── Card Dimensions (animated) ───
  const imgAreaH = t.imageAreaHeight;

  // Calculate footer content height
  let footerHeight = 0;
  const footerGaps = footer.length > 0 ? (footer.length - 1) * 24 : 0; // 24px gap between blocks for safe margin

  footer.forEach((block) => {
    switch (block.type) {
      case "label":
        footerHeight += (block.fontSize || 22) * 1.35;
        break;
      case "title":
        footerHeight += (block.fontSize || 48) * 1.35;
        break;
      case "price":
        footerHeight += (block.fontSize || 38) * 1.35;
        break;
      case "description":
        footerHeight += (block.fontSize || 26) * 1.45;
        break;
      case "badge":
        footerHeight += (block.fontSize || 22) * 1.35 + 16; // badge padding
        break;
      case "button":
        footerHeight += (block.fontSize || 26) * 1.35 + 32; // button padding
        break;
      case "rating":
        footerHeight += Math.max(32, block.fontSize || 28) + 6;
        break;
      case "spacer":
        footerHeight += block.fontSize || 20;
        break;
      default:
        footerHeight += 30;
    }
  });

  // Add container padding and spacing
  const footerPadding = footer.length > 0 ? 40 : 0; // Padding inside footer area
  const cardOuterPadding = 12; // 6px top/bottom padding for card border/glow

  // Use cardHeight from theme if user explicitly set it (and it's not the default 880), otherwise use dynamically calculated height
  const hasExplicitCardHeight = merged.theme && merged.theme.cardHeight !== undefined;
  const targetCardHeight = hasExplicitCardHeight ? t.cardHeight : (imgAreaH + footerHeight + footerGaps + footerPadding + cardOuterPadding);

  // Full screen → card size
  const currentCardWidth = interpolate(transitionProgress, [0, 1], [compWidth, t.cardWidth]);
  const currentCardHeight = interpolate(transitionProgress, [0, 1], [compHeight, targetCardHeight]);
  const currentRadius = interpolate(transitionProgress, [0, 1], [0, t.cardRadius]);

  // Card position (centered)
  const cardX = (compWidth - currentCardWidth) / 2;
  const cardY = (compHeight - currentCardHeight) / 2;

  // ─── Image Size Transition ───
  // Phase 1: large centered image. Phase 2: fits inside card image area
  const imgAreaW = t.cardWidth - 12; // 6px padding each side

  // Calculate render size for both phases
  const imgRatio = imgDims.w / imgDims.h;

  // Phase 1 size (centered, large)
  const phase1MaxW = compWidth * 0.65;
  const phase1MaxH = compHeight * 0.5;
  let p1W: number, p1H: number;
  if (imgRatio > phase1MaxW / phase1MaxH) {
    p1W = phase1MaxW;
    p1H = phase1MaxW / imgRatio;
  } else {
    p1H = phase1MaxH;
    p1W = phase1MaxH * imgRatio;
  }

  // Phase 2 size (inside card image area)
  let p2W: number, p2H: number;
  if (imgRatio > imgAreaW / imgAreaH) {
    p2W = imgAreaW * 0.85;
    p2H = p2W / imgRatio;
  } else {
    p2H = imgAreaH * 0.85;
    p2W = p2H * imgRatio;
  }

  const currentImgW = interpolate(transitionProgress, [0, 1], [p1W, p2W]);
  const currentImgH = interpolate(transitionProgress, [0, 1], [p1H, p2H]);

  // Image position: centered in phase 1, centered in card image area in phase 2
  const p1ImgX = (compWidth - p1W) / 2;
  const p1ImgY = (compHeight - p1H) / 2;

  const p2ImgX = cardX + (currentCardWidth - p2W) / 2;
  const p2ImgY = cardY + 6 + (imgAreaH - p2H) / 2;

  const imgX = interpolate(transitionProgress, [0, 1], [p1ImgX, p2ImgX]);
  const imgY = interpolate(transitionProgress, [0, 1], [p1ImgY, p2ImgY]);

  // ─── Footer visibility (appears after card is formed) ───
  const footerOpacity = interpolate(frame, [shrinkEnd, shrinkEnd + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ─── Card floating (after transition completes) ───
  const isCardFormed = frame > shrinkEnd + 10;
  const floatY = isCardFormed
    ? Math.sin(frame * (t.floatFrequency ?? 0.05)) * (t.floatAmplitude ?? 15)
    : 0;
  const floatRotate = isCardFormed
    ? Math.sin(frame * 0.03) * 0.8
    : 0;

  // ─── Spotlight sweep on card ───
  const spotlightX = interpolate(frame, [shrinkEnd, shrinkEnd + 40], [-100, 200], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.76, 0, 0.24, 1),
  });
  const spotlightOpacity = interpolate(
    frame,
    [shrinkEnd, shrinkEnd + 15, shrinkEnd + 30, shrinkEnd + 40],
    [0, 0.12, 0.12, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // ─── Background orbs ───
  const orb1X = Math.sin(frame / 60) * 120;
  const orb1Y = Math.cos(frame / 50) * 100;
  const orb2X = Math.cos(frame / 70) * -150;
  const orb2Y = Math.sin(frame / 55) * 120;

  // ─── Card Shadow ───
  const cardShadow = interpolate(transitionProgress, [0.5, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ─── Image entrance (phase 1) ───
  const imgEntrance = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 80, mass: 0.8 },
  });
  const imgInitScale = interpolate(imgEntrance, [0, 1], [0.8, 1]);
  const imgInitOpacity = interpolate(imgEntrance, [0, 1], [0, 1]);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {/* Phase 1 Background (solid color) */}
      <AbsoluteFill
        style={{
          backgroundColor: t.initialBg,
          opacity: 1 - bgTransition,
        }}
      >
        {/* Subtle shade overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(circle at 50% 40%, transparent 30%, ${t.initialBgShade} 100%)`,
          }}
        />
      </AbsoluteFill>

      {/* Phase 2 Background (dark with orbs + grid) */}
      <AbsoluteFill
        style={{
          backgroundColor: t.finalBg,
          background: t.finalBgGradient || t.finalBg,
          opacity: bgTransition,
        }}
      >
        {/* Animated orbs */}
        {t.showOrbs && (
          <>
            <div
              style={{
                position: "absolute",
                width: 900,
                height: 900,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${t.orb1Color} 0%, transparent 60%)`,
                filter: "blur(60px)",
                top: "-10%",
                left: "-10%",
                transform: `translate(${orb1X}px, ${orb1Y}px)`,
              }}
            />
            <div
              style={{
                position: "absolute",
                width: 1100,
                height: 1100,
                borderRadius: "50%",
                background: `radial-gradient(circle, ${t.orb2Color} 0%, transparent 60%)`,
                filter: "blur(70px)",
                bottom: "-15%",
                right: "-15%",
                transform: `translate(${orb2X}px, ${orb2Y}px)`,
              }}
            />
          </>
        )}

        {/* Grid */}
        {t.showGrid && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `linear-gradient(90deg, ${t.gridColor} 1px, transparent 1px 45px), linear-gradient(${t.gridColor} 1px, transparent 1px 45px)`,
              backgroundSize: "45px 45px",
              opacity: t.gridOpacity,
              maskImage: "linear-gradient(-20deg, transparent 40%, white)",
              WebkitMaskImage: "linear-gradient(-20deg, transparent 40%, white)",
            }}
          />
        )}
      </AbsoluteFill>

      {/* Card Container */}
      <div
        style={{
          position: "absolute",
          left: cardX,
          top: cardY,
          width: currentCardWidth,
          height: currentCardHeight,
          borderRadius: currentRadius,
          backgroundColor: interpolate(transitionProgress, [0.3, 0.8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }) > 0.01 ? t.cardBg : "transparent",
          transform: `translateY(${floatY}px) rotate(${floatRotate}deg)`,
          overflow: "hidden",
          boxShadow: cardShadow > 0.01
            ? `inset 0 1px 0 0 rgba(255,255,255,${0.08 * cardShadow}), 0 0 0 1px rgba(255,255,255,${0.06 * cardShadow}), 0 4px 12px -4px rgba(0,0,0,${0.6 * cardShadow}), 0 20px 60px -10px rgba(0,0,0,${0.8 * cardShadow})`
            : "none",
          display: "flex",
          flexDirection: "column",
          padding: transitionProgress > 0.5 ? 6 : 0,
        }}
      >
        {/* Spotlight sweep */}
        {transitionProgress > 0.9 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `linear-gradient(105deg, transparent ${spotlightX - 30}%, rgba(255,255,255,${spotlightOpacity}) ${spotlightX}%, transparent ${spotlightX + 30}%)`,
              borderRadius: currentRadius,
              pointerEvents: "none",
              zIndex: 50,
            }}
          />
        )}

        {/* Image area background (only visible in card phase) */}
        {transitionProgress > 0.5 && (
          <div
            style={{
              width: "100%",
              height: imgAreaH,
              borderRadius: t.cardRadius - 4,
              backgroundColor: "hsl(0, 0%, 12%)",
              overflow: "hidden",
              position: "relative",
              opacity: interpolate(transitionProgress, [0.5, 0.9], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {/* Gradient overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(ellipse 80% 80% at 50% 40%, rgba(60,60,60,0.15) 0%, transparent 100%)",
                zIndex: 1,
              }}
            />
          </div>
        )}

        {/* Footer blocks (only in card phase) */}
        {transitionProgress > 0.9 && footer.length > 0 && (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 16,
              opacity: footerOpacity,
              padding: "20px 0",
            }}
          >
            {footer.map((block, i) => (
              <FooterBlockRenderer
                key={i}
                block={block}
                cardWidth={t.cardWidth}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product Image (absolute, transitions from center to card) */}
      {imgPath && (
        <Img
          src={imgSrc}
          style={{
            position: "absolute",
            left: imgX,
            top: imgY,
            width: currentImgW,
            height: currentImgH,
            objectFit: img.objectFit || "contain",
            transform: `scale(${transitionProgress < 0.1 ? imgInitScale : 1}) translateY(${floatY}px)`,
            opacity: transitionProgress < 0.1 ? imgInitOpacity : 1,
            zIndex: 10,
            filter: transitionProgress > 0.5
              ? `drop-shadow(0 10px 20px rgba(0,0,0,0.4)) drop-shadow(0 30px 60px rgba(0,0,0,0.3))`
              : `drop-shadow(0 20px 40px rgba(0,0,0,0.3))`,
            pointerEvents: "none",
          }}
        />
      )}
    </AbsoluteFill>
  );
};

export default ProductReveal;

export const getProductRevealDuration = () => {
  let config: any;
  try {
    config = require("./product-reveal.json");
  } catch {
    config = {};
  }
  
  const comp = config?.composition;
  const fps = comp?.fps ?? 24;
  if (comp?.durationSeconds) return Math.round(comp.durationSeconds * fps);
  if (comp?.durationInFrames) return comp.durationInFrames;

  let maxFrame = (config?.theme?.imageHoldFrames ?? 60) + 60; // Base shrink frame + card form
  
  if (config?.footer && Array.isArray(config.footer)) {
    config.footer.forEach((block: any) => {
      if (block.enterFrame && block.enterFrame > maxFrame) {
        maxFrame = block.enterFrame;
      }
      if (block.transitionFrame && block.transitionFrame > maxFrame) {
        maxFrame = block.transitionFrame;
      }
    });
  }
  
  // 90 frames buffer (3.75s at 24fps) after the last animation completes
  return maxFrame + 90;
};
