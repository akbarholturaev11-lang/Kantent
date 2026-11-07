import { createHash } from "node:crypto";
import { buildCaptionSections } from "./caption-utils.mjs";
import { compileMotionDesignTimeline } from "./motion-design-plan.mjs";
import { compilePromoTimeline } from "./promo-production.mjs";
import { cueTimelineSource } from "./cue-timeline.mjs";

function currentNarrationHash(episode) {
  const narration = episode.scenes.map((scene) => scene.narration.trim()).join("\n\n") + "\n";
  return createHash("sha256").update(narration, "utf8").digest("hex");
}

/** Compile every speech-timed renderer input from the exact imported episode. */
export function compileCueTimeline(episode, {
  fps = 30,
  presentationPolicy,
  semanticTimeline = null,
} = {}) {
  if (!episode?.id || !episode.languageCode || !Array.isArray(episode.scenes) ||
      !Number.isFinite(fps) || fps <= 0) {
    throw new Error("Cue timeline requires an episode, locale, scenes, and positive frame rate.");
  }
  const voiceTextHash = currentNarrationHash(episode);
  if (!episode.voiceTextHash || episode.voiceTextHash !== voiceTextHash) {
    throw new Error("Cue timeline narration hash does not match the imported voice text.");
  }
  const motion = compileMotionDesignTimeline(episode, presentationPolicy);
  const promo = compilePromoTimeline(episode, fps);
  const wordCues = structuredClone(episode.captions ?? []);
  const motionByScene = new Map((motion?.scenes ?? []).map((scene) => [scene.sceneId, scene]));
  const promoByScene = new Map((promo?.scenes ?? []).map((scene) => [scene.sceneId, scene]));
  return {
    schemaVersion: 1,
    episodeId: episode.id,
    languageCode: episode.languageCode,
    fps,
    voiceTextHash,
    audioSha256: episode.audioSha256 ?? null,
    cueSource: cueTimelineSource(episode),
    wordCues,
    captionSections: buildCaptionSections(episode.scenes, fps),
    scenes: episode.scenes.map((scene) => ({
      sceneId: scene.id,
      startMs: scene.startMs ?? null,
      endMs: scene.endMs ?? null,
      motionBeats: motionByScene.get(scene.id)?.beats ?? [],
      promoCue: promoByScene.get(scene.id)?.cue ?? null,
    })),
    ...(semanticTimeline ? { semanticTimeline } : {}),
  };
}
