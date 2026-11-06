import { createHash } from "node:crypto";
import { buildCaptionSections } from "./caption-utils.mjs";
import { compileMotionDesignTimeline } from "./motion-design-plan.mjs";
import { compilePromoTimeline } from "./promo-production.mjs";

function currentNarrationHash(episode) {
  const narration = episode.scenes.map((scene) => scene.narration.trim()).join("\n\n") + "\n";
  return createHash("sha256").update(narration, "utf8").digest("hex");
}

function hashJson(value) {
  return createHash("sha256").update(JSON.stringify(value), "utf8").digest("hex");
}

function currentCueSource(episode) {
  return {
    audioSha256: episode.audioSha256 ?? null,
    audioDurationMs: episode.audioDurationMs ?? null,
    audioTrimAfterFrames: episode.audioTrimAfterFrames ?? null,
    motionDesign: episode.motionDesign ?? null,
    motionDesignStyle: episode.motionDesignStyle ?? null,
    semanticVisual: episode.semanticVisual ?? null,
    storytelling: episode.storytelling ?? null,
    scenes: episode.scenes.map((scene) => ({
      id: scene.id,
      kind: scene.kind,
      startMs: scene.startMs ?? null,
      endMs: scene.endMs ?? null,
      durationFrames: scene.durationFrames ?? null,
      durationSec: scene.durationSec ?? null,
      captionStyleId: scene.captionStyleId ?? null,
      // Platform CTA scenes may have different art, while their timing and
      // spoken cues are already bound by the shared episode hashes.
      ...(scene.kind === "cta" ? {} : {
        motionBeats: scene.motionBeats ?? null,
        promoVisual: scene.promoVisual ?? null,
        semanticShot: scene.semanticShot ?? null,
        visualBeats: scene.visualBeats ?? null,
        storyboard: scene.storyboard ?? null,
      }),
    })),
  };
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
  const wordCuesHash = hashJson(wordCues);
  const motionByScene = new Map((motion?.scenes ?? []).map((scene) => [scene.sceneId, scene]));
  const promoByScene = new Map((promo?.scenes ?? []).map((scene) => [scene.sceneId, scene]));
  return {
    schemaVersion: 1,
    episodeId: episode.id,
    languageCode: episode.languageCode,
    fps,
    voiceTextHash,
    audioSha256: episode.audioSha256 ?? null,
    wordCuesHash,
    cueSourceHash: hashJson(currentCueSource(episode)),
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

export function assertCueTimelineMatches(episode, timeline, fps = 30) {
  const expectedHash = currentNarrationHash(episode);
  const expectedWordCuesHash = hashJson(episode.captions ?? []);
  if (episode.voiceTextHash !== expectedHash || timeline?.schemaVersion !== 1 || timeline.episodeId !== episode.id ||
      timeline.languageCode !== episode.languageCode || timeline.fps !== fps ||
      timeline.voiceTextHash !== expectedHash ||
      timeline.audioSha256 !== (episode.audioSha256 ?? null) ||
      timeline.wordCuesHash !== expectedWordCuesHash ||
      hashJson(timeline.wordCues ?? []) !== expectedWordCuesHash ||
      timeline.cueSourceHash !== hashJson(currentCueSource(episode)) ||
      !Array.isArray(timeline.scenes) ||
      timeline.scenes.length !== episode.scenes.length ||
      timeline.scenes.some((scene, index) => scene.sceneId !== episode.scenes[index].id)) {
    throw new Error("Render cue timeline does not match the current episode, locale, voice text, or frame rate.");
  }
  return true;
}
