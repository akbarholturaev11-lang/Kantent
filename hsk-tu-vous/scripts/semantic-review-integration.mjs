import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { suggestSemanticShots } from "./semantic-shot-adviser.mjs";
import { compileSemanticVisualTimeline, validateSemanticVisualEpisode } from "./semantic-visual-plan.mjs";
import { validateStorytellingWordTiming } from "./storytelling-timing.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const flags=JSON.parse(fs.readFileSync(path.join(root,"content/semantic-visual-system.json"),"utf8"));
const types=new Set(flags.previewSupportedActions);
const actorActions=new Set(flags.previewActorActions);
const objectActions=new Set(flags.previewObjectActions);

export const reviewSemanticEligible=(episode)=>
  flags.reviewAutoEnabled===true &&
  episode.date>=flags.reviewAutoFromDate &&
  !episode.semanticVisual &&
  !episode.audioSrc && !episode.voiceTextHash && !(episode.captions?.length) &&
  !episode.scenes?.some(scene=>scene.kind==="cta") &&
  !["published","scheduled","owner-approved-for-zernio-publishing"].includes(episode.publishingStatus);

/**
 * Apply conservative deterministic visuals to a NEW CTA-free working draft.
 * Never edits the canonical episode, never treats suggested text as Gemini timing.
 * Narration, Chinese cards, CTA and old approvals are not modified.
 */
export function applySemanticReviewDraft(source) {
  if(!reviewSemanticEligible(source)) return source;
  const proposals=suggestSemanticShots(source,{eligibility:"planned"});
  if(!proposals.eligible) return source;
  const episode=structuredClone(source);
  let actionCount=0;
  const byId=new Map(proposals.scenes.map(s=>[s.sceneId,s]));
  for(const scene of episode.scenes){
    const plan=byId.get(scene.id);
    if(!plan || scene.semanticShot) continue;
    // Every lesson scene gets an evidence-linked location/framing, not a
    // universal student and not a duplicate building in each video.
    scene.semanticShot=structuredClone(plan.proposedShot);
    let chosen=0;
    for(const suggestion of plan.actionCandidates){
      if(chosen>=2 || !suggestion.assetSupported ||
        suggestion.cueOccurrenceNeedsReview ||
        suggestion.suggestedBeatIndex===null ||
        !types.has(suggestion.proposedAction)) continue;
      const beat=scene.visualBeats?.[suggestion.suggestedBeatIndex];
      if(!beat || beat.semanticAction || beat.syncCueText || beat.syncCueOccurrence) continue;
      const actor=scene.semanticShot.actorIds?.includes(suggestion.subjectId);
      const object=scene.semanticShot.objectIds?.includes(suggestion.subjectId);
      if(!(actor&&actorActions.has(suggestion.proposedAction) ||
           object&&objectActions.has(suggestion.proposedAction))) continue;
      if(object && !/(door|gate)/i.test(suggestion.subjectId)) continue;
      beat.syncCueText=suggestion.proposedCueText;
      beat.semanticAction={
        type:suggestion.proposedAction,subjectId:suggestion.subjectId
      };
      chosen++;actionCount++;
    }
  }
  episode.semanticVisual={schemaVersion:1,mode:"review-only"};
  episode.autoSemantic={
    source:"content/semantic-shot-intents.json",
    status:"review-video-required",
    actionCount,
    originalNarrationUnchanged:true
  };
  const errors=validateSemanticVisualEpisode(episode);
  if(errors.length)throw Error("Auto semantic plan invalid: "+errors.join("; "));
  if(episode.scenes.some((s,i)=>s.narration!==source.scenes[i].narration))
    throw Error("Semantic planner changed narration");
  return episode;
}

/** Strict exact-word timeline; only when real Gemini audio/captions are present. */
export function prepareSemanticRender(episode) {
  if (episode.storytelling) validateStorytellingWordTiming(episode);
  if(!episode.semanticVisual) return null;
  if(!flags.reviewAutoEnabled)
    throw Error("Semantic review render is disabled by canonical feature flag");
  if(episode.semanticVisual.mode!=="review-only")
    throw Error("Unsupported semantic render mode");
  const plan=compileSemanticVisualTimeline(episode);
  if(!plan.scenes.some(s=>s.shot))
    throw Error("Semantic render has no planned shots");
  if(plan.scenes.length!==episode.scenes.filter(s=>s.kind!=="cta" && s.semanticShot).length)
    throw Error("Semantic scene/timeline mismatch");
  return plan;
}
