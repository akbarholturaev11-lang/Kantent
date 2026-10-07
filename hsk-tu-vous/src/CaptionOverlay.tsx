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
}> = ({ captions, sceneSections }) => {
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
          top: variant.topInsetPx,
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
            maxWidth: CAPTION_STYLE.maxWidthPx,
            padding: `${variant.verticalPaddingPx}px ${variant.horizontalPaddingPx}px`,
            borderRadius: variant.borderRadiusPx,
            border: variant.border,
            background: variant.background,
            boxShadow: variant.boxShadow,
            color: CAPTION_STYLE.foreground,
            fontSize: variant.fontSizePx,
            fontWeight: variant.fontWeight,
            lineHeight: CAPTION_STYLE.lineHeight,
            textAlign: variant.textAlign,
            textShadow: variant.textShadow,
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
