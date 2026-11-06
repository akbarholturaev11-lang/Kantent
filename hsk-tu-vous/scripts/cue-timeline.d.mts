import type { ResolvedMotionBeat } from "./motion-design-plan.mjs";
import type { SemanticTimeline } from "../src/SemanticStoryScene";

export type CueTimelineScene = {
  sceneId: string;
  startMs: number | null;
  endMs: number | null;
  motionBeats: ResolvedMotionBeat[];
  promoCue: ResolvedMotionBeat | null;
};
export type CueTimeline = {
  schemaVersion: 1;
  episodeId: string;
  languageCode: string;
  fps: number;
  voiceTextHash: string;
  audioSha256: string | null;
  cueSource: any;
  wordCues: import("../src/CaptionOverlay").TimedCaption[];
  captionSections: { startMs: number; endMs: number; styleId: string }[];
  scenes: CueTimelineScene[];
  semanticTimeline?: SemanticTimeline;
};
export function cueTimelineSource(episode: any): any;
export function assertCueTimelineMatches(episode: any, timeline: CueTimeline, fps?: number): true;
