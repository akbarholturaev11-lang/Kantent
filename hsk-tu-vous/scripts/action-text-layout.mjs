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

export function actionSubtitlePresentation(text, layout) {
  // Preserve the complete spoken phrase in the only subtitle block.
  const examples = layout?.kind === "comparison" && !/\p{Script=Han}/u.test(text)
    ? (layout.model.models ?? []).map(model => ({text: model.hanzi, focus: model.focus ?? ""})) : [];
  if (!layout || /[^\p{Script=Han}\p{P}\p{Z}]/u.test(text)) return {text, pinyin: "", focus: "", examples};
  const word = (text.match(/\p{Script=Han}/gu) ?? []).join("");
  if (!word) return {text, pinyin: "", focus: "", examples};
  for (const model of layout.models) {
    const hanzi = (model.hanzi.match(/\p{Script=Han}/gu) ?? []).join("");
    const focus = model.focus && word.includes(model.focus) ? model.focus : "";
    if (hanzi === word) return {text, pinyin: model.pinyin, focus, examples};
    const syllables = model.pinyin.normalize("NFKC").match(/[\p{Script=Latin}\p{M}]+/gu) ?? [];
    const offset = hanzi.indexOf(word);
    if (offset < 0 || Array.from(hanzi).length !== syllables.length) continue;
    return {text, pinyin: syllables.slice(offset, offset + word.length).join(" "),
      focus, examples};
  }
  return {text, pinyin: "", focus: "", examples};
}
