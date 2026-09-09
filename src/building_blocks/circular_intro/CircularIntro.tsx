import React from "react";
import {
  Img,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";

export interface CircularIntroProps {
  size?: number; // The width of the bounding box
  imageSrc?: string; // Dynamic image source
  popOutHeight?: number; // How much the image pops out above the circle
}

export const CircularIntro: React.FC<CircularIntroProps> = ({ 
  size = 800,
  imageSrc = "building1.png",
  popOutHeight = 400
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Intrinsic dimensions of the entire animation including pop-out and text
  // The circle is 600px tall. We leave 200px below it for the text.
  const intrinsicWidth = 1000;
  const intrinsicHeight = 600 + 200 + popOutHeight; 

  // The scaling factor to resize the whole component
  const scale = size / intrinsicWidth;

  // 1. Ken Burns / Camera Movement: Slowly zoom the image
  const imageScale = interpolate(frame, [0, 300], [1.22, 1.32], {
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.25, 0.1, 0.25, 1),
  });

  // 2. Organic Floating Animation for the entire main container
  const floatY = Math.sin(frame * 0.05) * 12;
  const rotateAngle = Math.sin(frame * 0.03) * 1.5;

  // 3. Circle entrance scale animation (spring)
  const circleScale = spring({
    frame,
    fps,
    config: {
      damping: 15,
      mass: 0.6,
      stiffness: 90,
    },
  });

  // 4. Text entrance animation (fade-in & slide-up)
  const textOpacity = interpolate(frame, [20, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  
  const textTranslateY = interpolate(frame, [20, 45], [25, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.back(1.5)),
  });

  // 5. Pulsing ambient glow behind the circle
  const glowPulse = interpolate(Math.sin(frame * 0.06), [-1, 1], [0.95, 1.05]);

  return (
    <div
      style={{
        width: size,
        height: intrinsicHeight * scale,
        border: "10px solid black",
        backgroundColor: "transparent",
        overflow: "hidden",
        position: "relative",
        boxSizing: "border-box",
        fontFamily: "'Outfit', 'Inter', -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: intrinsicWidth,
          height: intrinsicHeight,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "absolute",
          top: 0,
          left: 0,
        }}
      >
        {/* Main stacked container */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "absolute",
            top: popOutHeight, // Push down by popOutHeight to allow the image space to pop out
            left: 200, // (1000 - 600) / 2 to center horizontally
            width: 600,
            transform: `translateY(${floatY}px) rotate(${rotateAngle}deg)`,
            transformOrigin: "center center",
            gap: 0,
          }}
        >
          {/* Outer Circle Container (holds circle, glow ring, pop-out, and borders) */}
          <div
            style={{
              position: "relative",
              width: 600,
              height: 600,
              transform: `scale(${circleScale})`,
            }}
          >
            {/* Animated Glow Ring behind the circle */}
            <div
              style={{
                position: "absolute",
                inset: -15,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(56, 189, 248, 0.25) 0%, rgba(30, 58, 138, 0) 70%)",
                transform: `scale(${glowPulse})`,
                filter: "blur(20px)",
                zIndex: 0,
                pointerEvents: "none",
              }}
            />

            {/* Masked Wrapper: Extended horizontally to prevent clipping of outer shadows */}
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: -100,
                right: -100,
                maskImage: "linear-gradient(to top, transparent 0%, transparent 10%, black 30%)",
                WebkitMaskImage: "linear-gradient(to top, transparent 0%, transparent 10%, black 30%)",
                zIndex: 1,
              }}
            >
              {/* Layer 1: Clipped Circle Background and Image */}
              <div
                style={{
                  width: 600,
                  height: 600,
                  borderRadius: "50%",
                  background: "radial-gradient(circle at 50% 30%, #1e3a8a 0%, #0f172a 100%)",
                  boxShadow: `
                    0 30px 60px -15px rgba(15, 23, 42, 0.35),
                    0 0 50px -10px rgba(56, 189, 248, 0.45),
                    inset 0 0 25px rgba(0, 0, 0, 0.6)
                  `,
                  overflow: "hidden",
                  position: "absolute",
                  top: 0,
                  left: 100, // Center in the 800px wide wrapper
                  boxSizing: "border-box",
                }}
              >
                <Img
                  src={staticFile(imageSrc)}
                  style={{
                    position: "absolute",
                    bottom: 10, // Anchored to touch the exact inner bottom border
                    left: 0,
                    width: "100%",
                    height: "auto",
                    transform: `scale(${imageScale})`,
                    transformOrigin: "bottom center", // Pivot point at bottom
                  }}
                />
              </div>

              {/* Layer 3: Solid Blue Border Overlay */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 100,
                  width: 600,
                  height: 600,
                  borderRadius: "50%",
                  border: "10px solid #1e40af",
                  boxSizing: "border-box",
                  pointerEvents: "none",
                }}
              />

              {/* Overlay glass ring */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 100,
                  width: 600,
                  height: 600,
                  borderRadius: "50%",
                  border: "10px solid rgba(255, 255, 255, 0.15)",
                  boxSizing: "border-box",
                  pointerEvents: "none",
                }}
              />
            </div>

            {/* Layer 2 Wrapper: Extended dimensions to allow the building to scale outside the top and sides without getting cut.
                The clipPath removes the bottom 450px (which is the bottom 3/4 of the 600px circle),
                leaving only the top 1/4 of the circle and the overflowing top area unclipped. */}
            <div
              style={{
                position: "absolute",
                top: -popOutHeight,
                left: -200,
                width: 1000,
                height: 600 + popOutHeight,
                clipPath: "inset(0px 0px 450px 0px)",
                zIndex: 4,
                pointerEvents: "none",
              }}
            >
              <Img
                src={staticFile(imageSrc)}
                style={{
                  position: "absolute",
                  bottom: 10, // Anchored to touch the exact inner bottom border
                  left: 200, // Offset for the wrapper's left: -200 to align exactly with Layer 1
                  width: 600,
                  height: "auto",
                  transform: `scale(${imageScale})`,
                  transformOrigin: "bottom center", // Pivot point at bottom
                }}
              />
            </div>
          </div>

          {/* Layer 4: Bold text with dark sky gradient color positioned below the circle */}
          <div
            style={{
              opacity: textOpacity,
              transform: `translateY(${textTranslateY}px)`,
              backgroundImage: "linear-gradient(135deg, #0ea5e9 0%, #0284c7 60%, #0369a1 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              fontWeight: 900,
              fontSize: 76,
              textTransform: "uppercase",
              letterSpacing: "8px",
              marginTop: -45, // Perfect overlap spacing
              zIndex: 6,
              filter: "drop-shadow(0 4px 12px rgba(14, 165, 233, 0.15))",
            }}
          >
            Black Paper
          </div>
        </div>
      </div>
    </div>
  );
};

export default CircularIntro;
