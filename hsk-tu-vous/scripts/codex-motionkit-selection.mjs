/**
 * Pure, browser-safe checks for Codex-authored TEST ONLY motion decisions.
 * A seeded hash selector only proposes candidates; Codex supplies a reviewed
 * decision. No LLM API, credentials or extra inference service are used here.
 */
import {MOTION_COMPONENTS} from "./video-component-selector.mjs";

export const CODEX_MOTION_TEST_MODE="TEST_ONLY";
const artIds=new Set(["art-dissolve","art-drift"]);
export function allowedMotionKitCandidates(scene,contentType) {
  if(!scene||scene.kind==="cta")return [];
  const filtered=MOTION_COMPONENTS.filter(component=>
    component.formats.includes(contentType)&&
    component.sceneKinds.includes(scene.kind));
  return filtered.filter(component=>
    contentType==="lesson"?artIds.has(component.id):true);
}
export function validateCodexMotionDecision(decision,brief) {
  if(!brief||brief.mode!==CODEX_MOTION_TEST_MODE||
     !["lesson","advertisement","series-part"].includes(brief.contentType)||
     !Array.isArray(brief.scenes))
    throw Error("Codex MotionKit: valid TEST ONLY brief required");
  if(!decision||decision.schemaVersion!==1||
     decision.mode!==CODEX_MOTION_TEST_MODE||
     decision.chosenBy!=="Codex"||
     decision.episodeId!==brief.episodeId||
     decision.contentType!==brief.contentType||
     decision.sourceSha256!==brief.sourceSha256||
     !Array.isArray(decision.scenes))
    throw Error("Codex MotionKit: decision must match current TEST ONLY source and creator");
  if(decision.scenes.length!==brief.scenes.length)
    throw Error("Codex MotionKit: a deliberate decision is required for every eligible scene");
  const ids=new Set();
  for(let i=0;i<brief.scenes.length;i++){
    const row=brief.scenes[i],choice=decision.scenes[i];
    if(!choice||ids.has(choice.sceneId)||choice.sceneId!==row.sceneId)
      throw Error("Codex MotionKit: scene order, uniqueness or ID mismatch");
    ids.add(choice.sceneId);
    const allowed=new Set(row.candidates.map(x=>x.id));
    if(!allowed.has(choice.componentId))
      throw Error("Codex MotionKit: unsupported or disallowed component "+choice.componentId);
    if(typeof choice.reason!=="string"||choice.reason.trim().length<24)
      throw Error("Codex MotionKit: a concrete per-scene visual rationale is required");
    if(typeof choice.narrationEvidence!=="string"||
       choice.narrationEvidence.trim().length<2||
       !row.narration.includes(choice.narrationEvidence))
      throw Error("Codex MotionKit: cited narration evidence must occur in the authored scene");
  }
  return true;
}
