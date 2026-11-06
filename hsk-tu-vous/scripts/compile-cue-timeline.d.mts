import type { CueTimeline } from "./cue-timeline.mjs";
import type { SemanticTimeline } from "../src/SemanticStoryScene";

export function compileCueTimeline(
  episode: any,
  options?: { fps?: number; presentationPolicy?: any; semanticTimeline?: SemanticTimeline | null },
): CueTimeline;
