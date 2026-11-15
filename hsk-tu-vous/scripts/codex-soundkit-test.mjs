/**
 * SOUNDKIT P2: automatically produce a source-evidenced TEST ONLY brief.
 * Codex's own reasoning must choose/skip effects. This code calls no AI API,
 * creates no audio, does not prepare timestamps, and cannot change a render.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {activeLanguage,languageSettings,lessonSourceHash} from "./language-context.mjs";
import {previewVideoComponentPlan} from "./preview-video-component-plan.mjs";
import {
  SOUNDKIT_TEST_MODE,SOUNDKIT_SILENCE,
  soundCandidatesForScene,validateCodexSoundKitDecision,
} from "./codex-soundkit-selection.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const SHA=data=>createHash("sha256").update(data).digest("hex");
const ID=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function soundKitTestPaths(episodeId,language=activeLanguage()){
  if(typeof episodeId!=="string"||!ID.test(episodeId))
    throw Error("SoundKit TEST requires a safe registered episode ID");
  const settings=languageSettings(language);
  const dir=path.join(ROOT,"review","sound-design-tests",episodeId,settings.language);
  return {dir,briefFile:path.join(dir,"brief.json"),
    decisionFile:path.join(dir,"codex-decision.json")};
}
async function readSource(file) {
  const raw=await fs.readFile(file,"utf8");
  return {raw,data:JSON.parse(raw)};
}
export async function buildCodexSoundKitTestBrief(key,{language=activeLanguage()}={}){
  const preview=await previewVideoComponentPlan(key);
  const calendar=JSON.parse(await fs.readFile(path.join(ROOT,"content","calendar.json"),"utf8"));
  const item=calendar.items.find(x=>x.id===preview.plan.episodeId);
  if(!item||!["planned","draft"].includes(item.status))
    throw Error("SoundKit TEST requires a planned, unapproved and unpublished calendar item");
  const selected=languageSettings(language);
  const canonical=await readSource(path.join(ROOT,"content",preview.sourcePath));
  const sourceFile=path.join(selected.contentRoot,preview.sourcePath);
  const source=await readSource(sourceFile);
  if(source.data.id!==item.id||source.data.date&&source.data.date!==item.date||
     source.data.languageCode!==selected.languageCode)
    throw Error("SoundKit source ID/date/language does not match registered locale");
  if(selected.language==="tg"){
    const binding=source.data.localization;
    if(binding?.language!=="tg" ||binding.sourceHash!==lessonSourceHash(canonical.data)||
      (preview.plan.contentType==="advertisement"?
        binding.sourcePromoId!==item.id:binding.sourceEpisodeId!==item.id))
      throw Error("SoundKit stale/missing localized source binding; never substitute Russian material");
  }
  const policyText=await fs.readFile(path.join(ROOT,"content","sound-design.json"),"utf8");
  const catalogText=await fs.readFile(path.join(ROOT,"content","sound-library.json"),"utf8");
  const policy=JSON.parse(policyText),catalog=JSON.parse(catalogText);
  const rawScenes=preview.plan.contentType==="advertisement"?
    (source.data.beats??source.data.scenes):source.data.scenes;
  if(!Array.isArray(rawScenes)||rawScenes.length===0)
    throw Error("SoundKit source has no authored visual scenes");
  const scenes=rawScenes.filter(x=>x.kind!=="cta"&&x.role!=="cta"&&x.id!=="cta")
    .map((scene,index)=>{
      const sceneKind=scene.kind??scene.role??"story";
      const row={...scene,kind:sceneKind};
      const {events,candidates,firstSceneProtected,rules}=
        soundCandidatesForScene(row,preview.plan.contentType,policy,catalog,index);
      return {
        sceneId:scene.id,sceneKind,
        narration:scene.narration,
        firstSceneProtected, visualEvents:events,
        candidates,choiceRule:rules,
        requiresRealAudioQA:true,timingBound:false,
      };
    });
  if(scenes.some(x=>!ID.test(x.sceneId)||typeof x.narration!=="string"||!x.narration.trim())||
     new Set(scenes.map(x=>x.sceneId)).size!==scenes.length)
    throw Error("SoundKit invalid or repeated scene identity/narration");
  return {
    schemaVersion:1,mode:SOUNDKIT_TEST_MODE,
    label:"⚠️ CODEX SOUND DIRECTOR — TEST ONLY / CATALOG AUDITION; no audio mixed",
    episodeId:item.id,date:item.date,contentType:preview.plan.contentType,
    language:selected.language,languageCode:selected.languageCode,
    sourcePath:path.relative(ROOT,sourceFile).replaceAll(path.sep,"/"),
    sourceSha256:SHA(source.raw),
    librarySha256:SHA(catalogText),policySha256:SHA(policyText),
    catalogueSize:catalog.exactFileCount,
    catalogueRights:"CC0-1.0 pinned Kenney Godot mirrors; UI Audio mirror has 51 vs 50 official listing",
    allAssetsEligibleForProduction:false,
    automaticBrief:true,selectionOwner:"Codex existing video-production agent",
    candidateGenerator:"deterministic, NOT AI",
    externalSelectionApi:null,requiresNewApiKey:false,
    productionEffectsEnabled:false,
    status:"Codex decision required; source-scoped SOUND INTENT only",
    silenceChoiceId:SOUNDKIT_SILENCE,
    soundHistoryStatus:"previous registered videos are only references; no prior SoundKit decisions inferred",
    previousVideoReferences:preview.recentCompared,
    scenes,
    instructions:[
      "Codex must choose one candidate per scene, including the explicit SILENCE option; selection is not performed by this script.",
      "First scene/hook, CTA and unsupported visuals MUST be SILENCE. Never invent on-screen taps, payments, completed installs, success states or word timestamps.",
      "Cite EXACT source visualEvidence and narrationEvidence for each non-silent choice and explain why an audible effect is better than silence.",
      "For SILENCE, record clear rationale; no fake evidence, no sound SHA and no event.",
      "Candidates are audition references only: every source asset is currently NOT eligible for automatic production. Do not render this P2 choice.",
      "Real language-specific Gemini word cue and audio SHA binding is deferred to P3. Any actual sound mix, owner A/B QA and publication must wait for later phases.",
      "No new LLM, audio generation, external provider API/credential or account is connected; use Codex's existing reasoning."
    ],
    decisionShape:{
      schemaVersion:1,mode:SOUNDKIT_TEST_MODE,chosenBy:"Codex",
      episodeId:item.id,contentType:preview.plan.contentType,
      language:selected.language,languageCode:selected.languageCode,
      sourceSha256:SHA(source.raw),librarySha256:SHA(catalogText),
      policySha256:SHA(policyText),productionEffectsEnabled:false,
      scenes:"In exact brief order, {sceneId,soundId,eventId,visualEvidence,narrationEvidence,assetSha256,gainPreset,reason}; SILENCE has null event/evidence/hash and gainPreset 'none'."
    },
  };
}
export async function prepareCodexSoundKitTestBrief(key,{language=activeLanguage()}={}){
  const brief=await buildCodexSoundKitTestBrief(key,{language});
  const loc=soundKitTestPaths(brief.episodeId,language);
  await fs.mkdir(loc.dir,{recursive:true});
  await fs.writeFile(loc.briefFile,JSON.stringify(brief,null,2)+"\n");
  return {
    mode:SOUNDKIT_TEST_MODE,episodeId:brief.episodeId,
    language:brief.language,languageCode:brief.languageCode,
    status:"codex-sound-selection-required",
    selectionOwner:"Codex",aiApiConnected:false,
    productionEffectsEnabled:false,audioMixNotImplemented:true,
    briefFile:loc.briefFile,decisionFile:loc.decisionFile,
    nextAgentAction:"⚠️ SOUNDKIT TEST ONLY: Codex read the exact localized brief and decide sound/SILENCE for each scene. Write codex-decision.json with genuine evidence, then run node scripts/codex-soundkit-test.mjs <id> --language="+language+" --validate. P2 does not render effects, modify approved audio or connect an AI API."
  };
}
export async function loadValidCodexSoundKitDecision(key,{language=activeLanguage()}={}){
  const brief=await buildCodexSoundKitTestBrief(key,{language});
  const loc=soundKitTestPaths(brief.episodeId,language);
  let decision;
  try{decision=JSON.parse(await fs.readFile(loc.decisionFile,"utf8"))}
  catch(e){throw Error("SoundKit TEST decision missing or malformed; Codex must author it (no fallback): "+e.message)}
  validateCodexSoundKitDecision(decision,brief);
  return {brief,decision};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const key=process.argv[2];
  const args=process.argv.slice(3);
  const langArg=args.find(x=>x.startsWith("--language="));
  if(!key||args.some(x=>x!=="--validate"&&!x.startsWith("--language="))||
     args.filter(x=>x.startsWith("--language=")).length>1){
    console.error("Usage: node scripts/codex-soundkit-test.mjs <episode-id-or-date> [--language=ru|tg] [--validate]");
    process.exitCode=2;
  }else{
    const language=langArg?.slice("--language=".length)??activeLanguage();
    const op=args.includes("--validate")?
      loadValidCodexSoundKitDecision(key,{language}).then(({brief,decision})=>({
        mode:SOUNDKIT_TEST_MODE,episodeId:brief.episodeId,language:brief.language,
        valid:true,chosenBy:decision.chosenBy,
        sceneCount:decision.scenes.length,aiApiConnected:false,productionEffectsEnabled:false
      })):
      prepareCodexSoundKitTestBrief(key,{language});
    op.then(value=>console.log(JSON.stringify(value,null,2)))
      .catch(error=>{console.error(error.message);process.exitCode=1});
  }
}
