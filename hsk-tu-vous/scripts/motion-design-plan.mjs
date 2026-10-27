import {ACTION_KINDS, validateActionLesson, validateVisualHold} from "./action-design-plan.mjs";
// Visual changes are anchored to verified spoken words, never equal scene slices.
export const MOTION_KINDS = [
  "question", "two-meanings", "compare-preview", "example", "purchase",
  "particle", "verb-focus", "completed", "intention", "stop", "reconsider",
  "end-position", "changed-state", "completed-reminder", "changed-reminder",
  "not-past", "recall", "end-answer", "takeaway", "positions", "meaning", ...ACTION_KINDS,
];
const normalize = (text, locale) => {
  let value = String(text ?? "").normalize("NFKC").toLowerCase();
  if (locale !== "tg-TJ") value = value.replace(/ё/g, "е");
  return value.match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
};
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);

export function resolveMotionBeats(scene, captions, fps = 30, locale = "ru-RU") {
  if (!scene.motionBeats?.length) return [];
  if (!Number.isFinite(scene.startMs) || !Number.isFinite(scene.endMs) ||
      !Number.isFinite(fps) || fps <= 0) throw Error(scene.id + ": verified scene timing required");
  // A spoken word belongs to the scene where it STARTS. The importer can
  // cap the hook at six seconds while its last word finishes in the outgoing
  // crossfade. Do not lose that real cue or borrow a word starting next scene.
  const words = captions.filter(word => word.startMs >= scene.startMs && word.startMs < scene.endMs);
  let previous = -1;
  const ids = new Set();
  return scene.motionBeats.map(beat => {
    if (!/^[a-z][a-z0-9-]*$/.test(beat.id ?? "") || ids.has(beat.id) || !MOTION_KINDS.includes(beat.kind))
      throw Error(scene.id + ": invalid/duplicate motion beat id or kind");
    ids.add(beat.id);
    const cue = normalize(beat.cueText, locale);
    if (!cue.length) throw Error(scene.id + ": motion beat needs cueText");
    const matches = [];
    for (let i=0; i<words.length; i++) {
      let combined=[];
      for(let j=i;j<words.length && combined.length<cue.length;j++) {
        if(j>i && words[j].startMs-words[j-1].endMs>400) break;
        combined=combined.concat(normalize(words[j].text, locale));
        if(same(combined,cue)) matches.push({first:words[i],last:words[j],captionIndex:captions.indexOf(words[i])});
      }
    }
    const occurrence = beat.cueOccurrence;
    if (!matches.length || (occurrence === undefined && matches.length !== 1) ||
        (occurrence !== undefined && (!Number.isInteger(occurrence) || occurrence<1 || occurrence>matches.length)))
      throw Error(scene.id + "/" + beat.id + ": missing/ambiguous exact spoken cue: " + beat.cueText);
    const match=matches[(occurrence ?? 1)-1];
    if(match.first.startMs<=previous) throw Error(scene.id + ": motion beats must follow speech order");
    if(!Number.isFinite(match.first.startMs) || !Number.isFinite(match.last.endMs) ||
        match.last.endMs<=match.first.startMs) throw Error(scene.id + ": invalid cue timing");
    previous=match.first.startMs;
    const startFrame=Math.ceil(match.first.startMs*fps/1000);
    return {...beat,startMs:match.first.startMs,endMs:match.last.endMs,startFrame,
      localFrame:startFrame-Math.round(scene.startMs*fps/1000),captionIndex:match.captionIndex};
  });
}

export function compileMotionDesignTimeline(episode, presentationPolicy) {
  const scenes = episode.scenes.filter(scene => scene.motionBeats?.length);
  if(!scenes.length && episode.motionDesignStyle!=="explain-actions-v1") return null;
  if(episode.motionDesign!==true || episode.captionSource!=="gemini-word-timestamps" || !episode.captions?.length)
    throw Error("Narrated motion design requires its explicit style and verified Gemini captions.");
  if(!["le-context-v1", "explain-actions-v1"].includes(episode.motionDesignStyle))
    throw Error("Unsupported narrated motion style; add a truthful renderer before using a new lesson treatment.");
  if(scenes.some(scene=>scene.kind==="cta")) throw Error("Central CTA cannot contain lesson motion beats.");
  const coverage = episode.motionDesignStyle==="explain-actions-v1" ? validateActionLesson(episode) : undefined;
  if (!coverage && scenes.some(s=>s.motionBeats.some(b=>ACTION_KINDS.includes(b.kind))))
    throw Error("Reusable actions require explain-actions-v1; legacy styles cannot silently render them.");
  return {schemaVersion:1,episodeId:episode.id,style:episode.motionDesignStyle,timingSource:episode.captionSource,
    ...(coverage ? {coverage} : {}),
    scenes:scenes.map(scene=>{
      const beats=resolveMotionBeats(scene,episode.captions,30,episode.languageCode);
      const visualHold = presentationPolicy && episode.motionDesignStyle==="explain-actions-v1" &&
        episode.date >= presentationPolicy.visibleStateValidationFromDate
        ? validateVisualHold(scene,beats,presentationPolicy.maximumVisualHoldSec) : undefined;
      return {sceneId:scene.id,beats,...(visualHold ? {visualHold} : {})};
    })};
}
