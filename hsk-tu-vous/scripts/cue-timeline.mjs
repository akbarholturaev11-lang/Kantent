/** Browser-safe source snapshot for the compiled timing consumed by Remotion. */
export function cueTimelineSource(episode) {
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
      narration: scene.narration,
      startMs: scene.startMs ?? null,
      endMs: scene.endMs ?? null,
      durationFrames: scene.durationFrames ?? null,
      durationSec: scene.durationSec ?? null,
      captionStyleId: scene.captionStyleId ?? null,
      // Platform CTA scenes may have different art; lesson cues and timing
      // remain identical and are still bound by this source snapshot.
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

/** Validate Remotion props without importing Node-only production helpers. */
export function assertCueTimelineMatches(episode, timeline, fps = 30) {
  if (!episode?.id || !episode.languageCode || !Array.isArray(episode.scenes) ||
      timeline?.schemaVersion !== 1 || timeline.episodeId !== episode.id ||
      timeline.languageCode !== episode.languageCode || timeline.fps !== fps ||
      !episode.voiceTextHash || timeline.voiceTextHash !== episode.voiceTextHash ||
      timeline.audioSha256 !== (episode.audioSha256 ?? null) ||
      JSON.stringify(timeline.wordCues ?? []) !== JSON.stringify(episode.captions ?? []) ||
      JSON.stringify(timeline.cueSource) !== JSON.stringify(cueTimelineSource(episode)) ||
      !Array.isArray(timeline.scenes) ||
      timeline.scenes.length !== episode.scenes.length ||
      timeline.scenes.some((scene, index) => scene.sceneId !== episode.scenes[index].id)) {
    throw new Error("Render cue timeline does not match the current episode, locale, voice text, or frame rate.");
  }
  return true;
}
