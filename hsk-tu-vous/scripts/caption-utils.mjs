/**
 * @typedef {{ text: string, startMs: number, endMs: number, timestampMs?: number | null, confidence?: number | null }} TimedCaption
 * @typedef {{ text: string, startMs: number, endMs: number }} CaptionPage
 * @typedef {{ maxWordsPerPage: number, maxCharactersPerPage: number, maxPageDurationMs: number, maxGapMs: number, holdAfterWordMs: number }} CaptionGroupingStyle
 */

/**
 * Group imported word-level cues into the phrase pages shown by the video.
 * @param {TimedCaption[]} captions
 * @param {CaptionGroupingStyle} style
 * @returns {CaptionPage[]}
 */
export function groupTimedCaptions(captions, style) {
  const sections = style.sections?.length
    ? style.sections
    : [{ startMs: 0, endMs: Number.POSITIVE_INFINITY, styleId: "pill" }];
  const pages = [];

  for (const section of sections) {
    const sectionCaptions = captions.filter(
      (caption) =>
        caption.startMs >= section.startMs && caption.startMs < section.endMs,
    );
    pages.push(...groupCaptionSection(sectionCaptions, style, section));
  }

  return pages;
}

const DEFAULT_STYLE_BY_SCENE = {
  hook: "headline",
  vocabulary: "pill",
  example: "highlight",
  context: "pill",
  cta: "headline",
};

export const CAPTION_STYLE_IDS = ["headline", "pill", "highlight", "ctaFooter"];

/** @param {Array<Record<string, any>>} scenes @param {number} fps */
export function buildCaptionSections(scenes, fps = 30) {
  let cursorMs = 0;
  return scenes.map((scene) => {
    const durationFrames = Number.isFinite(scene.durationFrames)
      ? scene.durationFrames
      : Math.ceil((scene.durationSec ?? 4) * fps);
    const startMs = Number.isFinite(scene.startMs) ? scene.startMs : cursorMs;
    const endMs = Number.isFinite(scene.endMs)
      ? scene.endMs
      : startMs + (durationFrames / fps) * 1000;
    cursorMs = endMs;
    const hasCtaScreenshot =
      scene.kind === "cta" &&
      (scene.visualBeats ?? []).some((beat) => beat.screenImage);
    return {
      startMs,
      endMs,
      styleId: hasCtaScreenshot
        ? "ctaFooter"
        : scene.captionStyleId ?? DEFAULT_STYLE_BY_SCENE[scene.kind] ?? "pill",
    };
  });
}

function groupCaptionSection(captions, style, section) {
  const pages = [];
  let words = [];

  const flush = () => {
    if (!words.length) return;
    pages.push({
      text: words.map((word) => word.text.trim()).join(" "),
      startMs: words[0].startMs,
      endMs: Math.min(
        words[words.length - 1].endMs + style.holdAfterWordMs,
        section.endMs,
      ),
      styleId: section.styleId,
    });
    words = [];
  };

  for (const caption of captions) {
    const text = caption.text.trim();
    if (!text || caption.endMs <= caption.startMs) continue;

    const prior = words[words.length - 1];
    const combinedText = [...words.map((word) => word.text), text].join(" ");
    const spanMs = prior ? caption.endMs - words[0].startMs : 0;
    const gapMs = prior ? caption.startMs - prior.endMs : 0;
    const shouldStartNewPage =
      prior !== undefined &&
      (gapMs > style.maxGapMs ||
        spanMs > style.maxPageDurationMs ||
        combinedText.length > style.maxCharactersPerPage ||
        words.length >= style.maxWordsPerPage);

    if (shouldStartNewPage) flush();
    words.push(caption);
  }

  flush();

  return pages.map((page, index) => {
    const nextStart = pages[index + 1]?.startMs;
    return nextStart === undefined
      ? page
      : { ...page, endMs: Math.min(page.endMs, nextStart) };
  });
}
