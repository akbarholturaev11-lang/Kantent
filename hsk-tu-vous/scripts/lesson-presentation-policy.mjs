import {validatePromoMedia} from './promo-production.mjs';
import {validateActionLesson} from "./action-design-plan.mjs";

function applies(episode, policy) {
  if (policy?.styleId !== "explain-actions-v1" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(policy.effectiveFromDate ?? "") ||
      !/^\d{4}-\d{2}-\d{2}$/.test(policy.visibleStateValidationFromDate ?? "") ||
      policy.visibleStateValidationFromDate < policy.effectiveFromDate ||
      !Number.isFinite(policy.maximumVisualHoldSec) || policy.maximumVisualHoldSec <= 0) {
    throw Error("Invalid content/visual-system.json#lessonPresentation policy.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(episode.date ?? "")) {
    throw Error("Lesson presentation requires a dated episode.");
  }
  return episode.date >= policy.effectiveFromDate;
}

/** Select the approved presentation for a new draft; never invent its actions. */
export function applyLessonPresentationDefault(episode, policy) {
  if (!applies(episode, policy)) return episode;
  const draft = structuredClone(episode);
  draft.motionDesign ??= true;
  draft.motionDesignStyle ??= policy.styleId;
  for (const scene of draft.scenes ?? []) {
    if (scene.kind !== "cta") scene.captionStyleId = "highlight";
  }
  return draft;
}

/** Run before paid TTS and every render, including already voiced review copies. */
export function validateLessonPresentation(episode, policy) {
  if(episode.kind==="advertisement")return validatePromoMedia(episode);
  if (!applies(episode, policy)) return null;
  if (episode.motionDesign !== true || episode.motionDesignStyle !== policy.styleId) {
    throw Error("The approved lesson format is required. Read content/EDITING_SPEC.md and author explain-actions-v1 motionBeats for every lesson scene before voice/render.");
  }
  return validateActionLesson(episode, {requireVisibleChange:
    episode.date >= policy.visibleStateValidationFromDate});
}
