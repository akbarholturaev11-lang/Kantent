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
import { subtitleSlotFor } from "../scripts/illustrated-layout.mjs";
import { actionTextAtFrame, actionSubtitlePresentation, type ActionCaptionScene } from "../scripts/action-text-layout.mjs";

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
  plainMotionDesign?: boolean;
  actionCaptionScenes?: ActionCaptionScene[];
}> = ({ captions, sceneSections, motionDesign = false, plainMotionDesign = false, actionCaptionScenes = [] }) => {
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
  const plainMotionCaption = motionDesign && plainMotionDesign && !isCtaFooter;
  const actionText = isCtaFooter ? null : actionTextAtFrame(actionCaptionScenes, frame);
  const presentation = actionSubtitlePresentation(page.text, actionText);
  const displayText = presentation.text;
  if (!displayText) return null;

  const pageStartFrame = (page.startMs / 1000) * fps;
  const entryFrame = Math.max(0, frame - pageStartFrame);
  // Reference-glass lessons (owner decision 2026-11-09): white kinetic words
  // without a box, each word blurring in, Hanzi in brand gold with pinyin.
  if (actionText && motionDesign) {
    const G = visualSystem.referenceGlass;
    const ease = { extrapolateLeft: "clamp" as const, extrapolateRight: "clamp" as const };
    // A spoken Hanzi phrase the glass chip already shows (with pinyin and
    // meaning) is not repeated as a second text line.
    const han = (value: string) => (value.match(/\p{Script=Han}/gu) ?? []).join("");
    const spokenHan = han(displayText);
    if (spokenHan && !/[^\p{Script=Han}\p{P}\p{Z}]/u.test(displayText) &&
        han(String(actionText.model?.hanzi ?? "")).includes(spokenHan)) return null;
    const words = displayText.split(/\s+/).filter(Boolean);
    const illustration = (actionText.model as {illustration?: unknown} | undefined)?.illustration;
    const slot = illustration ? subtitleSlotFor(illustration) : null;
    return (
      <AbsoluteFill style={{ pointerEvents: "none", zIndex: 20 }}>
        <div data-subtitle-block style={{ position: "absolute", left: slot ? slot.left : 80, right: slot ? 1080 - slot.right : 80,
          // Illustrated beats: the first safe-zone slot that covers no head/card.
          top: slot ? slot.top : G.subtitleTopPx,
          display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "baseline", columnGap: 16,
          fontFamily: G.fontFamily, fontSize: G.subtitleFontPx, fontWeight: G.subtitleWeight, lineHeight: 1.15,
          color: "#FFFFFF", textShadow: "0 4px 24px rgba(0,0,0,.45)", textAlign: "center" }}>
          <span data-subtitle-text style={{ display: "contents" }}>{words.map((word, index) => {
            const p = interpolate(entryFrame, [index * G.wordStaggerFrames, index * G.wordStaggerFrames + G.wordEntryFrames], [0, 1], ease);
            const han = /\p{Script=Han}/u.test(word);
            return <span key={index} style={{ display: "inline-block", opacity: p, filter: `blur(${(1 - p) * 8}px)`,
              translate: `0 ${(1 - p) * 10}px`, color: han ? visualSystem.colors.brandGold : undefined,
              fontFamily: han ? G.hanziFontFamily : undefined }}>{word}</span>;
          })}</span>
          {presentation.pinyin && <span data-subtitle-pinyin style={{ fontSize: Math.round(G.subtitleFontPx * .62),
            fontWeight: 600, color: visualSystem.colors.brandGold, opacity: interpolate(entryFrame, [2, 2 + G.wordEntryFrames], [0, 1], ease) }}>
            {presentation.pinyin}</span>}
        </div>
      </AbsoluteFill>
    );
  }
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
              : actionText ? visualSystem.narratedActionLayout.subtitleTopPx
                : plainMotionDesign ? visualSystem.narratedMotionLayout.captionTopPx : 1490
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
          data-subtitle-block
          style={{
            maxWidth: motionDesign ? 960 : CAPTION_STYLE.maxWidthPx,
            padding: plainMotionCaption
              ? "8px 18px"
              : motionDesign && !plainMotionDesign
              ? "12px 26px"
              : `${variant.verticalPaddingPx}px ${variant.horizontalPaddingPx}px`,
            borderRadius: plainMotionCaption ? 16 : motionDesign && !plainMotionDesign ? 999 : variant.borderRadiusPx,
            border: plainMotionCaption
              ? "1px solid rgba(33,29,23,.16)"
              : motionDesign && !plainMotionDesign ? "2px solid rgba(255,255,255,.42)" : variant.border,
            background: plainMotionCaption
              ? "rgba(253,249,240,.96)"
              : motionDesign && !plainMotionDesign ? "rgba(24,20,25,.86)" : variant.background,
            boxShadow: plainMotionCaption
              ? "0 8px 24px rgba(33,29,23,.16)"
              : motionDesign && !plainMotionDesign
              ? "0 20px 56px rgba(0,0,0,.32)"
              : variant.boxShadow,
            color: plainMotionCaption
              ? visualSystem.colors.foreground
              : motionDesign ? "#FFF5DF" : CAPTION_STYLE.foreground,
            fontSize: actionText ? visualSystem.narratedActionLayout.subtitleFontPx
              : motionDesign ? Math.max(variant.fontSizePx, 48) : variant.fontSizePx,
            fontWeight: variant.fontWeight,
            lineHeight: CAPTION_STYLE.lineHeight,
            textAlign: variant.textAlign,
            textShadow: motionDesign ? "none" : variant.textShadow,
            textWrap: "balance",
            overflowWrap: "anywhere",
          }}
        >
          <span data-subtitle-text>{presentation.focus
            ? displayText.split(presentation.focus).map((part, index) => <span key={index}>
                {index > 0 && <span style={{color: visualSystem.colors.brandGold}}>{presentation.focus}</span>}{part}
              </span>)
            : displayText}</span>
          {presentation.pinyin && <span data-subtitle-pinyin style={{marginLeft: 20,
            fontSize: visualSystem.narratedMotionLayout.pinyinFontPx,
            color: visualSystem.colors.brandGold}}>{presentation.pinyin}</span>}
          {presentation.examples.map((example, index) => <span key={index} data-subtitle-example
            style={{display: "inline-block", marginLeft: 20}}>
            {index > 0 && <span style={{marginRight: 20}}>·</span>}
            {example.focus ? example.text.split(example.focus).map((part, partIndex) => <span key={partIndex}>
              {partIndex > 0 && <span style={{color: visualSystem.colors.brandGold}}>{example.focus}</span>}{part}
            </span>) : example.text}
          </span>)}
        </div>
      </div>
    </AbsoluteFill>
  );
};
