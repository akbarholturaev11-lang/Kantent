import { useMemo } from "react";
import {
  AbsoluteFill,
  Audio,
  Composition,
  Easing,
  interpolate,
  Img,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { buildCaptionSections } from "../scripts/caption-utils.mjs";
import seedEpisode from "../content/episodes/ni-nin-nimen-20260928.json";
import visualSystem from "../content/visual-system.json";
import { CaptionOverlay, type TimedCaption } from "./CaptionOverlay";
import { BoldMotionScene } from "./BoldMotionScene";
import { NarrativeVisual, type VisualFocus } from "./NarrativeVisual";

type LessonCard = {
  hanzi: string;
  pinyin: string;
  meaning: string;
};

type LessonScene = {
  id: string;
  kind: string;
  headline: string;
  narration: string;
  screenCaption?: string;
  editPlan?: string;
  visualBeats?: VisualBeat[];
  durationSec?: number;
  durationFrames?: number;
  startMs?: number;
  endMs?: number;
  captionStyleId?: keyof typeof visualSystem.captions.variants;
  audioDurationMs?: number;
  audioSrc?: string;
  cards?: LessonCard[];
};

type LessonEpisode = {
  id: string;
  languageCode: string;
  title: string;
  level: string;
  topic: string;
  durationTargetSec?: number;
  scenes: LessonScene[];
  audioSrc?: string;
  backgroundMusicSrc?: string;
  audioDurationMs?: number;
  audioTrimAfterFrames?: number;
  sourceAudioDurationMs?: number;
  captions?: TimedCaption[];
  captionSource?: string;
};

type EpisodeProps = { episode: LessonEpisode };
export type VisualBeat = {
  hero: string;
  pinyin?: string;
  meaning?: string;
  chinese?: boolean;
  brandLogo?: boolean;
  actionIcon?: "bookmark" | "comment" | "app-download" | "direct-message";
  transitionStyle?: "mask-reveal" | "slide-match" | "type-reveal";
  ctaButton?: string;
  motion?: "pop" | "slide" | "pulse" | "reveal";
  detailRevealStyle?: "sheet-unfold";
  visualFocus?: VisualFocus;
  syncCueText?: string;
  toneContour?: "falling" | "neutral";
  enterAtSceneStart?: boolean;
  screenImage?: string;
  screenImageWidthPx?: number;
  screenImageHeightPx?: number;
  screenHighlight?: {
    leftPercent: number;
    topPercent: number;
    widthPercent: number;
    heightPercent: number;
  };
};
type CommentActionTiming = {
  typingStartFrame: number;
  typingDurationFrames: number;
  submitFrame: number;
};

const FPS = 30;
const ACCENTS = visualSystem.colors.accents;
const COLORS = visualSystem.colors;
const MOTION = visualSystem.motion;
const SOUND = visualSystem.sound;
const EASE = Easing.bezier(0.18, 0.82, 0.2, 1);
const alphaHex = (value: number) =>
  Math.round(value * 255)
    .toString(16)
    .padStart(2, "0");
const FONT_CJK =
  "'PingFang SC', 'Hiragino Sans GB', 'Noto Sans CJK SC', sans-serif";

const sceneFrames = (scene: LessonScene) =>
  Math.max(
    1,
    scene.durationFrames ?? Math.ceil((scene.durationSec ?? 4) * FPS),
  );

const clampEase = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
  easing: EASE,
};

const getBeats = (scene: LessonScene): VisualBeat[] => {
  if (scene.visualBeats?.length) return scene.visualBeats;
  const card = scene.cards?.[0];

  if (scene.kind === "hook") {
    return [{ hero: scene.headline, meaning: scene.screenCaption }];
  }

  if (scene.kind === "vocabulary") {
    return (scene.cards ?? []).map((item) => ({
      hero: item.hanzi,
      pinyin: item.pinyin,
      meaning: item.meaning,
      chinese: true,
    }));
  }

  if (scene.kind === "example" && card) {
    return [
      {
        hero: card.hanzi,
        pinyin: card.pinyin,
        meaning: card.meaning,
        chinese: true,
      },
      { hero: card.pinyin, pinyin: card.hanzi, chinese: true },
      { hero: card.meaning, pinyin: card.hanzi, chinese: true },
    ];
  }

  if (scene.kind === "context") {
    return [{ hero: scene.headline, meaning: scene.screenCaption }];
  }

  if (scene.kind === "cta") {
    // Fail closed. The current CTA has a registered, word-synced visual sequence.
    // Never fabricate fallback comment/DM instructions or unapproved CTA artwork.
    throw new Error(
      "CTA scene requires explicit current visualBeats from the approved CTA Lab.",
    );
  }

  if (card) {
    return [
      {
        hero: card.hanzi,
        pinyin: card.pinyin,
        meaning: card.meaning,
        chinese: true,
      },
    ];
  }
  return [{ hero: scene.headline }];
};

const focusSize = (text: string, chinese = false) => {
  if (text === "?") return 280;
  if (chinese) {
    if (text.length <= 2) return 280;
    if (text.length <= 4) return 214;
    if (text.length <= 6) return 172;
    return 120;
  }
  if (text.length <= 6) return 150;
  if (text.length <= 10) return 116;
  if (text.length <= 16) return 88;
  return 66;
};

const motionAccentForBeat = (beat: VisualBeat, fallback: string) => {
  if (beat.hero === "个") return COLORS.brandGold;
  if (beat.visualFocus === "apple-near" || beat.hero.startsWith("这")) {
    return COLORS.brandRed;
  }
  if (beat.visualFocus === "apple-far" || beat.hero.startsWith("那")) {
    return COLORS.brandTeal;
  }
  return fallback;
};

const normalizeCueText = (text: string) =>
  text
    .toLocaleLowerCase("ru-RU")
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]/gu, "");

const ActionVisual: React.FC<{
  type: "bookmark" | "comment" | "app-download" | "direct-message";
  frame: number;
  accent: string;
  commentTiming?: CommentActionTiming;
  detailRevealStyle?: "sheet-unfold";
}> = ({
  type,
  frame,
  accent,
  commentTiming,
  detailRevealStyle,
}) => {
  const settle = interpolate(frame, [0, 9], [0.86, 1], clampEase);
  const filled = interpolate(frame, [6, 13], [0, 1], clampEase);
  const check = interpolate(frame, [10, 17], [54, 0], clampEase);
  const messageDraw = interpolate(frame, [0, 13], [370, 0], clampEase);
  const halo = interpolate(frame, [0, 7, 22], [0.18, 0.52, 0.28], clampEase);

  if (type === "comment") {
    const timing = commentTiming ?? {
      typingStartFrame: MOTION.ctaCommentTypingFallbackFrame,
      typingDurationFrames: MOTION.ctaCommentTypingFrames,
      submitFrame: MOTION.ctaCommentSubmitFallbackFrame,
    };
    const typingDuration = Math.max(1, timing.typingDurationFrames);
    const typeFrames = [
      timing.typingStartFrame,
      timing.typingStartFrame + typingDuration / 3,
      timing.typingStartFrame + (typingDuration * 2) / 3,
      timing.typingStartFrame + typingDuration,
    ];
    const postRevealStartFrame =
      timing.submitFrame +
      MOTION.ctaCommentSendPressFrames +
      MOTION.ctaCommentDraftHandoffFrames;
    const postRevealEndFrame =
      postRevealStartFrame + MOTION.ctaCommentPostRevealFrames;
    const typedCount = Math.min(
      3,
      Math.floor(interpolate(frame, typeFrames, [0, 1, 2, 3], clampEase)),
    );
    const submitted = interpolate(
      frame,
      [postRevealStartFrame, postRevealEndFrame],
      [0, 1],
      clampEase,
    );
    const press = interpolate(
      frame,
      [
        timing.submitFrame,
        timing.submitFrame + MOTION.ctaCommentSendPressFrames / 2,
        timing.submitFrame + MOTION.ctaCommentSendPressFrames,
      ],
      [1, 0.97, 1],
      clampEase,
    );
    const commentRise = interpolate(
      frame,
      [postRevealStartFrame, postRevealEndFrame],
      [10, 0],
      clampEase,
    );
    const sheetFold = interpolate(
      frame,
      [postRevealStartFrame, postRevealEndFrame],
      [MOTION.ctaCommentSheetFoldStartDeg, 0],
      clampEase,
    );
    const sheetScaleY = interpolate(
      frame,
      [postRevealStartFrame, postRevealEndFrame],
      [0.88, 1],
      clampEase,
    );
    const draftOpacity = interpolate(frame, [
      timing.submitFrame + MOTION.ctaCommentSendPressFrames,
      postRevealStartFrame,
    ], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: EASE,
    });

    return (
      <div
        style={{
          width: "100%",
          maxWidth: 640,
          margin: "30px auto 10px",
          height: 128,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            gap: 15,
            padding: "16px 18px",
            boxSizing: "border-box",
            borderRadius: 28,
            border: `1px solid ${accent}75`,
            background: COLORS.surface,
            boxShadow: `0 12px 40px ${accent}16`,
            opacity: draftOpacity,
            scale: press,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              background: `${accent}35`,
              color: COLORS.foreground,
              fontSize: 19,
              fontWeight: 900,
            }}
          >
            A
          </div>
          <div
            style={{
              flex: 1,
              minHeight: 56,
              display: "flex",
              alignItems: "center",
              color: typedCount ? COLORS.foreground : COLORS.muted,
              fontSize: 32,
              fontWeight: typedCount ? 850 : 550,
              letterSpacing: ".01em",
              textAlign: "left",
            }}
          >
            {typedCount ? "HSK".slice(0, typedCount) : "Напишите комментарий"}
            {frame < timing.submitFrame && typedCount > 0 && typedCount < 3 && (
              <span
                style={{
                  width: 3,
                  height: 36,
                  marginLeft: 4,
                  background: COLORS.foreground,
                  opacity: 0.9,
                }}
              />
            )}
          </div>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: "50%",
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              background: `${accent}${alphaHex(0.88)}`,
              color: COLORS.foreground,
              boxShadow: `0 8px 24px ${accent}55`,
            }}
          >
            <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
              <path
                d="M5 16h19m-8-8 8 8-8 8"
                fill="none"
                stroke="currentColor"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="44"
                strokeDashoffset={interpolate(
                  frame,
                  [timing.typingStartFrame, timing.typingStartFrame + typingDuration],
                  [44, 0],
                  clampEase,
                )}
              />
            </svg>
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            gap: 15,
            minHeight: 128,
            padding: "15px 18px",
            boxSizing: "border-box",
            borderRadius: 28,
            border: `1px solid ${accent}55`,
            background: `linear-gradient(110deg, ${accent}20, ${COLORS.surface})`,
            opacity: submitted,
            translate: `0 ${commentRise}px`,
            transform:
              detailRevealStyle === "sheet-unfold"
                ? `perspective(${MOTION.ctaCommentSheetFoldPerspectivePx}px) rotateX(${sheetFold}deg) scaleY(${sheetScaleY})`
                : undefined,
            transformOrigin: "top center",
            backfaceVisibility: "hidden",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              background: `${accent}45`,
              color: COLORS.foreground,
              fontSize: 19,
              fontWeight: 900,
            }}
          >
            A
          </div>
          <div style={{ flex: 1, textAlign: "left" }}>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 12,
                color: COLORS.foreground,
                fontSize: 21,
                fontWeight: 800,
              }}
            >
              Вы
              <span style={{ color: COLORS.muted, fontSize: 17, fontWeight: 550 }}>
                сейчас
              </span>
            </div>
            <div
              style={{
                marginTop: 5,
                color: COLORS.foreground,
                fontSize: 38,
                fontWeight: 900,
                letterSpacing: ".015em",
              }}
            >
              HSK
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              alignSelf: "flex-end",
              padding: "9px 13px",
              borderRadius: 999,
              background: `${accent}30`,
              color: COLORS.foreground,
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: ".07em",
              whiteSpace: "nowrap",
            }}
          >
            <span style={{ color: accent, fontSize: 19, lineHeight: 1 }}>✓</span>
            ОТПРАВЛЕНО
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: 164,
        height: 164,
        display: "grid",
        placeItems: "center",
        margin: "13px auto 4px",
        borderRadius: 42,
        border: `1px solid ${accent}75`,
        background: `radial-gradient(circle, ${accent}${alphaHex(halo)} 0%, ${COLORS.background} 72%)`,
        boxShadow: `0 0 54px ${accent}${alphaHex(halo)}`,
        scale: settle,
      }}
    >
      <svg viewBox="0 0 144 144" width="114" height="114" aria-hidden="true">
        {type === "bookmark" ? (
          <>
            <path
              d="M48 20h48a10 10 0 0 1 10 10v94L72 105l-34 19V30a10 10 0 0 1 10-10Z"
              fill={accent}
              fillOpacity={filled}
              stroke={accent}
              strokeWidth="6"
              strokeLinejoin="round"
            />
            <path
              d="m54 70 13 13 26-28"
              fill="none"
              stroke={COLORS.foreground}
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="54"
              strokeDashoffset={check}
            />
          </>
        ) : type === "app-download" ? (
          <>
            <rect x="35" y="22" width="74" height="100" rx="18" fill="none" stroke={accent} strokeWidth="6" />
            <path d="M72 42v43m-17-17 17 17 17-17M56 101h32" fill="none" stroke={COLORS.foreground} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="130" strokeDashoffset={interpolate(frame, [2, 15], [130, 0], clampEase)} />
            <circle cx="72" cy="109" r="3" fill={accent} />
          </>
        ) : (
          <>
            <path d="M35 25h74a12 12 0 0 1 12 12v52a12 12 0 0 1-12 12H66l-29 20V101h-2a12 12 0 0 1-12-12V37a12 12 0 0 1 12-12Z" fill={accent} fillOpacity=".12" stroke={accent} strokeWidth="6" strokeLinejoin="round" strokeDasharray="370" strokeDashoffset={messageDraw} />
            <path d="m62 69 9-9a10 10 0 0 1 14 14l-8 8m5-7-9 9a10 10 0 0 1-14-14l8-8" fill="none" stroke={COLORS.foreground} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="88" strokeDashoffset={interpolate(frame, [6, 19], [88, 0], clampEase)} />
          </>
        )}
      </svg>
    </div>
  );
};

const BeatText: React.FC<{
  beat: VisualBeat;
  localFrame: number;
  accent: string;
  motionDesign?: boolean;
  visualFocus?: VisualFocus;
  transitionFrame: number;
  beatIndex: number;
  commentTiming?: CommentActionTiming;
  isHook: boolean;
  isOutgoing?: boolean;
}> = ({
  beat,
  localFrame,
  accent: sceneAccent,
  motionDesign = false,
  visualFocus,
  transitionFrame,
  beatIndex,
  commentTiming,
  isHook,
  isOutgoing = false,
}) => {
  const accent = motionDesign
    ? motionAccentForBeat(beat, sceneAccent)
    : sceneAccent;
  const motion = beat.motion ?? (isHook ? "pop" : "reveal");
  const defaultEntry = motion === "pop"
    ? interpolate(
        localFrame,
        [0, MOTION.popPeakFrame, MOTION.settleFrames],
        [isHook ? 0.985 : MOTION.popStartScale, MOTION.popPeakScale, 1],
        clampEase,
      )
      : motion === "reveal"
        ? interpolate(localFrame, [0, MOTION.settleFrames], [MOTION.cardStartScale, 1], clampEase)
        : 1;
  const entry = motionDesign
    ? interpolate(localFrame, [0, 9, 24], [0.88, 1.035, 1], clampEase)
    : defaultEntry;
  const opacity = isOutgoing
    ? interpolate(
        transitionFrame,
        [0, MOTION.beatCrossfadeFrames],
        [1, 0],
        clampEase,
      )
    : isHook && beatIndex === 0
      ? 1
      : interpolate(
          localFrame,
          [0, MOTION.beatCrossfadeFrames],
          [0, 1],
          clampEase,
        );
  const rise = motion === "slide" && beat.transitionStyle !== "slide-match"
    ? interpolate(localFrame, [0, 8], [MOTION.slideDistancePx, 0], clampEase)
    : 0;
  const slideX = beat.transitionStyle === "slide-match"
    ? interpolate(
        localFrame,
        [0, MOTION.ctaSlideMatchFrames],
        [beatIndex % 2 === 0 ? -MOTION.slideDistancePx : MOTION.slideDistancePx, 0],
        clampEase,
      )
    : 0;
  const revealInset = 100 - interpolate(
    localFrame,
    [0, beat.transitionStyle === "type-reveal" ? MOTION.ctaTypeRevealFrames : MOTION.ctaMaskRevealFrames],
    [0, 100],
    clampEase,
  );
  const appleTeachingLayout = visualFocus?.startsWith("apple-") ?? false;
  const fontSize = focusSize(beat.hero, beat.chinese) *
    (appleTeachingLayout ? visualSystem.lessonLayout.appleTeachingTextScale : 1) *
    (motionDesign ? 1.12 : 1);
  const staggeredHero = beat.chinese &&
    !beat.hero.includes("·") &&
    (!isHook || motionDesign);
  const highlightOpacity = interpolate(localFrame, [0, MOTION.beatCrossfadeFrames], [0, 1], clampEase);

  return (
    <div
      style={{
        position: "absolute",
        top: `${MOTION.stageCenterPercentY}%`,
        left: 68,
        right: 68,
        translate: `${slideX}px calc(-50% + ${rise}px)`,
        scale: entry,
        opacity,
        maxWidth: 944,
        marginInline: "auto",
      }}
    >
      <div
        style={{
          position: "relative",
          minHeight: Math.max(
            MOTION.stageMinHeightPx,
            (beat.screenImageHeightPx ?? 0) + 72,
          ),
          boxSizing: "border-box",
          padding: "36px 42px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          clipPath: beat.transitionStyle === "mask-reveal"
            ? `inset(0 ${revealInset}% 0 0)`
            : undefined,
        }}
      >
        {visualFocus && (
          <NarrativeVisual
            focus={visualFocus}
            localFrame={localFrame}
            accent={accent}
            motionDesign={motionDesign}
          />
        )}
        {beat.brandLogo && (
          <Img
            src={staticFile("branding/hsk-ai-logo-1024.png")}
            style={{
              width: 130,
              height: 130,
              objectFit: "cover",
              borderRadius: 32,
              margin: "0 auto 22px",
              boxShadow: `0 18px 56px ${COLORS.brandRed}35`,
            }}
          />
        )}
        {beat.actionIcon && (
          <ActionVisual
            type={beat.actionIcon}
            frame={localFrame}
            accent={accent}
            commentTiming={commentTiming}
            detailRevealStyle={beat.detailRevealStyle}
          />
        )}
        {beat.screenImage && (
          <div
            style={{
              position: "relative",
              width: beat.screenImageWidthPx ?? 860,
              maxWidth: "100%",
              height: beat.screenImageHeightPx ?? 1100,
              flexShrink: 0,
              borderRadius: motionDesign ? 34 : 24,
              border: motionDesign ? `2px solid ${accent}88` : undefined,
              background: motionDesign ? "rgba(255,255,255,.72)" : undefined,
              boxShadow: motionDesign
                ? `0 34px 100px rgba(33,29,23,.2), 0 12px 32px ${accent}24`
                : "0 24px 64px rgba(33,29,23,.18)",
            }}
          >
            <Img
              src={staticFile(beat.screenImage)}
              style={{
                display: "block",
                width: "100%",
                height: "100%",
                objectFit: "contain",
                borderRadius: motionDesign ? 32 : 24,
              }}
            />
            {beat.screenHighlight && (
              <svg
                aria-hidden="true"
                viewBox={`0 0 ${beat.screenImageWidthPx ?? 860} ${beat.screenImageHeightPx ?? 1100}`}
                preserveAspectRatio="xMidYMid meet"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  opacity: highlightOpacity,
                  pointerEvents: "none",
                }}
              >
                <rect
                  x={(beat.screenHighlight.leftPercent / 100) * (beat.screenImageWidthPx ?? 860)}
                  y={(beat.screenHighlight.topPercent / 100) * (beat.screenImageHeightPx ?? 1100)}
                  width={(beat.screenHighlight.widthPercent / 100) * (beat.screenImageWidthPx ?? 860)}
                  height={(beat.screenHighlight.heightPercent / 100) * (beat.screenImageHeightPx ?? 1100)}
                  rx={22}
                  fill={`${accent}18`}
                  stroke={COLORS.foreground}
                  strokeWidth={4}
                  vectorEffect="non-scaling-stroke"
                  style={{filter: `drop-shadow(0 0 3px ${accent}bb) drop-shadow(0 0 8px ${accent}88)`}}
                />
              </svg>
            )}
          </div>
        )}
        <div
          style={{
            display: beat.actionIcon || beat.screenImage ? "none" : "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: beat.chinese ? 2 : 0,
            flexWrap: "wrap",
            width: "100%",
            marginTop: visualFocus ? 2 : 20,
            color: COLORS.foreground,
            fontFamily: beat.chinese ? FONT_CJK : "inherit",
            fontSize,
            fontWeight: 900,
            lineHeight: 1.08,
            letterSpacing: beat.hero.length > 4 ? "-.055em" : "-.02em",
            clipPath: beat.transitionStyle === "type-reveal"
              ? `inset(0 ${revealInset}% 0 0)`
              : undefined,
            ...(beat.transitionStyle === "type-reveal" ? {
              letterSpacing: `${interpolate(localFrame, [0, MOTION.ctaTypeRevealFrames], [0.18, beat.hero.length > 4 ? -0.055 : -0.02], clampEase)}em`,
            } : {}),
            textWrap: "balance",
            textShadow: `0 5px 36px ${accent}35`,
          }}
        >
          {staggeredHero
            ? Array.from(beat.hero).map((character, characterIndex) => {
                const characterDelay =
                  characterIndex * MOTION.heroCharacterStaggerFrames;
                return (
                  <span
              key={`${character}-${characterIndex}`}
              style={{
                display: "inline-block",
                opacity: interpolate(
                  localFrame,
                  [characterDelay, characterDelay + 5],
                  [0, 1],
                  clampEase,
                ),
                translate: motionDesign
                  ? `${interpolate(
                      localFrame,
                      [characterDelay, characterDelay + 14],
                      [characterIndex % 2 === 0 ? -86 : 86, 0],
                      clampEase,
                    )}px ${interpolate(
                      localFrame,
                      [characterDelay, characterDelay + 14],
                      [characterIndex % 2 === 0 ? 24 : -24, 0],
                      clampEase,
                    )}px`
                  : undefined,
                scale: motionDesign
                  ? interpolate(
                      localFrame,
                      [characterDelay, characterDelay + 8, characterDelay + 16],
                      [0.72, 1.08, 1],
                      clampEase,
                    )
                  : undefined,
                rotate: motionDesign
                  ? `${interpolate(
                      localFrame,
                      [characterDelay, characterDelay + 14],
                      [characterIndex % 2 === 0 ? -8 : 8, 0],
                      clampEase,
                    )}deg`
                  : undefined,
                color: motionDesign
                  ? character === "这"
                    ? COLORS.brandRed
                    : character === "那"
                      ? COLORS.brandTeal
                      : character === "个"
                        ? COLORS.brandGold
                        : COLORS.foreground
                  : undefined,
                textShadow: motionDesign
                  ? `0 10px 30px ${accent}20`
                  : undefined,
              }}
                  >
                    {character}
                  </span>
                );
              })
            : beat.hero}
        </div>
        {beat.pinyin && (
          <div
            style={{
              marginTop: 15,
              color: accent,
              fontSize: 51 * (appleTeachingLayout
                ? visualSystem.lessonLayout.appleTeachingSupportTextScale
                : 1) * (motionDesign ? 1.12 : 1),
              lineHeight: 1.1,
              fontWeight: 800,
              letterSpacing: "-.025em",
            }}
          >
            {beat.pinyin}
          </div>
        )}
        {beat.toneContour && (
          <ToneContour
            contour={beat.toneContour}
            localFrame={localFrame}
            accent={accent}
          />
        )}
        {beat.meaning && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 12,
              marginTop: motionDesign ? 19 : 15,
              padding: "13px 22px",
              borderRadius: visualSystem.shape.chipRadiusPx,
              background: motionDesign ? "rgba(255,255,255,.8)" : COLORS.surface,
              border: `1px solid ${motionDesign ? `${accent}55` : COLORS.border}`,
              color: COLORS.muted,
              fontSize: (beat.meaning.length > 22 ? 32 : 39) *
                (appleTeachingLayout
                  ? visualSystem.lessonLayout.appleTeachingSupportTextScale
                  : 1),
              fontWeight: 650,
              lineHeight: 1.22,
              boxShadow: motionDesign ? `0 16px 42px ${accent}22` : undefined,
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 99,
              background: accent,
              boxShadow: `0 0 15px ${accent}aa`,
              flexShrink: 0,
            }}
          />
          {beat.meaning}
          </div>
        )}
        {beat.ctaButton && (
          <div
            style={{
              display: "table",
              margin: "18px auto 0",
              padding: "16px 28px",
              borderRadius: visualSystem.shape.chipRadiusPx,
              background: accent,
              color: COLORS.foreground,
              fontSize: 29,
              lineHeight: 1.1,
              fontWeight: 900,
              letterSpacing: "-.02em",
              boxShadow: `0 10px 38px ${accent}45`,
              scale: interpolate(localFrame, [5, 12], [0.98, 1], clampEase),
            }}
          >
            {beat.ctaButton}
          </div>
        )}
      </div>
    </div>
  );
};

const ToneContour: React.FC<{
  contour: "falling" | "neutral";
  localFrame: number;
  accent: string;
}> = ({ contour, localFrame, accent }) => {
  const width = MOTION.toneContourWidthPx;
  const height = MOTION.toneContourHeightPx;
  const draw = interpolate(
    localFrame,
    [0, MOTION.toneContourDrawFrames],
    [1, 0],
    clampEase,
  );
  const endOpacity = interpolate(
    localFrame,
    [MOTION.toneContourDrawFrames - 2, MOTION.toneContourDrawFrames + 2],
    [0, 1],
    clampEase,
  );
  const path = contour === "falling"
    ? "M24 7 C82 13 139 33 216 41"
    : "M87 27 C102 25 122 25 139 27";
  return (
    <svg
      viewBox="0 0 240 48"
      width={width}
      height={height}
      aria-label={contour === "falling" ? "Fourth tone falls" : "Neutral tone is light"}
      style={{ marginTop: 1, overflow: "visible" }}
    >
      <path d={path} pathLength={1} fill="none" stroke={accent} strokeOpacity={0.28} strokeWidth={3} strokeLinecap="round" />
      <path
        d={path}
        pathLength={1}
        fill="none"
        stroke={accent}
        strokeWidth={4}
        strokeLinecap="round"
        strokeDasharray={1}
        strokeDashoffset={draw}
        style={{ filter: `drop-shadow(0 0 7px ${accent}99)` }}
      />
      <circle
        cx={contour === "falling" ? 216 : 139}
        cy={contour === "falling" ? 41 : 27}
        r={4}
        fill={accent}
        opacity={endOpacity}
      />
    </svg>
  );
};

const LessonSlide: React.FC<{
  episodeId: string;
  scene: LessonScene;
  index: number;
  durationFrames: number;
  timelineStartMs: number;
  captions: TimedCaption[];
}> = ({ episodeId, scene, index, durationFrames, timelineStartMs, captions }) => {
  const frame = useCurrentFrame();
  const motionDesign = episodeId === "zhe-na-ge";
  const accent = motionDesign
    ? scene.id === "near"
      ? COLORS.brandRed
      : scene.id === "far"
        ? COLORS.brandTeal
        : scene.id === "measure"
          ? COLORS.brandGold
          : COLORS.brandRed
    : ACCENTS[index % ACCENTS.length];
  const beats = getBeats(scene);
  const weights = beats.map(() => 1 / beats.length);
  const beatDurations = weights.map((weight) =>
    Math.floor(durationFrames * weight),
  );
  beatDurations[beatDurations.length - 1] +=
    durationFrames - beatDurations.reduce((sum, duration) => sum + duration, 0);
  const proportionalBeatStarts = beatDurations.reduce<number[]>(
    (starts, duration, beatIndex) => {
      starts.push(
        (starts[beatIndex - 1] ?? 0) +
          (beatIndex === 0 ? 0 : beatDurations[beatIndex - 1]),
      );
      return starts;
    },
    [],
  );
  const sceneStartMs = scene.startMs ?? timelineStartMs;
  const sceneEndMs =
    scene.endMs ?? sceneStartMs + (durationFrames / FPS) * 1000;
  let previousSyncMs = sceneStartMs - 1;
  const beatStarts: number[] = [];
  const beatCueMs: Array<number | undefined> = [];
  for (const [beatIndex, beat] of beats.entries()) {
    const fallbackFrame = proportionalBeatStarts[beatIndex];
    if (!beat.syncCueText || beat.enterAtSceneStart) {
      const heldCue = beat.enterAtSceneStart && beat.syncCueText
        ? captions.find(
            (candidate) =>
              normalizeCueText(candidate.text) ===
                normalizeCueText(beat.syncCueText!) &&
              candidate.startMs >= sceneStartMs &&
              candidate.startMs < sceneEndMs,
          )
        : undefined;
      beatCueMs.push(heldCue?.startMs);
      if (heldCue) previousSyncMs = heldCue.startMs;
      beatStarts.push(
        Math.max(
          beatStarts[beatIndex - 1] ?? 0,
          beat.enterAtSceneStart ? 0 : fallbackFrame,
        ),
      );
      continue;
    }

    const syncWord = normalizeCueText(beat.syncCueText);
    const cue = captions.find(
      (candidate) =>
        normalizeCueText(candidate.text) === syncWord &&
        candidate.startMs > previousSyncMs &&
        candidate.startMs >= sceneStartMs &&
        candidate.startMs < sceneEndMs,
    );
    if (!cue) {
      beatCueMs.push(undefined);
      beatStarts.push(Math.max(beatStarts[beatIndex - 1] ?? 0, fallbackFrame));
      continue;
    }

    beatCueMs.push(cue.startMs);
    previousSyncMs = cue.startMs;
    beatStarts.push(
      Math.max(
        beatStarts[beatIndex - 1] ?? 0,
        Math.min(
          durationFrames - 1,
          Math.max(
            0,
            Math.round(((cue.startMs - timelineStartMs) / 1000) * FPS) -
              MOTION.beatEntryLeadFrames,
          ),
        ),
      ),
    );
  }
  let beatIndex = 0;
  for (let index = 1; index < beatStarts.length; index += 1) {
    if (frame >= beatStarts[index]) beatIndex = index;
    else break;
  }
  const beatStart = beatStarts[beatIndex];
  const localBeatFrame = frame - beatStart;
  const beat = beats[beatIndex];
  const previousBeat = beatIndex > 0 ? beats[beatIndex - 1] : undefined;
  const previousBeatStart = beatIndex > 0 ? beatStarts[beatIndex - 1] : 0;
  const shouldCrossfadeBeat =
    previousBeat !== undefined &&
    localBeatFrame < MOTION.beatCrossfadeFrames;
  const commentTiming = beat.actionIcon === "comment"
    ? (() => {
        const triggerMs = beatCueMs[beatIndex];
        if (triggerMs === undefined) return undefined;
        const nextCueMs = beatCueMs
          .slice(beatIndex + 1)
          .find((cueMs) => cueMs !== undefined) ?? sceneEndMs;
        const hskCue = captions.find(
          (caption) =>
            normalizeCueText(caption.text) === "hsk" &&
            caption.startMs > triggerMs &&
            caption.startMs < nextCueMs,
        );
        const commentCue = captions.find(
          (caption) =>
            normalizeCueText(caption.text) === "комментариях" &&
            caption.startMs > (hskCue?.startMs ?? triggerMs) &&
            caption.startMs < nextCueMs,
        );
        const localFrameAt = (timeMs: number) =>
          Math.round(((timeMs - timelineStartMs) / 1000) * FPS) - beatStart;
        const typingStartFrame = hskCue
          ? localFrameAt(hskCue.startMs)
          : MOTION.ctaCommentTypingFallbackFrame;
        const typingDurationFrames = hskCue
          ? Math.max(
              1,
              Math.min(
                MOTION.ctaCommentTypingFrames,
                localFrameAt(hskCue.endMs) - typingStartFrame,
              ),
            )
          : MOTION.ctaCommentTypingFrames;
        const submitTimeMs = commentCue
          ? commentCue.startMs +
            (commentCue.endMs - commentCue.startMs) *
              MOTION.ctaCommentSubmitCueProgress
          : undefined;
        const submitFrame = submitTimeMs === undefined
          ? MOTION.ctaCommentSubmitFallbackFrame
          : localFrameAt(submitTimeMs);
        return { typingStartFrame, typingDurationFrames, submitFrame };
      })()
    : undefined;
  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        background: COLORS.background,
        color: COLORS.foreground,
      }}
    >
      {motionDesign ? (
        <BoldMotionScene
          sceneId={scene.id}
          beat={beat}
          previousBeat={shouldCrossfadeBeat ? previousBeat : undefined}
          frame={frame}
          beatFrame={localBeatFrame}
          accent={accent}
        />
      ) : (
        <>
          <AbsoluteFill
            style={{
              background: `radial-gradient(ellipse at 50% 48%, ${accent}24 0%, ${accent}0b 27%, transparent 56%), linear-gradient(155deg, ${COLORS.surface} 0%, ${COLORS.background} 72%, ${COLORS.background} 100%)`,
            }}
          />
          <AbsoluteFill
            style={{
              backgroundImage:
                "linear-gradient(rgba(102,93,80,.07) 1px, transparent 1px), linear-gradient(90deg, rgba(102,93,80,.07) 1px, transparent 1px)",
              backgroundSize: "72px 72px",
              opacity: 0.42,
              maskImage:
                "radial-gradient(ellipse at center, black 0%, transparent 76%)",
            }}
          />
        </>
      )}

      {!motionDesign && <div
        style={{
          position: "absolute",
          top: MOTION.brandTopInsetPx,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
          color: COLORS.foreground,
          fontSize: 27,
          fontWeight: 900,
          letterSpacing: ".08em",
        }}
      >
        <Img
          src={staticFile("branding/hsk-ai-logo-1024.png")}
          style={{
            width: 48,
            height: 48,
            objectFit: "cover",
            borderRadius: 13,
            boxShadow: "0 5px 20px rgba(224,72,58,.2)",
          }}
        />
        HSK <span style={{ color: accent, marginLeft: -9 }}>AI</span>
      </div>}

      {!motionDesign && shouldCrossfadeBeat && previousBeat && (
        <BeatText
          key={`${scene.id}-${beatIndex - 1}-outgoing`}
          beat={previousBeat}
          localFrame={Math.max(0, frame - previousBeatStart)}
          transitionFrame={localBeatFrame}
          accent={accent}
          motionDesign={motionDesign}
          visualFocus={previousBeat.visualFocus}
          beatIndex={beatIndex - 1}
          isHook={scene.kind === "hook"}
          isOutgoing
        />
      )}
      {!motionDesign && <BeatText
        key={`${scene.id}-${beatIndex}`}
        beat={beat}
        localFrame={localBeatFrame}
        transitionFrame={localBeatFrame}
        accent={accent}
        motionDesign={motionDesign}
        visualFocus={beat.visualFocus}
        beatIndex={beatIndex}
        commentTiming={commentTiming}
        isHook={scene.kind === "hook"}
      />}

      {index > 0 && (
        <Sequence durationInFrames={SOUND.sceneCueFrames}>
          <Audio
            src={staticFile("sfx/soft-cut.wav")}
            volume={(audioFrame) =>
              interpolate(
                audioFrame,
                [0, SOUND.sceneCuePeakFrame, SOUND.sceneCueFadeFrames],
                [0, SOUND.sceneCueVolume, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              )
            }
          />
        </Sequence>
      )}
      {scene.kind !== "hook" &&
        beats.slice(1, SOUND.maxBeatCuesPerScene + 1).map((_, beatOffset) => (
          <Sequence
            key={`${scene.id}-sfx-${beatOffset}`}
            from={beatStarts[beatOffset + 1]}
            durationInFrames={SOUND.beatCueFrames}
          >
            <Audio
              src={staticFile("sfx/soft-tap.wav")}
              volume={(audioFrame) =>
                interpolate(
                  audioFrame,
                  [0, SOUND.beatCuePeakFrame, SOUND.beatCueFadeFrames],
                  [0, SOUND.beatCueVolume, 0],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                )
              }
            />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};

const LessonVideo: React.FC<EpisodeProps> = ({ episode }) => {
  const { durationInFrames } = useVideoConfig();
  const captionSections = useMemo(
    () => buildCaptionSections(episode.scenes, FPS),
    [episode.scenes],
  );
  const timeline = episode.scenes.map((scene, index) => {
    const from = episode.scenes
      .slice(0, index)
      .reduce((sum, prior) => sum + sceneFrames(prior), 0);
    return { scene, index, from, durationFrames: sceneFrames(scene) };
  });
  const voiceTrack = timeline.filter(({ scene }) => scene.audioSrc);

  return (
    <AbsoluteFill>
      {timeline.map(({ scene, index, from, durationFrames }) => (
        <Sequence key={scene.id} from={from} durationInFrames={durationFrames}>
          <LessonSlide
            episodeId={episode.id}
            scene={scene}
            index={index}
            durationFrames={durationFrames}
            timelineStartMs={(from / FPS) * 1000}
            captions={episode.captions ?? []}
          />
        </Sequence>
      ))}
      {episode.audioSrc ? (
        <Audio
          src={staticFile(episode.audioSrc)}
          trimAfter={episode.audioTrimAfterFrames}
        />
      ) : (
        voiceTrack.map(({ scene, from, durationFrames }) => {
          const audioFrames = scene.audioDurationMs
            ? Math.max(1, Math.ceil((scene.audioDurationMs / 1000) * FPS))
            : durationFrames;
          return (
            <Sequence
              key={`voice-${scene.id}`}
              from={from}
              durationInFrames={Math.min(durationFrames, audioFrames)}
            >
              <Audio src={staticFile(scene.audioSrc!)} />
            </Sequence>
          );
        })
      )}
      {episode.backgroundMusicSrc && visualSystem.sound.backgroundMusic.enabled && (
        <Audio
          src={staticFile(episode.backgroundMusicSrc)}
          loop
          loopVolumeCurveBehavior="extend"
          volume={(audioFrame) =>
            interpolate(
              audioFrame,
              [
                0,
                visualSystem.sound.backgroundMusic.fadeInFrames,
                Math.max(
                  visualSystem.sound.backgroundMusic.fadeInFrames,
                  durationInFrames - visualSystem.sound.backgroundMusic.fadeOutFrames,
                ),
                durationInFrames,
              ],
              [
                0,
                visualSystem.sound.backgroundMusic.volume,
                visualSystem.sound.backgroundMusic.volume,
                0,
              ],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
            )
          }
        />
      )}
      <CaptionOverlay
        captions={episode.captions ?? []}
        sceneSections={captionSections}
        motionDesign={episode.id === "zhe-na-ge"}
      />
    </AbsoluteFill>
  );
};

export const EpisodeComposition: React.FC = () => (
  <Composition
    id="HSKAI-Episode"
    component={LessonVideo}
    defaultProps={{ episode: seedEpisode as LessonEpisode }}
    durationInFrames={30 * FPS}
    calculateMetadata={({ props }) => {
      const sceneDuration = props.episode.scenes.reduce(
        (total, scene) => total + sceneFrames(scene),
        0,
      );
      const audioDuration = props.episode.audioDurationMs
        ? Math.ceil((props.episode.audioDurationMs / 1000) * FPS)
        : 0;
      return { durationInFrames: Math.max(sceneDuration, audioDuration) };
    }}
    fps={FPS}
    width={1080}
    height={1920}
  />
);
