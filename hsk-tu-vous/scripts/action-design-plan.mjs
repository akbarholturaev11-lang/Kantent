// Content-driven teaching actions. No episode IDs, Chinese examples or narration
// are embedded in the renderer contract.
export const ACTION_KINDS = ["quantity", "phrase", "numeral", "ordinal", "comparison", "choice"];
export const ACTION_OBJECTS = ["tea-cup", "book", "apple"];

export function validateActionVisual(beat) {
  const v = beat.visual;
  if (!ACTION_KINDS.includes(beat.kind) || !v || !beat.explains?.trim())
    throw Error(beat.id + ": action needs a supported kind, visual and teaching explanation");
  for (const key of ["title", "hanzi", "pinyin", "meaning"])
    if (typeof v[key] !== "string" || v[key].length > 180)
      throw Error(beat.id + ": invalid visual " + key);
  if (v.count !== undefined && (!Number.isInteger(v.count) || v.count < 1 || v.count > 6))
    throw Error(beat.id + ": visible object count must be 1–6");
  if (v.object !== undefined && !ACTION_OBJECTS.includes(v.object))
    throw Error(beat.id + ": unsupported visible object");
  if ((v.count !== undefined) !== (v.object !== undefined))
    throw Error(beat.id + ": an object and its visible count must be specified together");
  if (v.grouped !== undefined && typeof v.grouped !== "boolean")
    throw Error(beat.id + ": grouped must be a boolean");
  if (v.focus !== undefined && (typeof v.focus !== "string" || !v.focus || !v.hanzi.includes(v.focus)))
    throw Error(beat.id + ": focus must identify a visible part of the written form");
  if (beat.kind === "quantity" && (!v.count || !v.object))
    throw Error(beat.id + ": quantity needs count and object");
  if (["numeral", "ordinal"].includes(beat.kind) &&
      (!Number.isInteger(v.value) || v.value < 1 || v.value > (beat.kind === "ordinal" ? 6 : 30)))
    throw Error(beat.id + ": invalid represented number");
  if (beat.kind === "choice" && (!Array.isArray(v.choices) || v.choices.length !== 2 ||
      v.choices.some(x => typeof x !== "string" || !x.trim()) ||
      (v.selected !== undefined && !v.choices.includes(v.selected))))
    throw Error(beat.id + ": choice needs two options and a valid answer");
  if (v.parts && (!Array.isArray(v.parts) || v.parts.length < 2 || v.parts.length > 6 ||
      v.parts.some(x => typeof x !== "string" || !x.trim()) || v.parts.join("") !== v.hanzi.replace(/[。！？]/gu,"")))
    throw Error(beat.id + ": phrase parts must assemble the exact shown phrase");
  if (beat.kind === "comparison") {
    if (!Array.isArray(v.models) || v.models.length !== 2) throw Error(beat.id + ": comparison needs two models");
    for (const model of v.models) {
      if (["comparison", "choice"].includes(model.kind)) throw Error("Nested comparisons/choices are unsupported");
      validateActionVisual({id:beat.id,kind:model.kind,explains:beat.explains,visual:model});
    }
  }
}

export function validateActionLesson(episode) {
  const lessons = episode.scenes.filter(s => s.kind !== "cta");
  for (const scene of lessons) {
    if (scene.motionBeats?.length < 2 || !scene.motionBeats?.length)
      throw Error(scene.id + ": action lesson needs at least two meaning-linked visual events");
    const ids = new Set();
    for (const beat of scene.motionBeats) {
      if (!/^[a-z][a-z0-9-]*$/.test(beat.id ?? "") || ids.has(beat.id) ||
          typeof beat.cueText !== "string" || !beat.cueText.trim() ||
          (beat.cueOccurrence !== undefined &&
            (!Number.isInteger(beat.cueOccurrence) || beat.cueOccurrence < 1))) {
        throw Error(scene.id + ": every action needs a unique id and an exact spoken cue");
      }
      ids.add(beat.id);
      validateActionVisual(beat);
    }
    if (new Set(scene.motionBeats.map(b => JSON.stringify(b.visual))).size < 2)
      throw Error(scene.id + ": repeated identical visuals do not explain a new meaning");
  }
  return {sceneCount:lessons.length, actionCount:lessons.reduce((n,s)=>n+s.motionBeats.length,0),
    note:"Structural coverage only. Watch the rendered video to assess teaching accuracy, legibility and taste."};
}
