import { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  groupTimedCaptions,
  type TimedCaption,
} from "../scripts/caption-utils.mjs";
import visualSystem from "../content/visual-system.json";

export type { TimedCaption } from "../scripts/caption-utils.mjs";

const CAPTION_STYLE = visualSystem.captions;

type CaptionSceneSection = {
  startMs: number;
  endMs: number;
  styleId: string;
};

type CaptionVariant = {
  placement: "in-stage";
  topInsetPx?: number;
  fontSizePx: number;
  fontWeight: number;
  textAlign: "center" | "left";
  background: string;
  border: string;
  borderRadiusPx: number;
  horizontalPaddingPx: number;
  verticalPaddingPx: number;
  textShadow: string;
  boxShadow: string;
};

export const CaptionOverlay: React.FC<{
  captions: TimedCaption[];
  sceneSections: CaptionSceneSection[];
  motionDesign?: boolean;
}> = ({ captions, sceneSections, motionDesign = false }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pages = useMemo(
    () =>
      groupTimedCaptions(captions, {
        ...CAPTION_STYLE,
        sections: sceneSections,
      }),
    [captions, sceneSections],
  );
  const timeMs = (frame / fps) * 1000;
  const page = pages.find(
    (entry) => timeMs >= entry.startMs && timeMs < entry.endMs,
  );

  if (!page) return null;

  const variants = CAPTION_STYLE.variants;
  const variant = (variants[page.styleId as keyof typeof variants] ??
    variants.pill) as CaptionVariant;
  const isCtaFooter = page.styleId === "ctaFooter";

  const pageStartFrame = (page.startMs / 1000) * fps;
  const entryFrame = Math.max(0, frame - pageStartFrame);
  const opacity = interpolate(
    entryFrame,
    [0, CAPTION_STYLE.entryFrames],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  const translateY = interpolate(
    entryFrame,
    [0, CAPTION_STYLE.entryFrames],
    [CAPTION_STYLE.entryOffsetPx, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill style={{ pointerEvents: "none", zIndex: 20 }}>
      <div
        style={{
          position: "absolute",
          left: CAPTION_STYLE.leftRightInsetPx,
          right: CAPTION_STYLE.leftRightInsetPx,
          top: motionDesign
            ? isCtaFooter
              ? variant.topInsetPx
              : 1490
            : variant.topInsetPx,
          display: "flex",
          justifyContent: "center",
          opacity,
          scale: interpolate(
            entryFrame,
            [0, CAPTION_STYLE.entryFrames, CAPTION_STYLE.entryFrames + 6],
            [0.92, 1.035, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
          translate: "0 " + translateY + "px",
        }}
      >
        <div
          style={{
            maxWidth: motionDesign ? 960 : CAPTION_STYLE.maxWidthPx,
            padding: motionDesign
              ? "12px 26px"
              : `${variant.verticalPaddingPx}px ${variant.horizontalPaddingPx}px`,
            borderRadius: motionDesign ? 999 : variant.borderRadiusPx,
            border: motionDesign ? "2px solid rgba(255,255,255,.42)" : variant.border,
            background: motionDesign ? "rgba(24,20,25,.86)" : variant.background,
            boxShadow: motionDesign
              ? "0 20px 56px rgba(0,0,0,.32)"
              : variant.boxShadow,
            color: motionDesign ? "#FFF5DF" : CAPTION_STYLE.foreground,
            fontSize: motionDesign ? Math.max(variant.fontSizePx, 48) : variant.fontSizePx,
            fontWeight: variant.fontWeight,
            lineHeight: CAPTION_STYLE.lineHeight,
            textAlign: variant.textAlign,
            textShadow: motionDesign ? "none" : variant.textShadow,
            textWrap: "balance",
            overflowWrap: "anywhere",
          }}
        >
          {page.text}
        </div>
      </div>
    </AbsoluteFill>
  );
};
