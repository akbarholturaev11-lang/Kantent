export type BoundSoundKitEffect = {
  sceneId: string;
  eventId: string;
  soundId: string;
  assetSha256: string;
  staticSrc: string;
  startMs: number;
  endCueMs: number;
  captionIndex: number;
  startFrame: number;
  clipFrames: number;
  endFrame: number;
  hardDeadlineFrame: number;
  volume: number;
};
export type BoundSoundKitRenderPlan = {
  schemaVersion: 1;
  mode: "TEST_ONLY";
  phase: "P4_ISOLATED_MIX_REVIEW";
  productionEffectsEnabled: false;
  audioMixTestOnly: true;
  ownerApprovalGranted: false;
  removesLegacySoundCues: true;
  episodeId: string;
  languageCode: string;
  voiceTextHash: string;
  audioSha256: string;
  timelineVoiceTextHash: string;
  timelineAudioSha256: string;
  sourceCueTimelineSha256: string;
  fps: 30;
  selected: BoundSoundKitEffect[];
};
export function assertSoundKitRenderPlanMatches(
  episode: any,
  timeline: import("./cue-timeline.mjs").CueTimeline,
  plan: BoundSoundKitRenderPlan,
): true;
export function makeSoundKitRenderPlan(
  episode: any,
  timeline: import("./cue-timeline.mjs").CueTimeline,
  p3: any,
  staticAssets: Record<string, string>,
  visualSound: {sceneCueVolume:number;beatCueVolume:number},
): BoundSoundKitRenderPlan;
