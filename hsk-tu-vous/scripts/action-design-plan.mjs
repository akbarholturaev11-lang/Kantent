// Content-driven teaching actions. No episode IDs, Chinese examples or narration
// are embedded in the renderer contract.
import {validateGraphicScene,graphicFingerprint} from "./graphic-scene.mjs";
export const ACTION_KINDS = ["quantity", "phrase", "numeral", "ordinal", "comparison", "choice", "graphic"];
export const ACTION_OBJECTS = ["tea-cup", "book", "apple"];

// Illustrated-glass lesson beats (owner decision 2026-11-09): generated art
// from public/lesson-art/<episode>/ plus the overlay that explains the cue.
export const ILLUSTRATION_LAYOUTS = ["scene", "pair", "board"];
export const ILLUSTRATION_OVERLAYS = ["rise", "marks", "link", "cross", "drop", "compare", "adjective"];
// The HSK AI cast (content/characters/hsk-ai-characters.json; a test keeps
// this list equal to the registry). No other character may appear.
export const HSK_CHARACTER_IDS = ["panda", "dragon", "crane", "monkey", "rabbit"];
export const HSK_CHARACTER_MOODS = ["idle", "talk", "correct", "wrong", "celebrate", "proud", "dismissive", "one-heart", "loading"];
export function validateIllustration(id, ill) {
  const fail = (message) => { throw Error(id + ": illustration " + message); };
  if (!ill || typeof ill !== "object") fail("must be an object");
  if (!ILLUSTRATION_LAYOUTS.includes(ill.layout)) fail("layout must be scene, pair or board");
  const name = /^[a-z][a-z0-9-]{1,40}$/;
  const wanted = ill.layout === "pair" ? 2 : 1;
  if (!Array.isArray(ill.images) || ill.images.length !== wanted || ill.images.some((x) => !name.test(x)))
    fail(`needs ${wanted} lesson-art image name(s)`);
  if (ill.icons !== undefined && (!Array.isArray(ill.icons) || ill.icons.length !== wanted || ill.icons.some((x) => x !== null && !name.test(x))))
    fail("icons must match the images");
  if (ill.overlay !== undefined && !ILLUSTRATION_OVERLAYS.includes(ill.overlay)) fail("has an unsupported overlay");
  for (const [key, box] of Object.entries(ill.anchors ?? {}))
    if (!/^[a-z]+$/.test(key) || !["x", "y", "w", "h"].every((k) => Number.isFinite(box?.[k]) && box[k] >= 0 && box[k] <= 1)) fail("anchors are normalized boxes");
  if (ill.focus !== undefined) {
    const ok = ill.layout === "pair" ? ["left", "right"].includes(ill.focus) : Boolean(ill.anchors?.[ill.focus]);
    if (!ok) fail("focus must name an anchor (scene) or left/right (pair)");
  }
  if (["link", "marks", "rise", "cross"].includes(ill.overlay) && !(ill.anchors?.a && ill.anchors?.b)) fail("needs anchors a and b for this overlay");
  for (const member of ill.cast ?? []) {
    if (!HSK_CHARACTER_IDS.includes(member?.id)) fail("cast may only use HSK AI characters (content/characters/hsk-ai-characters.json)");
    if (member.mood !== undefined && !HSK_CHARACTER_MOODS.includes(member.mood)) fail("cast mood is not an HSK AI mood");
    if (!["x", "y", "h"].every((k) => Number.isFinite(member[k]) && member[k] > 0 && member[k] <= 1)) fail("cast x, y and h are normalized");
    if (ill.layout === "pair" ? ![0, 1].includes(member.card) : member.card !== undefined) fail("cast card is 0/1 only in a pair");
  }
  if (ill.layout === "board" && (!Array.isArray(ill.parts) || !ill.parts.length || ill.parts.length > 6 || ill.parts.some((x) => typeof x !== "string" || !x.trim() || x.length > 24)))
    fail("board needs 1–6 short parts");
}

/**
 * Owner rule 2026-11-09 (illustrated lesson format): the headline, the chip
 * and the subtitle each have one job and never repeat one another. The
 * headline names the teaching step in plain words: no Hanzi (the chip owns
 * them), not the chip's meaning, and no word the narration speaks at its cue.
 */
export function validateDistinctTextRoles(beat) {
  const v = beat.visual;
  if (!v?.illustration) return;
  const fold = (value) => String(value ?? "").toLocaleLowerCase("und").replace(/[^\p{L}\p{N}\s]/gu, " ").trim();
  const title = fold(v.title);
  if (!title) throw Error(beat.id + ": headline is required");
  if (/\p{Script=Han}/u.test(v.title)) throw Error(beat.id + ": headline must not contain Hanzi; the chip shows them");
  if (title === fold(v.meaning)) throw Error(beat.id + ": headline repeats the chip meaning");
  const spoken = new Set(fold(beat.cueText).split(/\s+/).filter((word) => word.length >= 4));
  const repeated = title.split(/\s+/).find((word) => spoken.has(word));
  if (repeated) throw Error(beat.id + `: headline repeats the spoken word "${repeated}"; name the teaching step instead`);
}

export function validateActionVisual(beat) {
  const v = beat.visual;
  if (!ACTION_KINDS.includes(beat.kind) || !v || !beat.explains?.trim())
    throw Error(beat.id + ": action needs a supported kind, visual and teaching explanation");
  for (const key of ["title", "hanzi", "pinyin", "meaning"])
    if (typeof v[key] !== "string" || v[key].length > 180)
      throw Error(beat.id + ": invalid visual " + key);
  if (v.illustration !== undefined) { validateIllustration(beat.id, v.illustration); validateDistinctTextRoles(beat); }
  if (beat.kind === "graphic") {
    validateGraphicScene(v.graphic);
    if (["object","count","models","choices","value"].some(key => v[key] !== undefined))
      throw Error(beat.id + ": graphic must own its drawing without conflicting legacy models");
  }
  else if (v.graphic !== undefined) throw Error(beat.id + ": declarative drawing requires the graphic kind");
  if (v.count !== undefined && (!Number.isInteger(v.count) || v.count < 1 || v.count > 6))
    throw Error(beat.id + ": visible object count must be 1–6");
  if (v.object !== undefined && !ACTION_OBJECTS.includes(v.object))
    throw Error(beat.id + ": unsupported visible object");
  if ((v.count !== undefined) !== (v.object !== undefined))
    throw Error(beat.id + ": an object and its visible count must be specified together");
  if (v.pinyinSegments !== undefined) {
    const segments = v.pinyinSegments;
    const hanzi = (v.hanzi.match(/\p{Script=Han}/gu) ?? []).join("");
    if (!Array.isArray(segments) || segments.length < 1 || segments.length > 60 ||
        segments.some(segment => !segment || typeof segment.hanzi !== "string" ||
          !/^\p{Script=Han}+$/u.test(segment.hanzi) || typeof segment.pinyin !== "string" ||
          !segment.pinyin.trim() || !/\p{Script=Latin}/u.test(segment.pinyin) ||
          /\p{Script=Han}/u.test(segment.pinyin)) ||
        segments.map(segment => segment.hanzi).join("") !== hanzi) {
      throw Error(beat.id + ": pinyinSegments must map every Hanzi span exactly once to nonempty pinyin");
    }
  }
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
      v.choices.some(x => typeof x !== "string" || !x.trim() || x.length > 32) ||
      new Set(v.choices).size !== 2 ||
      (v.selected !== undefined && !v.choices.includes(v.selected))))
    throw Error(beat.id + ": choice needs two distinct options of at most 32 characters and a valid answer");
  if (v.parts && (!Array.isArray(v.parts) || v.parts.length < 2 || v.parts.length > 6 ||
      v.parts.some(x => typeof x !== "string" || !x.trim()) || v.parts.join("") !== v.hanzi.replace(/[。！？]/gu,"")))
    throw Error(beat.id + ": phrase parts must assemble the exact shown phrase");
  if (beat.kind === "comparison") {
    if (!Array.isArray(v.models) || v.models.length !== 2) throw Error(beat.id + ": comparison needs two models");
    for (const model of v.models) {
      if (["comparison", "choice"].includes(model.kind)) throw Error("Nested comparisons/choices are unsupported");
      if (model.kind === "phrase" && !(model.object && model.count))
        throw Error(beat.id + ": comparison phrase needs a drawable object/count model");
      validateActionVisual({id:beat.id,kind:model.kind,explains:beat.explains,visual:model});
    }
  }
}

export function validateVisualStateIntent(episode) {
  for (const scene of episode.scenes ?? []) {
    for (const beat of scene.motionBeats ?? []) {
      const intent = beat.visualStateIntent;
      if (!intent) continue;
      if (intent.type !== "both-allowed" || beat.kind !== "graphic" ||
          !Array.isArray(intent.requiredNodeIds) || intent.requiredNodeIds.length < 2 ||
          new Set(intent.requiredNodeIds).size !== intent.requiredNodeIds.length) {
        throw Error(`${scene.id}/${beat.id}: invalid visual-state intent.`);
      }
      const nodeIds = new Set(beat.visual?.graphic?.nodes?.map((node) => node.id) ?? []);
      if (intent.requiredNodeIds.some((id) => !nodeIds.has(id))) {
        throw Error(`${scene.id}/${beat.id}: both-allowed state is missing one or more accepted-option cues.`);
      }
    }
  }
  return true;
}

function visibleModel(kind, model, context) {
  const quantity = model.count ? {object:model.object,count:model.count,grouped:!!model.grouped} : null;
  if (kind === "graphic") return {graphic:graphicFingerprint(model.graphic)};
  if (kind === "quantity") return {quantity};
  if (kind === "phrase") return quantity ? {quantity} : context ?
    {quantity:{object:context.object,count:context.count,grouped:!!(model.grouped ?? context.grouped)}} : null;
  if (kind === "numeral" || kind === "ordinal") return {kind,value:model.value,quantity};
  if (kind === "choice") return {choices:[...(model.choices??[])],selected:model.selected??null,
    quantity:quantity??(context?{object:context.object,count:context.count,grouped:!!context.grouped}:null)};
  if (kind === "comparison") return {models:model.models.map(entry => visibleModel(entry.kind,entry))};
  return null;
}

export function validateActionLesson(episode, {requireVisibleChange = false} = {}) {
  validateVisualStateIntent(episode);
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
    if (requireVisibleChange) {
      const states = visibleActionStates(scene);
      if (states.some(state => state === null || state.models?.some(model => model === null)))
        throw Error(scene.id + ": missing drawable details; author a graphic scene for this spoken idea");
      if (new Set(states.map(state => JSON.stringify(state))).size < 2)
        throw Error(scene.id + ": no visible state change; changing titles, Hanzi or planning text is insufficient");
    }
  }
  return {sceneCount:lessons.length, actionCount:lessons.reduce((n,s)=>n+s.motionBeats.length,0),
    note:"Structural coverage only. Watch the rendered video to assess teaching accuracy, legibility and taste."};
}

export function visibleActionStates(scene) {
  const context = scene.motionBeats.map(beat => beat.visual).find(model => model.object && model.count);
  return scene.motionBeats.map(beat => visibleModel(beat.kind,beat.visual,context));
}

export function validateVisualHold(scene, resolvedBeats, maximumSec) {
  if (!Number.isFinite(maximumSec) || maximumSec <= 0) throw Error("Invalid maximum visual hold policy");
  const states = visibleActionStates(scene).map(state => JSON.stringify(state));
  let from = scene.startMs, state = states[0];
  const intervals = [];
  for (let index = 1; index < resolvedBeats.length; index++) {
    if (states[index] === state) continue;
    intervals.push({fromMs:from,toMs:resolvedBeats[index].startMs});
    from = resolvedBeats[index].startMs;
    state = states[index];
  }
  intervals.push({fromMs:from,toMs:scene.endMs});
  const longestMs = Math.max(...intervals.map(interval => interval.toMs - interval.fromMs));
  if (longestMs > maximumSec * 1000)
    throw Error(`${scene.id}: unchanged visual holds ${(longestMs/1000).toFixed(2)}s; maximum ${maximumSec}s. Add a meaning-linked graphic change at an existing spoken cue; do not add decorative filler.`);
  return {longestHoldMs:longestMs,intervals};
}
