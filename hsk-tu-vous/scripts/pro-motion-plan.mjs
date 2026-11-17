/**
 * Professional motion planner for illustrated-glass lessons (owner request
 * 2026-11-16: "professional motion video, professional montage"; tokens in
 * content/visual-system.json#proMotion, rules in
 * content/EDITING_SPEC.md#professional-motion-system).
 *
 * Pure and deterministic: the Remotion renderer, the sound-design mix and the
 * tests all call the same functions, so a shot, transition or sound event is
 * decided once from the lesson's own beats and real imported word cues.
 * Nothing here invents timing: every event is anchored to a beat's verified
 * spoken cue frame or to a scene boundary of the verified voice take.
 *
 * Camera model: the settled pose of every beat is exactly
 * `cameraFor(illustration)` from illustrated-layout.mjs, the pose the
 * subtitle placement and face-safety checks are computed for. Moves between
 * poses (spring, swish, punch) are transient and settle back to that pose.
 */
import { cameraFor, ILLUSTRATED_LAYOUT } from "./illustrated-layout.mjs";

const W = ILLUSTRATED_LAYOUT.width;
const IMAGE_H = ILLUSTRATED_LAYOUT.sceneImageHeightPx;
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const illOf = (beat) => beat?.visual?.illustration ?? null;
const sameImages = (a, b) => (a?.images ?? []).join("|") === (b?.images ?? []).join("|");
const POSITIVE_MOODS = new Set(["correct", "celebrate", "proud"]);

/** True when an episode renders with the professional motion system. */
export function proMotionActive(episode, policy) {
  if (!policy?.enabled || typeof episode?.date !== "string" || episode.date < policy.effectiveFromDate) return false;
  if (episode.motionDesignStyle !== "explain-actions-v1") return false;
  return (episode.scenes ?? []).some((scene) =>
    (scene.motionBeats ?? []).some((beat) => Boolean(illOf(beat))));
}

/** Damped spring step response (0 → 1, small overshoot when underdamped). */
export function springProgress(frames, fps, { naturalHz, dampingRatio }) {
  if (!(frames > 0)) return 0;
  const t = frames / fps, w = 2 * Math.PI * naturalHz, z = dampingRatio;
  if (z < 1) {
    const wd = w * Math.sqrt(1 - z * z);
    return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
  }
  return 1 - Math.exp(-w * t) * (1 + w * t);
}

/** 0 → 1 → 0 over `frames`, smooth at both ends. */
export function bell(frame, frames) {
  const t = clamp01(frame / frames);
  return Math.sin(Math.PI * t) ** 2;
}

function hash(text) {
  let value = 2166136261;
  for (const char of String(text)) { value ^= char.codePointAt(0); value = Math.imul(value, 16777619) >>> 0; }
  return value;
}

/** Shot plan of one scene: how each beat arrives and how the camera holds. */
export function planShots(beats, config) {
  const camera = config.camera;
  const shots = [];
  beats.forEach((beat, index) => {
    const ill = illOf(beat);
    if (!ill) throw Error(beat.id + ": professional motion needs visual.illustration");
    const previous = index ? illOf(beats[index - 1]) : null;
    let transition;
    if (!previous) transition = "enter";
    else if (previous.layout !== ill.layout || !sameImages(previous, ill)) transition = "cross-zoom";
    else if (ill.layout === "scene") {
      const a = cameraFor(previous), b = cameraFor(ill);
      const travel = Math.abs(b.cx - a.cx) + Math.abs(b.cy - a.cy) + Math.abs(b.scale - a.scale) * 0.5;
      transition = travel < 1e-6 ? "punch"
        : travel >= camera.whipMinTravel && Math.min(a.scale, b.scale) >= 1.15 ? "whip" : "glide";
    } else if (ill.layout === "pair") transition = previous.focus !== ill.focus ? "focus-swap" : "punch";
    else transition = "morph";
    const options = ill.layout === "scene"
      ? (cameraFor(ill).scale > 1.05 ? ["push-in", "drift-left", "rise", "drift-right"] : ["push-in"])
      : ill.layout === "board" ? ["push-in"] : ["none"];
    let hold = options[hash(beat.id) % options.length];
    if (options.length > 1 && shots[index - 1]?.hold === hold) hold = options[(options.indexOf(hold) + 1) % options.length];
    shots.push({ beatId: beat.id, layout: ill.layout, transition, hold });
  });
  return shots;
}

function holdOffset(hold, seconds, camera) {
  const push = Math.min(camera.holdMaxPush, camera.holdPushPerSec * Math.max(0, seconds));
  const k = clamp01(seconds / 4), eased = 1 - (1 - k) ** 2;
  const drift = camera.holdDrift * W * eased;
  switch (hold) {
    case "push-in": return { scale: 1 + push, tx: 0, ty: 0 };
    case "drift-left": return { scale: 1 + push * 0.5, tx: drift, ty: 0 };
    case "drift-right": return { scale: 1 + push * 0.5, tx: -drift, ty: 0 };
    case "rise": return { scale: 1 + push * 0.5, tx: 0, ty: drift * 0.8 };
    default: return { scale: 1, tx: 0, ty: 0 };
  }
}

function lerpPose(a, b, p) {
  const mix = (x, y) => x + (y - x) * p;
  return { scale: mix(a.scale, b.scale), cx: mix(a.cx, b.cx), cy: mix(a.cy, b.cy), tx: mix(a.tx, b.tx), ty: mix(a.ty, b.ty) };
}

function activeIndex(beats, frame) {
  let index = 0;
  beats.forEach((beat, i) => { if (frame >= beat.localFrame) index = i; });
  return index;
}

/** Screen x/y of the image centre for a pose (same model as SceneLayer). */
function imageCentre(pose) {
  return {
    x: pose.cx * W + (0.5 - pose.cx) * W * pose.scale + pose.tx,
    y: pose.cy * IMAGE_H + (0.5 - pose.cy) * IMAGE_H * pose.scale + pose.ty,
  };
}

/**
 * Camera of a `scene` layout beat at scene-local `frame`: settled pose
 * `cameraFor`, a slow cue-timed hold move, and a spring move from the pose
 * the camera actually had when this beat's spoken cue arrived.
 */
export function cameraAt({ beats, shots = undefined, frame, fps = 30, config }) {
  const camera = config.camera;
  const plan = shots ?? planShots(beats, config);
  const target = (index, at) => {
    const base = cameraFor(illOf(beats[index]));
    const hold = holdOffset(plan[index].hold, (at - beats[index].localFrame) / fps, camera);
    return { scale: base.scale * hold.scale, cx: base.cx, cy: base.cy, tx: hold.tx, ty: hold.ty };
  };
  const actual = (index, at) => {
    const goal = target(index, at);
    const shot = plan[index];
    if (index === 0 || !["whip", "glide", "punch"].includes(shot.transition)) return goal;
    const start = beats[index].localFrame;
    const from = actual(index - 1, start);
    const t = at - start;
    // A whip anticipates (a small counter-move), travels on a stiffer
    // spring and settles with the spring's own small follow-through; the
    // frame breathes out a little mid-move to sell the distance.
    const whip = shot.transition === "whip";
    const lag = whip ? camera.whip.anticipationFrames : 0;
    const spring = whip ? camera.whip : shot.transition === "glide" ? camera.glide : camera;
    const pose = lerpPose(from, goal, springProgress(t - lag, fps, spring));
    if (whip) {
      pose.tx += Math.sign(goal.cx - from.cx) * camera.whip.anticipation * W * bell(t, lag * 2);
      pose.scale *= 1 - camera.whip.breath * bell(t - lag, camera.settleFrames);
    } else if (shot.transition === "punch") pose.scale *= 1 + camera.punchScale * bell(t, camera.settleFrames);
    return pose;
  };
  const index = activeIndex(beats, frame);
  const pose = actual(index, frame);
  const moving = index > 0 && ["whip", "glide"].includes(plan[index].transition) &&
    frame - beats[index].localFrame < camera.settleFrames;
  let blurX = 0, blurY = 0;
  if (moving) {
    const before = activeIndex(beats, frame - 1) === index ? actual(index, frame - 1) : actual(index - 1, frame - 1);
    const a = imageCentre(before), b = imageCentre(pose);
    blurX = Math.min(camera.motionBlurMaxPx, Math.abs(b.x - a.x) * camera.motionBlurFactor);
    blurY = Math.min(camera.motionBlurMaxPx, Math.abs(b.y - a.y) * camera.motionBlurFactor);
  }
  return { ...pose, blurX, blurY, transition: plan[index].transition, beatIndex: index };
}

/** Scene-boundary transition types; index 0 (first scene) has none. */
export function planSceneTransitions(scenes, config) {
  const order = config.sceneTransition.order;
  const result = [null];
  for (let i = 1; i < scenes.length; i++) {
    const a = scenes[i - 1], b = scenes[i];
    const from = a.lastIll, to = b.firstIll;
    let type;
    if (b.kind === "cta" || !to) type = "light-leak";
    else if (!from) type = "zoom-through";
    else if ((from.layout === "board") !== (to.layout === "board") && from.layout !== "pair" && to.layout !== "pair") type = "wipe";
    else if (from.layout === "pair" || to.layout === "pair") type = "whip-up";
    else type = "zoom-through";
    if (type !== "light-leak" && type === result[i - 1])
      type = order.find((candidate) => candidate !== result[i - 1] && candidate !== "light-leak") ?? type;
    result.push(type);
  }
  return result;
}

/** Card copy identity: the teaching card changes only for a distinct form. */
export function cardPhraseKey(text) {
  return String(text ?? "").normalize("NFKC").trim().replace(/^这个/u, "").split(/[，,]/u, 1)[0]
    .replace(/[。！？?!…]+$/u, "").replace(/\s+/gu, "");
}

/** The (at most two) distinct card rows visible at beat `activeIndex`. */
export function distinctCardBeats(beats, activeIndex) {
  const seen = new Set(), result = [];
  for (const beat of beats.slice(0, activeIndex + 1)) {
    const key = cardPhraseKey(beat.visual?.hanzi ?? "");
    if (!key || seen.has(key)) continue;
    seen.add(key); result.push(beat);
  }
  return result.slice(-2);
}

/** The lesson's grammar focus (illustration label) and its own pinyin. */
export function lessonFocus(beats) {
  const counts = new Map();
  for (const beat of beats) {
    const label = illOf(beat)?.label;
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  const label = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!label) return null;
  const own = beats.find((beat) => cardPhraseKey(beat.visual?.hanzi) === cardPhraseKey(label));
  return { hanzi: label, pinyin: own?.visual?.pinyin ?? null };
}

const plainPinyin = (word) => String(word).normalize("NFC").toLocaleLowerCase("und").replace(/[^\p{L}]/gu, "");
const hanCount = (text) => (String(text).match(/\p{Script=Han}/gu) ?? []).length;

/** Kinetic-card tokens: characters and pinyin words, with the focus marked
 * only inside multi-character forms (a lone 比 card is already the focus). */
export function cardTokens(copy, focus) {
  const multi = hanCount(copy?.hanzi ?? "") > 1;
  const chars = [...String(copy?.hanzi ?? "")].map((ch) => ({ ch, han: /\p{Script=Han}/u.test(ch),
    focus: multi && Boolean(focus?.hanzi) && ch === focus.hanzi }));
  const words = String(copy?.pinyin ?? "").split(/\s+/u).filter(Boolean).map((word) => ({ word,
    focus: multi && Boolean(focus?.pinyin) && plainPinyin(word) === plainPinyin(focus.pinyin) }));
  return { chars, words };
}

const hanOnly = (text) => (String(text ?? "").match(/\p{Script=Han}/gu) ?? []).join("");
const VOWELS = /[aeiouüvāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]+/giu;

/** Word chips of a sentence form: pinyin words mapped onto their Hanzi
 * (今天比昨天冷 + "Jīntiān bǐ zuótiān lěng." → 今天 | 比 | 昨天 | 冷). Falls
 * back to one chip per character, without pinyin, when the mapping is not
 * exact — pinyin is never guessed. */
export function formulaChips(copy) {
  const han = [...hanOnly(copy?.hanzi)];
  const words = String(copy?.pinyin ?? "").split(/\s+/u).map((word) => word.replace(/[^\p{L}\p{M}]/gu, "")).filter(Boolean);
  const counts = words.map((word) => (word.normalize("NFC").match(VOWELS) ?? []).length);
  // Erhua: "yǒudiǎnr" is written 有点儿, one more character than syllables.
  let erhua = han.filter((char) => char === "儿").length - words.filter((word) => /^ér$|^er$/iu.test(word.normalize("NFC"))).length;
  words.forEach((word, index) => { if (erhua > 0 && /[^e]r$/iu.test(word) && counts[index] > 0) { counts[index] += 1; erhua -= 1; } });
  if (words.length && counts.every((count) => count > 0) && counts.reduce((a, b) => a + b, 0) === han.length) {
    let at = 0;
    return words.map((word, index) => { const chip = { hanzi: han.slice(at, at + counts[index]).join(""), pinyin: word }; at += counts[index]; return chip; });
  }
  return han.map((char) => ({ hanzi: char, pinyin: null }));
}

/**
 * Shot language of one scene, after the owner's 2026-11-17 reference shorts:
 * illustrated art alternates with clean motion slides. The first beat of a
 * scene establishes its art; a `board` scene is told entirely in slides; a
 * sentence becomes a formula slide whose word chips light up as the
 * narration names them; the lesson focus, a contrast, or a wrong form (red
 * stamp) gets its own slide; other single words stay on the art.
 */
export function planVisualModes(beats, focus) {
  const isFocus = (text) => Boolean(focus?.hanzi) && hanOnly(text) === hanOnly(focus.hanzi);
  let formula = null;
  return beats.map((beat, index) => {
    const ill = illOf(beat), text = String(beat.visual?.hanzi ?? ""), key = cardPhraseKey(text);
    const wrong = ["stamp", "cross"].includes(ill?.overlay);
    const rows = distinctCardBeats(beats, index).map((row) => beats.indexOf(row));
    let slide;
    if (text.includes("·")) slide = { template: "contrast", rows: [index] };
    else if (hanCount(key) >= 3) {
      if (formula === null || cardPhraseKey(beats[formula].visual?.hanzi) !== key) formula = index;
      slide = { template: "formula", formulaBeat: formula, highlight: null };
    } else if (formula !== null && hanOnly(key) && hanOnly(beats[formula].visual?.hanzi).includes(hanOnly(key)))
      slide = { template: "formula", formulaBeat: formula, highlight: hanOnly(key) };
    else if (rows.length === 2)
      slide = { template: rows.every((row) => hanCount(beats[row].visual?.hanzi) <= 2) ? "pair" : "stack", rows };
    else slide = { template: "hero", rows: [index] };
    const board = ill?.layout === "board";
    const salient = slide.template === "formula" || slide.template === "contrast" || wrong || isFocus(key) ||
      (slide.template !== "hero" && rows.some((row) => isFocus(beats[row].visual?.hanzi)));
    const mode = board || (index > 0 && salient) ? "slide" : "art";
    const content = slide.template === "formula" ? "formula:" + slide.formulaBeat
      : slide.template + ":" + (slide.rows ?? []).join(",");
    return { beatId: beat.id, mode, ...slide, content, wrong };
  });
}

/** One background theme per scene for its slides; a wrong-form scene is ember. */
export function planSlideThemes(scenes, config) {
  const order = config?.slide?.themes ?? ["glass", "ink", "sky", "teal"];
  const wrongTheme = config?.slide?.wrongTheme ?? "ember";
  const themes = [];
  scenes.forEach((scene, index) => {
    const wrong = (scene.beats ?? []).some((beat) => ["stamp", "cross"].includes(illOf(beat)?.overlay));
    themes.push(wrong ? wrongTheme : order.find((theme, i) => i >= index % order.length && theme !== themes[index - 1])
      ?? order.find((theme) => theme !== themes[index - 1]));
  });
  return themes;
}

/**
 * Global frame ranges in which a motion slide (not the art) fills the frame,
 * so the subtitle can take the slide's own slot. CTA scenes have no slides.
 */
export function slideFrameRanges(scenes, focus) {
  const ranges = [];
  for (const scene of scenes) {
    const beats = scene.beats ?? [];
    if (!beats.length || scene.kind === "cta" || !beats.some((beat) => illOf(beat))) continue;
    const modes = planVisualModes(beats, focus);
    beats.forEach((beat, index) => {
      if (modes[index].mode !== "slide") return;
      const end = beats[index + 1]?.localFrame ?? scene.durationFrames ?? beat.localFrame;
      const from = scene.from + beat.localFrame, to = scene.from + end;
      const last = ranges.at(-1);
      if (last && last.to === from) last.to = to;
      else if (to > from) ranges.push({ from, to });
    });
  }
  return ranges;
}

/** Graphic node continuity between consecutive beats (by node id). */
export function diffGraphicNodes(previous, current) {
  const before = new Map((previous?.nodes ?? []).map((node) => [node.id, node]));
  const tracksOf = (plan, id) => JSON.stringify((plan?.tracks ?? []).filter((track) => track.nodeId === id));
  const status = new Map();
  for (const node of current?.nodes ?? []) {
    const old = before.get(node.id);
    if (!old || old.type !== node.type || old.parentId !== node.parentId || !canMorphAttrs(old.attrs, node.attrs)) {
      status.set(node.id, "enter"); continue;
    }
    const same = JSON.stringify(old) === JSON.stringify(node) && tracksOf(previous, node.id) === tracksOf(current, node.id);
    status.set(node.id, same ? "same" : "morph");
  }
  const exiting = (previous?.nodes ?? []).filter((node) => !status.has(node.id) || status.get(node.id) === "enter")
    .map((node) => node.id);
  return { status, exiting };
}

const NUMBER = /[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g;
const skeleton = (text) => String(text).replace(NUMBER, "#").replace(/\s+/g, " ").trim();

function canMorphAttrs(a, b) {
  for (const key of ["d", "points"]) {
    if ((a[key] === undefined) !== (b[key] === undefined)) return false;
    if (a[key] !== undefined && skeleton(a[key]) !== skeleton(b[key])) return false;
  }
  return true;
}

/** Geometry between two morphable attribute sets at progress `t`. */
export function lerpGraphicAttrs(a, b, t) {
  const p = clamp01(t);
  const out = {};
  for (const [key, value] of Object.entries(b)) {
    const from = a[key];
    if (typeof value === "number" && typeof from === "number") out[key] = from + (value - from) * p;
    else if ((key === "d" || key === "points") && typeof from === "string") {
      const left = from.match(NUMBER).map(Number);
      let index = 0;
      out[key] = value.replace(NUMBER, (match) => {
        const start = left[index++];
        return String(Math.round((start + (Number(match) - start) * p) * 100) / 100);
      });
    } else out[key] = p < 0.5 && from !== undefined ? from : value;
  }
  return out;
}

/** Original, repository-synthesized effects (scripts/build-pro-sfx.mjs). */
export const PRO_SFX = {
  "whoosh-deep": { file: "sfx/pro/whoosh-deep.wav", frames: 24 },
  "whoosh-soft": { file: "sfx/pro/whoosh-soft.wav", frames: 17 },
  "whoosh-fast": { file: "sfx/pro/whoosh-fast.wav", frames: 10 },
  shimmer: { file: "sfx/pro/shimmer.wav", frames: 30 },
  "pop-a": { file: "sfx/pro/pop-a.wav", frames: 5 },
  "pop-b": { file: "sfx/pro/pop-b.wav", frames: 5 },
  "pop-c": { file: "sfx/pro/pop-c.wav", frames: 5 },
  chime: { file: "sfx/pro/chime.wav", frames: 33 },
  impact: { file: "sfx/pro/impact.wav", frames: 15 },
};
const SCENE_SOUND = { "zoom-through": "whoosh-deep", wipe: "whoosh-soft", "whip-up": "whoosh-fast", "light-leak": "shimmer" };

/**
 * Cue-bound sound design for the official mix. `scenes`: in order, each
 * { id, kind, from, durationFrames, beats (resolved, scene-local frames) }.
 * Events never start before the first spoken word of the video and keep a
 * minimum gap so the narration stays dominant.
 */
export function planProSfx({ scenes, config }) {
  const sound = config.sound;
  if (!sound?.enabled) return [];
  const described = scenes.map((scene) => ({ ...scene,
    firstIll: illOf(scene.beats?.[0]), lastIll: illOf(scene.beats?.at(-1)) }));
  const transitions = planSceneTransitions(described, config);
  const focus = lessonFocus(described.flatMap((scene) => scene.beats ?? []));
  const candidates = [];
  const add = (id, frame, priority, volume, reason, group = id) =>
    candidates.push({ id, frame: Math.max(0, Math.round(frame)), priority, volume, reason, group });
  described.forEach((scene, sceneIndex) => {
    if (sceneIndex > 0) {
      const type = transitions[sceneIndex];
      const id = SCENE_SOUND[type];
      const lead = id.startsWith("whoosh") ? sound.leadFrames.whoosh : 0;
      add(id, scene.from - lead, 5, sound.volume[id], "scene:" + type, "scene");
    }
    if (!scene.beats?.length) return;
    const shots = planShots(scene.beats, config);
    const modes = planVisualModes(scene.beats, focus);
    let positiveSeen = false;
    scene.beats.forEach((beat, index) => {
      if (sceneIndex === 0 && index === 0) return; // no opening sound cue
      const at = scene.from + beat.localFrame;
      const ill = illOf(beat), previousIll = illOf(scene.beats[index - 1]);
      if (["stamp", "cross"].includes(ill?.overlay) && previousIll?.overlay !== ill.overlay)
        add("impact", at - sound.leadFrames.impact, 4, sound.volume.impact, beat.id + ":" + ill.overlay);
      const mood = ill?.cast?.[0]?.mood, previousMood = previousIll?.cast?.[0]?.mood;
      if (!positiveSeen && POSITIVE_MOODS.has(mood) && index > 0 && !POSITIVE_MOODS.has(previousMood)) {
        positiveSeen = true;
        add("chime", at, 3, sound.volume.chime, beat.id + ":" + mood);
      }
      if (POSITIVE_MOODS.has(mood)) positiveSeen = true;
      const switched = index > 0 && modes[index].mode !== modes[index - 1].mode;
      if ((modes[index].mode === "art" && shots[index].transition === "whip") || switched)
        add("whoosh-soft", at - sound.leadFrames.whoosh, 2, sound.volume.whooshBeat,
          beat.id + (switched ? ":" + modes[index].mode : ":whip"), "beat-whoosh");
      const before = new Set(distinctCardBeats(scene.beats, index - 1).map((item) => cardPhraseKey(item.visual?.hanzi)));
      const key = cardPhraseKey(beat.visual?.hanzi);
      if (key && (index === 0 || !before.has(key))) add("pop", at, 1, sound.volume.pop, beat.id + ":card");
    });
  });
  const groupGap = { "beat-whoosh": sound.beatWhooshMinGapFrames, pop: sound.popMinGapFrames };
  const accepted = [];
  for (const event of candidates.sort((a, b) => b.priority - a.priority || a.frame - b.frame)) {
    if (accepted.some((other) => Math.abs(other.frame - event.frame) < sound.minGapFrames)) continue;
    const gap = groupGap[event.group];
    if (gap && accepted.some((other) => other.group === event.group && Math.abs(other.frame - event.frame) < gap)) continue;
    accepted.push(event);
  }
  // Card pops rotate three pitches so a run of new forms never sounds stamped.
  let pops = 0;
  return accepted.sort((a, b) => a.frame - b.frame).map((event) => {
    const variant = event.id === "pop" ? "pop-" + "abc"[pops++ % 3] : event.id;
    return { ...event, file: PRO_SFX[variant].file, durationFrames: PRO_SFX[variant].frames };
  });
}
