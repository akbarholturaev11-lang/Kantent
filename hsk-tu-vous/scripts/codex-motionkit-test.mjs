/**
 * Automatic per-video test brief for the Codex video-production agent.
 * This script does not call an LLM or any API. It only reads the registered
 * source and gives Codex a safe, inspectable component candidate set.
 * Codex makes the creative decision and records a validated per-scene choice.
 * Never rewrites authored video, voice, published media, or main catalogs.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {previewVideoComponentPlan,asSelectorEpisode} from "./preview-video-component-plan.mjs";
import {allowedMotionKitCandidates,validateCodexMotionDecision,CODEX_MOTION_TEST_MODE}
  from "./codex-motionkit-selection.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const SHA=(text)=>createHash("sha256").update(text,"utf8").digest("hex");
const ID=/^[a-z][a-z0-9-]{1,110}$/;
export function motionKitTestPaths(episodeId) {
  if(typeof episodeId!=="string"||!ID.test(episodeId))
    throw Error("MotionKit TEST requires a registered, safe episode ID");
  const dir=path.join(ROOT,"review","motion-kit-tests",episodeId);
  return {dir,briefFile:path.join(dir,"brief.json"),decisionFile:path.join(dir,"codex-decision.json")};
}

/** Read-only: works even before Gemini audio/assets have been created. */
export async function buildCodexMotionKitTestBrief(key) {
  const preview=await previewVideoComponentPlan(key);
  const item=JSON.parse(await fs.readFile(path.join(ROOT,"content","calendar.json"),"utf8"))
    .items.find(x=>x.id===preview.plan.episodeId);
  if(!item || (item.status!=="planned" && item.status!=="draft"))
    throw Error("MotionKit TEST only runs for planned/unapproved source content");
  const sourceText=await fs.readFile(path.join(ROOT,"content",preview.sourcePath),"utf8");
  const source=JSON.parse(sourceText);
  const adapted=asSelectorEpisode(item,source,preview.plan.contentType);
  const eligible=new Set(preview.plan.scenes.map(s=>s.sceneId));
  const scenes=adapted.scenes.filter(s=>eligible.has(s.id)).map(s=>({
    sceneId:s.id,sceneKind:s.kind,narration:s.narration,
    authoredCues:(preview.plan.contentType==="advertisement"
      ? (source.beats??source.scenes) : source.scenes)
      .find(x=>x.id===s.id)?.motionBeats?.map(b=>b.cueText)??[],
    candidates:allowedMotionKitCandidates(s,preview.plan.contentType).map(c=>({
      id:c.id,source:c.source,purpose:c.purpose
    })),
    algorithmSuggestion:preview.plan.scenes.find(x=>x.sceneId===s.id)?.componentId??null,
  }));
  return {
    schemaVersion:1,mode:CODEX_MOTION_TEST_MODE,
    label:"⚠️ EXPERIMENT / TEST ONLY — not an approved production effect",
    episodeId:item.id,date:item.date,contentType:preview.plan.contentType,
    sourcePath:preview.sourcePath,sourceSha256:SHA(sourceText),
    automaticBrief:true, selectionOwner:"Codex video-production agent",
    candidateGenerator:"deterministic algorithm, NOT artificial intelligence",
    creativeSelection:"Codex selects after reading narration, semantic beats, source evidence and recent video composition",
    externalSelectionApi:null,requiresNewApiKey:false,
    status:"codex-selection-required",
    scenes, priorSelections:preview.recentCompared,
    protections:[
      "No new AI/model API for motion selection; Codex's existing reasoning makes the decision",
      "These are test candidates, not instructions to change every real video automatically",
      "One meaningful component per eligible scene; skip unsupported visuals rather than fabricate proof",
      "Lessons: only artwork-only effects; preserve exactly one stable glass teaching card and one timed subtitle",
      "No counterfeit product UI, new characters, changed voice, invented timestamps, or modified CTA",
      "Actual voice-linked render still needs imported Gemini word cues and audio SHA-256",
      "Before production promotion: baseline/candidate MP4s, phone-size review, and exact owner preview approval",
    ],
    codexDecisionSchema:{
      schemaVersion:1,mode:"TEST_ONLY",chosenBy:"Codex",
      episodeId:item.id,contentType:preview.plan.contentType,sourceSha256:SHA(sourceText),
      scenes:"Ordered array of {sceneId,componentId,reason,narrationEvidence} with genuine per-scene reasoning and an exact narration substring",
    },
  };
}
export async function prepareCodexMotionKitTestBrief(key) {
  const brief=await buildCodexMotionKitTestBrief(key);
  const paths=motionKitTestPaths(brief.episodeId);
  await fs.mkdir(paths.dir,{recursive:true});
  await fs.writeFile(paths.briefFile,JSON.stringify(brief,null,2)+"\n");
  return {mode:CODEX_MOTION_TEST_MODE,episodeId:brief.episodeId,
    status:"codex-selection-required",selectionOwner:"Codex",aiApiConnected:false,
    briefFile:paths.briefFile,decisionFile:paths.decisionFile,
    nextAgentAction:"Codex: read brief.json, select components yourself using the episode narration and visual meanings, write codex-decision.json, run node scripts/codex-motionkit-test.mjs <episode-id> --validate. This is a TEST, not automatic production approval.",
    productionEffectsEnabled:false,
  };
}
export async function loadValidCodexMotionTestDecision(episodeId) {
  const brief=await buildCodexMotionKitTestBrief(episodeId);
  const paths=motionKitTestPaths(brief.episodeId);
  let decision;
  try{decision=JSON.parse(await fs.readFile(paths.decisionFile,"utf8"))}
  catch(error){throw Error("MotionKit TEST: Codex decision missing/invalid at "+paths.decisionFile+"; no automatic hash-based substitution: "+error.message)}
  validateCodexMotionDecision(decision,brief);
  return {brief,decision};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const key=process.argv[2];
  if(!key){console.error("Usage: node scripts/codex-motionkit-test.mjs <episode-id-or-date> [--validate]");process.exitCode=2}
  else if(process.argv.slice(3).includes("--validate")){
    loadValidCodexMotionTestDecision(key).then(({brief,decision})=>{
      console.log(JSON.stringify({mode:"TEST_ONLY",episodeId:brief.episodeId,
        chosenBy:decision.chosenBy,validatedScenes:decision.scenes.length,aiApiConnected:false},null,2));
    }).catch(e=>{console.error(e.message);process.exitCode=1});
  } else {
    prepareCodexMotionKitTestBrief(key).then(value=>console.log(JSON.stringify(value,null,2)))
      .catch(e=>{console.error(e.message);process.exitCode=1});
  }
}
