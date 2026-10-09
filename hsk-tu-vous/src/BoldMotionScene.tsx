import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
} from "remotion";
import { NarrativeVisual, type VisualFocus } from "./NarrativeVisual";
import type { VisualBeat } from "./EpisodeComposition";

const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
  easing: Easing.bezier(0.16, 1, 0.3, 1),
};

const CREAM = "#FFF5DF";
const INK = "#211915";
const RED = "#E04A40";
const TEAL = "#2FA06A";
const GOLD = "#E9A916";
const FONT_CJK = "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', sans-serif";

const colorField: Record<string, string> = {
  hook: "#17131d",
  near: "#8E1A32",
  far: "#0D5142",
  measure: "#E9A916",
  cta: "#18151d",
};

const accentFor = (sceneId: string, beat: VisualBeat) => {
  if (beat.hero === "个") return INK;
  if (beat.visualFocus === "apple-near") return GOLD;
  if (beat.visualFocus === "apple-far") return "#F8D46A";
  if (sceneId === "hook") return RED;
  if (sceneId === "far") return "#F8D46A";
  if (sceneId === "measure") return beat.hero.startsWith("那") ? TEAL : RED;
  return GOLD;
};

const titleColorFor = (sceneId: string, character: string) => {
  if (sceneId === "hook") {
    if (character === "这") return "#FF6A5D";
    if (character === "那") return "#51D39C";
    return CREAM;
  }
  if (sceneId === "near") {
    if (character === "这" || character === "个") return "#FFD15B";
    return CREAM;
  }
  if (sceneId === "far") {
    if (character === "那" || character === "个") return "#FFD15B";
    return CREAM;
  }
  if (sceneId === "measure") {
    if (character === "这") return RED;
    if (character === "那") return TEAL;
    return INK;
  }
  return CREAM;
};

const heroPlacement = (sceneId: string, beat: VisualBeat) => {
  if (sceneId === "cta") {
    return beat.screenImage
      ? { top: 166, left: 46, right: 46, align: "center" as const, size: 118 }
      : { top: 730, left: 40, right: 40, align: "center" as const, size: 172 };
  }
  if (sceneId === "hook") {
    return { top: 930, left: 22, right: 22, align: "center" as const, size: 286 };
  }
  if (sceneId === "near") {
    return { top: 850, left: 45, right: 34, align: "left" as const, size: 250 };
  }
  if (sceneId === "far") {
    return { top: 830, left: 44, right: 48, align: "right" as const, size: 250 };
  }
  if (beat.hero === "个") {
    return { top: 600, left: 32, right: 32, align: "center" as const, size: 690 };
  }
  if (beat.visualFocus === "apple-near") {
    return { top: 930, left: 42, right: 30, align: "left" as const, size: 255 };
  }
  if (beat.visualFocus === "apple-far") {
    return { top: 900, left: 30, right: 42, align: "right" as const, size: 245 };
  }
  return { top: 820, left: 28, right: 28, align: "center" as const, size: 310 };
};

export const BoldMotionScene: React.FC<{
  sceneId: string;
  beat: VisualBeat;
  previousBeat?: VisualBeat;
  frame: number;
  beatFrame: number;
  accent: string;
}> = ({ sceneId, beat, previousBeat, frame, beatFrame, accent: sceneAccent }) => {
  const isCta = sceneId === "cta";
  const accent = accentFor(sceneId, beat);
  const field = sceneId === "measure" && beat.visualFocus === "apple-near"
    ? "#9B2830"
    : sceneId === "measure" && beat.visualFocus === "apple-far"
      ? "#0D5142"
      : colorField[sceneId] ?? colorField.hook;
  const wipe = interpolate(frame, [0, 23], [-28, 132], clamp);
  const entryOpacity = interpolate(beatFrame, [0, 10], [0.35, 1], clamp);
  const hero = heroPlacement(sceneId, beat);
  const heroSize = beat.hero === "个"
    ? hero.size
    : beat.hero.length > 5
      ? hero.size * 0.88
      : (sceneId === "near" || sceneId === "far") && beat.chinese && beat.hero.length > 3
        ? hero.size * 0.82
        : hero.size;
  const pinyinColor = sceneId === "measure" && beat.hero === "个"
    ? INK
    : sceneId === "hook"
      ? CREAM
      : accent;
  const appleTop = sceneId === "measure" && beat.hero === "个" ? 210 : 220;
  const watermark = beat.visualFocus === "apple-near"
    ? "这"
    : beat.visualFocus === "apple-far"
      ? "那"
      : beat.hero === "个"
        ? "个"
        : sceneId === "hook"
          ? "远近"
          : beat.hero;
  const watermarkColor = sceneId === "near"
    ? "#FFEBD1"
    : sceneId === "far"
      ? "#C5F2DB"
      : sceneId === "measure"
        ? INK
        : CREAM;
  const watermarkRotation = sceneId === "far" ? 7 : sceneId === "near" ? -8 : -5;
  const previousOpacity = interpolate(beatFrame, [0, 14], [0.42, 0], clamp);
  const logoY = isCta && !beat.screenImage ? 485 : 74;
  const logoSize = isCta && !beat.screenImage ? 200 : 62;
  const imageWidth = Math.min((beat.screenImageWidthPx ?? 860) * 1.1, 1020);
  const imageHeight = Math.min((beat.screenImageHeightPx ?? 1120) * 1.05, 1250);

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        background: "#17131d",
        color: CREAM,
        isolation: "isolate",
      }}
    >
      <AbsoluteFill
        style={{
          background: field,
          backgroundImage: sceneId === "measure" && beat.hero !== "个"
            ? undefined
            : `radial-gradient(circle at ${sceneId === "far" ? "80% 16%" : "18% 20%"}, ${sceneAccent}66, transparent 46%), linear-gradient(145deg, ${field} 0%, ${sceneId === "near" ? "#5D1428" : sceneId === "far" ? "#082E2A" : sceneId === "measure" ? "#F6D56C" : field} 100%)`,
          clipPath: `polygon(0 0, ${wipe}% 0, ${wipe - 20}% 100%, 0 100%)`,
          zIndex: 0,
        }}
      />

      <AbsoluteFill style={{ pointerEvents: "none", zIndex: 1 }}>
        <svg viewBox="0 0 1080 1920" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
          <defs>
            <radialGradient id={`bold-halo-${sceneId}`}>
              <stop offset="0" stopColor={sceneAccent} stopOpacity=".5" />
              <stop offset="1" stopColor={sceneAccent} stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`bold-streak-${sceneId}`} x1="0" x2="1">
              <stop offset="0" stopColor={sceneAccent} stopOpacity="0" />
              <stop offset=".5" stopColor={sceneAccent} stopOpacity=".88" />
              <stop offset="1" stopColor={CREAM} stopOpacity="0" />
            </linearGradient>
          </defs>
          <ellipse
            cx={sceneId === "far" ? 820 : 255}
            cy={sceneId === "near" ? 700 : 350}
            rx="480"
            ry="620"
            fill={`url(#bold-halo-${sceneId})`}
            opacity=".58"
          />
          <ellipse
            cx="540"
            cy="960"
            rx="500"
            ry="720"
            fill="none"
            stroke={CREAM}
            strokeOpacity=".2"
            strokeWidth="3"
            strokeDasharray="2 24"
            strokeDashoffset={-frame * 1.4}
            transform={`rotate(${frame * 0.12} 540 960)`}
          />
          <path
            d={`M-140 ${1210 + Math.sin(frame / 17) * 48} C250 ${820 - Math.sin(frame / 23) * 60} 500 ${1180 + Math.sin(frame / 19) * 45} 1220 540`}
            fill="none"
            stroke={`url(#bold-streak-${sceneId})`}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray="10 28"
            strokeDashoffset={-frame * 2.2}
          />
          <circle
            cx={540 + Math.sin(frame / 13) * 240}
            cy={960 + Math.cos(frame / 17) * 430}
            r="14"
            fill={sceneAccent}
            stroke={CREAM}
            strokeOpacity=".56"
            strokeWidth="3"
          />
          <path
            d={`M-80 ${430 + frame * 8} H1120`}
            fill="none"
            stroke={sceneAccent}
            strokeOpacity=".38"
            strokeWidth="5"
          />
        </svg>
      </AbsoluteFill>

      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          zIndex: 2,
          top: sceneId === "near" ? -50 : sceneId === "far" ? 120 : 20,
          left: sceneId === "far" ? "auto" : -180,
          right: sceneId === "far" ? -210 : "auto",
          maxWidth: "none",
          whiteSpace: "nowrap",
          fontFamily: FONT_CJK,
          fontSize: sceneId === "measure" ? 1120 : 920,
          fontWeight: 950,
          letterSpacing: "-.1em",
          lineHeight: 1,
          color: watermarkColor,
          opacity: sceneId === "cta" ? 0.1 : 0.16,
          rotate: `${watermarkRotation + Math.sin(frame / 23) * 1.5}deg`,
          translate: `${Math.sin(frame / 18) * 18}px ${Math.cos(frame / 24) * 12}px`,
          scale: interpolate(frame, [0, 24], [0.92, 1.04], clamp),
          textShadow: `0 28px 90px ${sceneAccent}88`,
          pointerEvents: "none",
        }}
      >
        {watermark}
      </div>

      <div
        style={{
          position: "absolute",
          zIndex: 8,
          top: 74,
          left: 72,
          display: "flex",
          alignItems: "center",
          gap: 14,
          color: CREAM,
          fontSize: 34,
          fontWeight: 950,
          letterSpacing: ".04em",
          textShadow: "0 5px 20px rgba(0,0,0,.24)",
        }}
      >
        <Img
          src={staticFile("branding/hsk-ai-logo-1024.png")}
          style={{
            width: 56,
            height: 56,
            objectFit: "cover",
            borderRadius: 16,
            boxShadow: `0 10px 30px ${RED}66`,
          }}
        />
        HSK <span style={{ color: GOLD, marginLeft: -10 }}>AI</span>
      </div>

      {previousBeat && (
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            zIndex: 1,
            top: hero.top,
            left: hero.left,
            right: hero.right,
            color: CREAM,
            opacity: previousOpacity,
            fontFamily: previousBeat.chinese ? FONT_CJK : "inherit",
            fontSize: heroSize * 1.18,
            fontWeight: 950,
            lineHeight: 0.92,
            textAlign: hero.align,
            whiteSpace: "nowrap",
            letterSpacing: "-.08em",
            translate: `${interpolate(beatFrame, [0, 14], [90, -180], clamp)}px 0`,
            rotate: "-4deg",
            pointerEvents: "none",
          }}
        >
          {previousBeat.hero}
        </div>
      )}

      {beat.visualFocus && (
        <div
          style={{
            position: "absolute",
            zIndex: 2,
            left: -260,
            top: appleTop,
            width: 1600,
            height: 500,
            scale: interpolate(beatFrame, [0, 15, 28], [0.74, 1.04, 1], clamp),
            rotate: `${interpolate(beatFrame, [0, 18], [sceneId === "far" ? 7 : -5, 0], clamp)}deg`,
            transformOrigin: "center center",
          }}
        >
          <NarrativeVisual
            focus={beat.visualFocus as VisualFocus}
            localFrame={beatFrame}
            accent={accent}
            motionDesign
            motionHeight={500}
          />
        </div>
      )}

      {beat.brandLogo && (
        <Img
          src={staticFile("branding/hsk-ai-logo-1024.png")}
          style={{
            position: "absolute",
            zIndex: 4,
            top: logoY,
            left: "50%",
            width: logoSize,
            height: logoSize,
            objectFit: "cover",
            borderRadius: isCta ? 38 : 18,
            translate: "-50% 0",
            scale: interpolate(beatFrame, [0, 12, 25], [0.55, 1.08, 1], clamp),
            boxShadow: `0 24px 80px ${RED}88`,
          }}
        />
      )}

      {beat.screenImage && (
        <div
          style={{
            position: "absolute",
            zIndex: 5,
            top: 330,
            left: "50%",
            width: imageWidth,
            maxWidth: "90vw",
            height: imageHeight,
            borderRadius: 34,
            padding: 10,
            boxSizing: "border-box",
            background: "linear-gradient(145deg, #fff8e8, #f1dba8)",
            boxShadow: `0 42px 120px rgba(0,0,0,.48), 0 0 0 2px ${accent}99`,
            translate: "-50% 0",
            rotate: `${interpolate(beatFrame, [0, 22], [3, 0], clamp)}deg`,
            scale: interpolate(beatFrame, [0, 18, 30], [0.72, 1.035, 1], clamp),
            transformOrigin: "center top",
          }}
        >
          <Img
            src={staticFile(beat.screenImage)}
            style={{
              display: "block",
              width: "100%",
              height: "100%",
              objectFit: "contain",
              borderRadius: 25,
            }}
          />
          {beat.screenHighlight && (
            <svg
              aria-hidden="true"
              viewBox={`0 0 ${beat.screenImageWidthPx ?? 860} ${beat.screenImageHeightPx ?? 1120}`}
              preserveAspectRatio="xMidYMid meet"
              style={{
                position: "absolute",
                inset: 10,
                width: "calc(100% - 20px)",
                height: "calc(100% - 20px)",
                opacity: interpolate(beatFrame, [0, 10], [0, 1], clamp),
                pointerEvents: "none",
              }}
            >
              <rect
                x={(beat.screenHighlight.leftPercent / 100) * (beat.screenImageWidthPx ?? 860)}
                y={(beat.screenHighlight.topPercent / 100) * (beat.screenImageHeightPx ?? 1120)}
                width={(beat.screenHighlight.widthPercent / 100) * (beat.screenImageWidthPx ?? 860)}
                height={(beat.screenHighlight.heightPercent / 100) * (beat.screenImageHeightPx ?? 1120)}
                rx={22}
                fill={`${accent}24`}
                stroke={accent}
                strokeWidth={6}
                vectorEffect="non-scaling-stroke"
                style={{filter: `drop-shadow(0 0 4px rgba(255,255,255,.78)) drop-shadow(0 0 12px ${accent})`}}
              />
            </svg>
          )}
        </div>
      )}

      {!beat.screenImage && !beat.actionIcon && (
        <div
          style={{
            position: "absolute",
            zIndex: 6,
            top: hero.top,
            left: hero.left,
            right: hero.right,
            display: "flex",
            flexDirection: "column",
            alignItems: hero.align === "center" ? "center" : hero.align === "left" ? "flex-start" : "flex-end",
            textAlign: hero.align,
            opacity: entryOpacity,
            fontFamily: beat.chinese ? FONT_CJK : "inherit",
            maxWidth: 1010,
            marginInline: "auto",
            textShadow: `0 22px 60px rgba(0,0,0,.22), 0 0 38px ${accent}88`,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: hero.align === "center" ? "center" : hero.align === "left" ? "flex-start" : "flex-end",
              alignItems: "center",
              width: "100%",
              whiteSpace: "nowrap",
              fontSize: heroSize,
              lineHeight: 0.9,
              fontWeight: 950,
              letterSpacing: beat.hero.length > 4 ? "-.09em" : "-.055em",
              perspective: 1100,
            }}
          >
            {Array.from(beat.hero).map((character, index) => {
              const delay = index * 2;
              const xStart = index % 2 === 0 ? -420 : 420;
              const rotateStart = index % 2 === 0 ? -18 : 18;
              const glyphColor = beat.chinese
                ? titleColorFor(sceneId, character)
                : sceneId === "cta"
                  ? CREAM
                  : character === " "
                    ? "transparent"
                    : accent;
              return (
                <span
                  key={`${character}-${index}`}
                  style={{
                    display: "inline-block",
                    color: glyphColor,
                    opacity: interpolate(beatFrame, [delay, delay + 6], [0, 1], clamp),
                    translate: `${interpolate(beatFrame, [delay, delay + 18], [xStart, 0], clamp)}px ${interpolate(beatFrame, [delay, delay + 18], [index % 2 ? -130 : 130, 0], clamp)}px`,
                    scale: interpolate(beatFrame, [delay, delay + 9, delay + 19], [0.32, 1.12, 1], clamp),
                    rotate: `${interpolate(beatFrame, [delay, delay + 18], [rotateStart, 0], clamp)}deg`,
                    transformOrigin: "50% 72%",
                    textShadow: `0 18px 0 rgba(0,0,0,.13), 0 34px 68px rgba(0,0,0,.24), 0 0 42px ${accent}88`,
                  }}
                >
                  {character}
                </span>
              );
            })}
          </div>
          {beat.pinyin && (
            <div
              style={{
                marginTop: 26,
                color: pinyinColor,
                fontFamily: "inherit",
                fontSize: sceneId === "hook" ? 76 : 68,
                fontWeight: 900,
                letterSpacing: ".025em",
                textShadow: "0 7px 22px rgba(0,0,0,.24)",
              }}
            >
              {beat.pinyin}
            </div>
          )}
          {beat.meaning && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 15,
                marginTop: 24,
                padding: "18px 30px",
                borderRadius: 999,
                color: CREAM,
                background: "rgba(20,16,20,.76)",
                border: "2px solid rgba(255,255,255,.36)",
                fontFamily: "inherit",
                fontSize: 44,
                fontWeight: 850,
                boxShadow: `0 20px 60px rgba(0,0,0,.24), 0 0 30px ${accent}77`,
              }}
            >
              <span
                style={{
                  width: 15,
                  height: 15,
                  borderRadius: "50%",
                  background: accent,
                  boxShadow: `0 0 24px ${accent}`,
                  flexShrink: 0,
                }}
              />
              {beat.meaning}
            </div>
          )}
        </div>
      )}

      {beat.screenImage && (
        <div
          style={{
            position: "absolute",
            zIndex: 7,
            top: 185,
            left: 44,
            right: 44,
            color: CREAM,
            textAlign: "center",
            fontSize: 118,
            lineHeight: 0.92,
            fontWeight: 950,
            letterSpacing: "-.055em",
            textShadow: `0 12px 42px rgba(0,0,0,.5), 0 0 42px ${accent}aa`,
            opacity: entryOpacity,
          }}
        >
          {beat.hero}
        </div>
      )}

      {beat.brandLogo && isCta && (
        <div
          style={{
            position: "absolute",
            zIndex: 7,
            top: 1010,
            left: 40,
            right: 40,
            color: CREAM,
            textAlign: "center",
            fontSize: 156,
            fontWeight: 950,
            letterSpacing: "-.055em",
            textShadow: `0 22px 70px rgba(0,0,0,.4), 0 0 38px ${RED}88`,
          }}
        >
          {beat.hero}
          {beat.meaning && (
            <div style={{ marginTop: 26, fontSize: 54, color: GOLD, letterSpacing: ".08em" }}>
              {beat.meaning}
            </div>
          )}
        </div>
      )}
    </AbsoluteFill>
  );
};
