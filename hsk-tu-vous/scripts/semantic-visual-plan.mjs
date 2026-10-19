import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registry = JSON.parse(fs.readFileSync(path.join(root, "content/semantic-visual-system.json"), "utf8"));
export const SEMANTIC_VISUAL_SCHEMA_VERSION = 1;

const identifier = /^[a-z][a-z0-9-]{0,63}$/;
const includes = (key, value) => registry[key].includes(value);
const sha256 = value => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const tokens = text => String(text ?? "").normalize("NFKC").toLocaleLowerCase("ru-RU").replace(/ё/g,"е").match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
const finite = value => typeof value === "number" && Number.isFinite(value);
const hasSemantic = scene => Boolean(scene.semanticShot || (scene.visualBeats ?? []).some(beat => beat.semanticAction || beat.syncCueOccurrence !== undefined));

/**
 * Additive draft-only contract. The legacy renderer, CTA and voice are not altered.
 * Returns errors so callers can attach their own context without side effects.
 */
export function validateSemanticVisualEpisode(episode) {
  const errors = [];
  if (!episode || !Array.isArray(episode.scenes)) return ["episode: scenes are required"];
  const tagged = episode.scenes.some(hasSemantic);
  const marker = episode.semanticVisual;
  if (!marker) {
    if (tagged) errors.push("episode: semanticVisual opt-in is required for semanticShot/semanticAction");
    return errors;
  }
  if (marker.schemaVersion !== SEMANTIC_VISUAL_SCHEMA_VERSION || marker.mode !== "review-only")
    errors.push("episode: semanticVisual must be {schemaVersion:1,mode:'review-only'}");
  if (!tagged) errors.push("episode: semantic opt-in needs at least one semantic shot/action");
  for (const scene of episode.scenes) {
    const prefix = String(scene.id || "unnamed scene");
    if (scene.kind === "cta") {
      if (hasSemantic(scene)) errors.push(prefix + ": semantic visual metadata is forbidden in CTA");
      continue;
    }
    const shot = scene.semanticShot;
    const actions = (scene.visualBeats ?? []).filter(beat => beat.semanticAction);
    if (actions.length && !shot) errors.push(prefix + ": semanticAction requires semanticShot");
    if (shot) {
      if (typeof shot !== "object" || Array.isArray(shot)) {
        errors.push(prefix + ": semanticShot must be an object");
      } else {
        if (!includes("environments",shot.environmentId)) errors.push(prefix + ": unsupported environmentId");
        if (!includes("shotTypes",shot.shotType)) errors.push(prefix + ": unsupported shotType");
        if (!includes("cameraStyles",shot.cameraStyle)) errors.push(prefix + ": unsupported cameraStyle");
        for (const key of ["actorIds","objectIds"]) {
          if (shot[key] !== undefined && (!Array.isArray(shot[key]) || shot[key].length > 12 ||
              shot[key].some(id => typeof id !== "string" || !identifier.test(id)) ||
              new Set(shot[key]).size !== shot[key].length))
            errors.push(prefix + ": invalid " + key);
        }
        const entities = [...(Array.isArray(shot.actorIds) ? shot.actorIds : []),
          ...(Array.isArray(shot.objectIds) ? shot.objectIds : [])];
        if (new Set(entities).size !== entities.length) errors.push(prefix + ": entity IDs must be unique");
      }
    }
    for (const [index,beat] of (scene.visualBeats ?? []).entries()) {
      const label = prefix + "/beat[" + index + "]";
      if (beat.syncCueOccurrence !== undefined &&
          (!Number.isInteger(beat.syncCueOccurrence) || beat.syncCueOccurrence < 1 || beat.syncCueOccurrence > 100))
        errors.push(label + ": syncCueOccurrence must be 1..100");
      const action = beat.semanticAction;
      if (!action) {
        if (beat.syncCueOccurrence !== undefined) errors.push(label + ": occurrence needs semanticAction");
        continue;
      }
      if (!shot || typeof shot !== "object" || Array.isArray(shot)) continue;
      if (!includes("actions",action.type)) errors.push(label + ": unsupported semantic action");
      if (!beat.syncCueText || tokens(beat.syncCueText).length === 0)
        errors.push(label + ": action needs the exact spoken syncCueText");
      const entities = [...(Array.isArray(shot.actorIds) ? shot.actorIds : []),
        ...(Array.isArray(shot.objectIds) ? shot.objectIds : [])];
      if (typeof action.subjectId !== "string" || !entities.includes(action.subjectId))
        errors.push(label + ": subjectId must belong to semanticShot actorIds/objectIds");
      if (action.targetId !== undefined && action.targetId !== "camera" && !entities.includes(action.targetId))
        errors.push(label + ": targetId must belong to semanticShot or be camera");
      if (action.durationMs !== undefined &&
          (!Number.isInteger(action.durationMs) || action.durationMs < registry.timing.minActionDurationMs ||
            action.durationMs > registry.timing.maxActionDurationMs))
        errors.push(label + ": durationMs outside allowed motion range");
    }
  }
  return errors;
}

function sceneWords(episode, scene) {
  const words = [];
  for (const [index,caption] of (episode.captions ?? []).entries()) {
    if (!finite(caption.startMs) || !finite(caption.endMs) || caption.endMs <= caption.startMs)
      throw Error(scene.id + ": invalid caption timing at index " + index);
    if (caption.endMs <= scene.startMs || caption.startMs >= scene.endMs) continue;
    if (caption.startMs < scene.startMs || caption.endMs > scene.endMs)
      throw Error(scene.id + ": cue crosses scene boundary at caption " + index);
    const cueTokens = tokens(caption.text);
    // The legacy importer accepts >=80% single-word cues. A multiword caption
    // unrelated to the selected action is harmless, but cannot anchor motion.
    if (!cueTokens.length) continue;
    words.push({text:cueTokens.length === 1 ? cueTokens[0] : null,
      rawTokens:cueTokens,opaque:cueTokens.length !== 1,
      startMs:caption.startMs,endMs:caption.endMs,captionIndex:index});
  }
  for(let i=1;i<words.length;i++)
    if(words[i].startMs < words[i-1].endMs)
      throw Error(scene.id + ": overlapping or unsorted word captions");
  return words;
}

/**
 * Strict frame-anchored motion timeline, ONLY for test/review.
 * A semantic action starts on/after the actual spoken cue, never on an early beat lead.
 * Missing/ambiguous cues cause errors; no proportional fallback.
 */
export function compileSemanticVisualTimeline(episode) {
  const errors = validateSemanticVisualEpisode(episode);
  if (errors.length) throw Error(errors.join("\n"));
  if (!episode.semanticVisual) throw Error("episode: not opted in to semantic visuals");
  if (episode.captionSource !== "gemini-word-timestamps" || !(episode.captions?.length))
    throw Error("episode: imported verified word-level Gemini captions are required");
  const fps = registry.timing.fps;
  const result = [];
  for (const scene of episode.scenes) {
    if (!hasSemantic(scene) || scene.kind === "cta") continue;
    if (!finite(scene.startMs) || !finite(scene.endMs) || scene.endMs <= scene.startMs)
      throw Error(scene.id + ": imported scene startMs/endMs are required");
    // Background-only semantic scenes need no word anchors; do not reject
    // harmless caption boundary rounding where no action is synchronized.
    const words = (scene.visualBeats ?? []).some(beat=>beat.semanticAction)
      ? sceneWords(episode,scene) : [];
    const actions = [];
    for (const [index,beat] of (scene.visualBeats ?? []).entries()) {
      if (!beat.semanticAction) continue;
      const cue = tokens(beat.syncCueText);
      const matches = [];
      for (let i=0;i<=words.length-cue.length;i++) {
        if (!cue.every((part,j) => words[i+j].text === part)) continue;
        if (cue.some((_,j) => j>0 && words[i+j].startMs - words[i+j-1].endMs >
            registry.timing.maxAdjacentCueGapMs)) continue;
        matches.push({start:words[i],end:words[i+cue.length-1]});
      }
      const occurrence=beat.syncCueOccurrence;
      if (!matches.length) {
        if (words.some(word => word.opaque && cue.some(token => word.rawTokens.includes(token))))
          throw Error(scene.id + "/beat[" + index + "]: selected cue is inside a multiword caption; exact word timing required");
        throw Error(scene.id + "/beat[" + index + "]: spoken cue not found: " + beat.syncCueText);
      }
      if (occurrence === undefined && matches.length !== 1)
        throw Error(scene.id + "/beat[" + index + "]: ambiguous cue; provide syncCueOccurrence");
      if (occurrence !== undefined && occurrence > matches.length)
        throw Error(scene.id + "/beat[" + index + "]: requested cue occurrence not found");
      const found = matches[(occurrence ?? 1)-1];
      const startMs=found.start.startMs;
      const durationMs=beat.semanticAction.durationMs ?? registry.timing.defaultActionDurationMs;
      const endMs=startMs+durationMs;
      if(endMs > scene.endMs) throw Error(scene.id + "/beat[" + index + "]: action overruns scene");
      if (actions.length && startMs < actions.at(-1).endMs)
        throw Error(scene.id + "/beat[" + index + "]: overlapping or out-of-order semantic actions");
      const startFrame=Math.ceil(startMs*fps/1000);
      const endFrame=Math.ceil(endMs*fps/1000);
      actions.push({beatIndex:index,action:beat.semanticAction.type,subjectId:beat.semanticAction.subjectId,
        targetId:beat.semanticAction.targetId ?? null,cueText:beat.syncCueText,
        cueOccurrence:occurrence ?? 1,captionIndex:found.start.captionIndex,startMs,
        endMs,startFrame,endFrame,durationFrames:endFrame-startFrame});
    }
    result.push({sceneId:scene.id,shot:scene.semanticShot ?? null,actions});
  }
  return {
    schemaVersion:SEMANTIC_VISUAL_SCHEMA_VERSION,mode:"review-only",rendererReady:false,
    episodeId:episode.id,fps,sourceFingerprint:sha256({semanticVisual:episode.semanticVisual,
      scenes:episode.scenes.map(s=>({id:s.id,kind:s.kind,semanticShot:s.semanticShot,visualBeats:s.visualBeats,
        startMs:s.startMs,endMs:s.endMs}))}),
    timingFingerprint:sha256({voiceTextHash:episode.voiceTextHash,captionSource:episode.captionSource,
      captions:episode.captions}),
    scenes:result
  };
}
