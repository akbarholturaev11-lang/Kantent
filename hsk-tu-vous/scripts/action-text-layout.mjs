// One narration-synced text block; the action stage renders relevant graphics.
const modelsIn = (model) => [model, ...(model.models ?? []).flatMap(modelsIn)];

export function actionTextAtFrame(scenes, frame) {
  const scene = scenes.find((entry) => frame >= entry.from && frame < entry.from + entry.durationFrames);
  if (!scene?.beats.length) return null;
  const localFrame = frame - scene.from;
  const active = scene.beats.filter((beat) => beat.localFrame <= localFrame).at(-1) ?? scene.beats[0];
  if (!active.visual) return null;
  return {model: active.visual, models: modelsIn(active.visual), kind: active.kind};
}

export function buildActionCaptionScenes(episode, cueTimeline, fps = 30) {
  if (episode.motionDesignStyle !== "explain-actions-v1") return [];
  let from = 0;
  return episode.scenes.map((scene) => {
    const durationFrames = Math.max(1, scene.durationFrames ?? Math.ceil((scene.durationSec ?? 4) * fps));
    const entry = {
      from,
      durationFrames,
      beats: cueTimeline?.scenes.find((item) => item.sceneId === scene.id)?.motionBeats ?? [],
    };
    from += durationFrames;
    return entry;
  });
}

const hanziOnly = (text) => (text.match(/\p{Script=Han}/gu) ?? []).join("");

function mappedPinyin(model, word, hanzi) {
  if (!Array.isArray(model.pinyinSegments)) return null;
  const segments = model.pinyinSegments.map((segment) => ({
    hanzi: hanziOnly(segment.hanzi),
    pinyin: segment.pinyin.trim(),
  }));
  if (segments.some((segment) => !segment.hanzi || !segment.pinyin) ||
      segments.map((segment) => segment.hanzi).join("") !== hanzi) {
    throw new Error(`PINYIN_MAPPING_INVALID: authored spans do not cover ${model.hanzi}.`);
  }
  const matches = [];
  for (let start = 0; start < segments.length; start++) {
    let span = "";
    for (let end = start; end < segments.length; end++) {
      span += segments[end].hanzi;
      if (span.length > word.length) break;
      if (span === word) matches.push(segments.slice(start, end + 1).map((segment) => segment.pinyin).join(" "));
    }
  }
  const unique = [...new Set(matches)];
  if (unique.length > 1) {
    throw new Error(`PINYIN_MAPPING_AMBIGUOUS: ${word} has multiple authored readings in ${model.hanzi}.`);
  }
  return unique[0] ?? null;
}

export function actionSubtitlePresentation(text, layout) {
  // Preserve the complete spoken phrase in the only subtitle block.
  const examples = layout?.kind === "comparison" && !/\p{Script=Han}/u.test(text)
    ? (layout.model.models ?? []).map(model => ({text: model.hanzi, focus: model.focus ?? ""})) : [];
  if (!layout || /[^\p{Script=Han}\p{P}\p{Z}]/u.test(text)) return {text, pinyin: "", focus: "", examples};
  const word = hanziOnly(text);
  if (!word) return {text, pinyin: "", focus: "", examples};
  for (const model of layout.models) {
    const hanzi = hanziOnly(model.hanzi);
    const focus = model.focus && word.includes(model.focus) ? model.focus : "";
    if (hanzi === word) return {text, pinyin: model.pinyin, focus, examples};
    const mapped = mappedPinyin(model, word, hanzi);
    if (mapped) return {text, pinyin: mapped, focus, examples};
    const offset = hanzi.indexOf(word);
    if (offset < 0) continue;
    if (Array.isArray(model.pinyinSegments)) {
      throw new Error(`PINYIN_SPAN_UNMAPPED: caption ${word} does not align with a complete verified span in ${model.hanzi}.`);
    }
    const syllables = model.pinyin.normalize("NFKC").match(/[\p{Script=Latin}\p{M}]+/gu) ?? [];
    if (Array.from(hanzi).length !== syllables.length) {
      throw new Error(`PINYIN_MAPPING_REQUIRED: caption ${word} is part of ${model.hanzi}; add verified pinyinSegments before rendering.`);
    }
    return {text, pinyin: syllables.slice(offset, offset + word.length).join(" "),
      focus, examples};
  }
  return {text, pinyin: "", focus: "", examples};
}

export function validateActionSubtitlePages(pages, actionCaptionScenes, fps = 30) {
  for (const page of pages) {
    const pageStartFrame = Math.ceil((page.startMs * fps) / 1000);
    const pageEndFrame = Math.max(pageStartFrame + 1, Math.ceil((page.endMs * fps) / 1000));
    const frames = new Set([pageStartFrame, pageEndFrame - 1]);
    for (const scene of actionCaptionScenes) {
      for (const beat of scene.beats) {
        const frame = scene.from + beat.localFrame;
        if (frame >= pageStartFrame && frame < pageEndFrame) frames.add(frame);
      }
    }
    for (const frame of frames) {
      try {
        actionSubtitlePresentation(page.text, actionTextAtFrame(actionCaptionScenes, frame));
      } catch (error) {
        const seconds = (frame / fps).toFixed(3);
        throw new Error(`Action subtitle pinyin QA failed at ${seconds}s for “${page.text}”: ${error.message}`, {cause:error});
      }
    }
  }
  return {pageCount: pages.length, checkedFrames: "caption-page and action-cue boundaries"};
}
