import {assertCueTimelineMatches} from "./cue-timeline.mjs";
import {resolveMotionBeats} from "./motion-design-plan.mjs";
import {selectVideoComponents} from "./video-component-selector.mjs";

/**
 * MotionKit v1 opt-in binder. Produces frame-stable, word-cue-bound *art-only*
 * metadata for current illustrated-glass lessons. Never changes narration,
 * canonical episode sources, timeline, voice, CTA, or publication state.
 *
 * The legacy render path does not invoke this unless explicitly given a plan.
 */
export const MOTION_KIT_CUE_SCHEMA_VERSION = 1;
const ART_EFFECTS = new Set(["art-dissolve", "art-drift"]);
const hasIllustration = (beat) =>
  beat?.visual?.illustration?.images?.length > 0;

function verifyVoiceEvidence(episode, timeline, fps) {
  if (!episode || !timeline) throw Error("MotionKit requires an episode and its imported cue timeline");
  assertCueTimelineMatches(episode, timeline, fps);
  if (episode.captionSource !== "gemini-word-timestamps")
    throw Error("MotionKit requires real imported Gemini word timestamps; planned/pending cues cannot be used");
  if (typeof episode.audioSha256 !== "string" || !/^[a-f0-9]{64}$/i.test(episode.audioSha256))
    throw Error("MotionKit requires a verified source audio SHA-256");
  if (episode.motionDesign !== true || episode.motionDesignStyle !== "explain-actions-v1")
    throw Error("MotionKit illustrated lesson pilot requires explain-actions-v1");
  if (!episode.scenes?.some((scene) => scene.motionBeats?.length))
    throw Error("MotionKit requires authored, speech-linked lesson motion beats");
  if (!Array.isArray(timeline.wordCues) || !timeline.wordCues.length)
    throw Error("MotionKit requires nonempty imported word cues");
  if (timeline.audioSha256 !== episode.audioSha256)
    throw Error("MotionKit must keep the original verified audio hash");
}

/** Re-validate every resolved anchor against the actual imported word cues. */
function validateResolvedScene(episode, timeline, scene, timedScene) {
  if (!Number.isFinite(scene.startMs) || !Number.isFinite(scene.endMs) ||
      scene.endMs <= scene.startMs)
    throw Error("MotionKit: missing verified scene start/end: "+scene.id);
  if (timedScene?.startMs !== scene.startMs || timedScene?.endMs !== scene.endMs)
    throw Error("MotionKit: scene boundaries differ from canonical cue timeline: "+scene.id);
  const actual = timedScene?.motionBeats;
  if (!Array.isArray(actual) || !actual.length || actual.length !== scene.motionBeats?.length)
    throw Error("MotionKit: missing canonical resolved beats in scene: "+scene.id);
  const expected = resolveMotionBeats(scene, timeline.wordCues, timeline.fps, episode.languageCode);
  if (expected.length !== actual.length) throw Error("MotionKit: unexpected beat count: "+scene.id);
  const ids = new Set();
  return expected.map((beat,i) => {
    const resolved = actual[i];
    if (!ART_EFFECTS.has("art-dissolve") || ids.has(beat.id) || !hasIllustration(beat))
      throw Error("MotionKit: duplicate beat or missing reviewed illustration: "+scene.id+"/"+beat.id);
    ids.add(beat.id);
    if (resolved.id !== beat.id || resolved.startMs !== beat.startMs ||
        resolved.localFrame !== beat.localFrame || resolved.startFrame !== beat.startFrame ||
        resolved.captionIndex !== beat.captionIndex)
      throw Error("MotionKit: forged or stale resolved word cue: "+scene.id+"/"+beat.id);
    return {beatId:beat.id, startMs:beat.startMs, localFrame:beat.localFrame};
  });
}

/** One deliberate effect per eligible scene, applied ONLY to visual artwork. */
export function compileMotionKitCuePlan(episode, cueTimeline, {
  contentType = "lesson", recentSequences = [], codexDecision = null,
} = {}) {
  if (contentType !== "lesson")
    throw Error("MotionKit v1 voice-bound pilot supports illustrated lesson art only");
  verifyVoiceEvidence(episode, cueTimeline, cueTimeline?.fps ?? 30);
  // The deterministic selector is ONLY a candidate/CI fallback. A real opt-in
  // run must pass an already-validated per-video Codex decision.
  if(codexDecision && (codexDecision.chosenBy!=="Codex" ||
      codexDecision.mode!=="TEST_ONLY" ||
      codexDecision.episodeId!==episode.id ||
      codexDecision.contentType!==contentType ||
      codexDecision.languageCode!==episode.languageCode))
    throw Error("MotionKit requires an episode-bound Codex TEST decision");
  const selection = codexDecision
    ? codexDecision.scenes
    : selectVideoComponents(episode, {contentType, recentSequences}).scenes;
  const scenes = [];
  for (const selected of selection) {
    const source = episode.scenes.find(s=>s.id===selected.sceneId);
    const timed = cueTimeline.scenes.find(s=>s.sceneId===selected.sceneId);
    if (!ART_EFFECTS.has(selected.componentId))
      throw Error("MotionKit: only artwork-only adapters may change illustrated lessons");
    if (!source || source.kind === "cta")
      throw Error("MotionKit: CTA/source scene cannot be adapted");
    const beats = validateResolvedScene(episode, cueTimeline, source, timed);
    scenes.push({sceneId:source.id, componentId:selected.componentId, beats});
  }
  return {
    schemaVersion:MOTION_KIT_CUE_SCHEMA_VERSION,
    mode:"opt-in-review-only", contentType, episodeId:episode.id,
    languageCode:episode.languageCode, fps:cueTimeline.fps,
    selectionOwner:codexDecision?"Codex":"synthetic-fixture-only",
    voiceTextHash:episode.voiceTextHash, audioSha256:episode.audioSha256,
    sceneIds:cueTimeline.scenes.map(s=>s.sceneId),
    scenes,
  };
}

/** Browser-safe render-side validation. No network, guessed timestamps or defaults. */
export function assertMotionKitCuePlanMatches(episode, cueTimeline, plan) {
  if (!plan || plan.schemaVersion !== MOTION_KIT_CUE_SCHEMA_VERSION ||
      plan.mode !== "opt-in-review-only" || plan.contentType !== "lesson" ||
      plan.episodeId !== episode?.id || plan.languageCode !== episode?.languageCode ||
      plan.fps !== cueTimeline?.fps || plan.voiceTextHash !== episode?.voiceTextHash ||
      plan.audioSha256 !== episode?.audioSha256 ||
      !["Codex","synthetic-fixture-only"].includes(plan.selectionOwner) ||
      !Array.isArray(plan.scenes) ||
      !Array.isArray(plan.sceneIds))
    throw Error("MotionKit plan does not match this voice/episode/locale");
  verifyVoiceEvidence(episode,cueTimeline,cueTimeline.fps);
  if (JSON.stringify(plan.sceneIds) !== JSON.stringify(cueTimeline.scenes.map(s=>s.sceneId)))
    throw Error("MotionKit scene order does not match this exact cue timeline");
  const validSceneIds = new Set(), selectionIds = new Set();
  for (const item of plan.scenes) {
    if (!ART_EFFECTS.has(item.componentId) ||
        validSceneIds.has(item.sceneId) || !Array.isArray(item.beats) || !item.beats.length)
      throw Error("Invalid MotionKit scene selection");
    validSceneIds.add(item.sceneId);
    const source = episode.scenes.find(s=>s.id===item.sceneId);
    const timed = cueTimeline.scenes.find(s=>s.sceneId===item.sceneId);
    if (!source || source.kind === "cta") throw Error("MotionKit must never affect the CTA");
    const expected=validateResolvedScene(episode,cueTimeline,source,timed);
    if(JSON.stringify(item.beats)!==JSON.stringify(expected))
      throw Error("MotionKit contains stale or fabricated beat anchors: "+item.sceneId);
    selectionIds.add(item.sceneId);
  }
  // No partial or extra scene layers once selected for an episode.
  const eligible = selectVideoComponents(episode,{contentType:"lesson"}).scenes.map(s=>s.sceneId);
  if (selectionIds.size !== eligible.length || eligible.some(id=>!selectionIds.has(id)))
    throw Error("MotionKit plan coverage differs from actual authored lesson scenes");
  return true;
}
