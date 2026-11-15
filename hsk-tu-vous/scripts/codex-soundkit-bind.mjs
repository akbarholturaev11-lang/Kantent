/**
 * SoundKit P3 — fail-closed, explicitly invoked offline TEST binder.
 * Reads only an already-produced unapproved review episode, its imported voice
 * bytes, current matching cue-timeline.json and Codex's validated P2 choice.
 * Saves TIMED INTENT metadata in an isolated TEST review folder. No renderer,
 * TTS, remote API, publication state or audio file is changed.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {activeLanguage,languageSettings,withLanguage} from "./language-context.mjs";
import {reviewDir} from "./lib.mjs";
import {loadValidCodexSoundKitDecision,soundKitTestPaths}
  from "./codex-soundkit-test.mjs";
import {compileSoundKitCuePlan} from "./sound-kit-cue-plan.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const sha=buf=>createHash("sha256").update(buf).digest("hex");
const ID=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PLATFORM=new Set(["shared","tiktok"]);

async function safeFileWithin(base,rel) {
  if(typeof rel!=="string"||!rel||path.isAbsolute(rel)||
     rel.split(/[\\/]+/).some(piece=>!piece||piece==="."||piece===".."))
    throw Error("SoundKit P3 requires a safe relative asset/voice path");
  const safe=path.resolve(base,rel);
  if(!safe.startsWith(path.resolve(base)+path.sep))
    throw Error("SoundKit P3 path escapes the approved asset root");
  const real=await fs.realpath(safe);
  if(!real.startsWith(path.resolve(base)+path.sep))
    throw Error("SoundKit P3 rejects symlinks to files outside the approved asset root");
  return real;
}
export async function prepareSoundKitCuePlan(key,{
  language=activeLanguage(),platform="shared",
}={}) {
  if(typeof key!=="string"||!ID.test(key)||!PLATFORM.has(platform))
    throw Error("SoundKit P3 requires registered episode ID and shared|tiktok platform");
  const lang=languageSettings(language);
  const {brief,decision}=await loadValidCodexSoundKitDecision(key,{language});
  const dir=withLanguage(language,()=>reviewDir(brief.episodeId));
  const realDir=platform==="shared"?dir:path.join(dir,"tiktok");
  // The P3 plan is derived metadata, but even so do not create a new
  // experimental variant for already owner-approved historical content.
  for(const protectedDir of [dir,realDir]){
    try {
      await fs.access(path.join(protectedDir,"approval.json"));
      throw Error("SoundKit P3 refuses owner-approved review package");
    } catch(e) {
      if(e.code!=="ENOENT")throw e;
    }
  }
  for(const statusPath of [path.join(dir,"status.json"),path.join(realDir,"status.json")]){
    try {
      const status=JSON.parse(await fs.readFile(statusPath,"utf8"));
      if(["owner-approved-for-zernio-publishing","zernio-published",
          "zernio-scheduled","zernio-publication-processing"].includes(status.stage))
        throw Error("SoundKit P3 cannot create test plans for approved/published historical packages");
    }catch(e){if(e.code!=="ENOENT")throw e;}
  }
  const episode=JSON.parse(await fs.readFile(path.join(realDir,"episode.json"),"utf8"));
  const timeline=JSON.parse(await fs.readFile(path.join(realDir,"cue-timeline.json"),"utf8"));
  if(episode.id!==brief.episodeId||episode.languageCode!==lang.languageCode||
     ["approved","published"].includes(episode.publishingStatus))
    throw Error("SoundKit P3 cannot rebind wrong locale or approved/published historical media");
  const profile=JSON.parse(await fs.readFile(lang.voiceProfilePath,"utf8"));
  if(profile.status!=="approved"||
     episode.voiceProfileId!==profile.profileId||
     episode.voiceProvider!==profile.provider||
     profile.locale!==lang.languageCode)
    throw Error("SoundKit P3 source voice profile is not the current approved language profile");
  const publicRoot=path.join(ROOT,"public");
  const voicePath=await safeFileWithin(publicRoot,episode.audioSrc);
  const audioBytes=await fs.readFile(voicePath);
  if(sha(audioBytes)!==episode.audioSha256)
    throw Error("SoundKit P3 file SHA-256 differs from recorded actual imported voice");
  const candidateMap=new Map(brief.scenes.flatMap(scene=>
    scene.candidates.filter(c=>c.id!=="SILENCE").map(c=>[c.id,c])));
  const selectedIds=new Set(decision.scenes.map(x=>x.soundId).filter(id=>id!=="SILENCE"));
  const assetHashes={};
  for(const id of selectedIds){
    const entry=candidateMap.get(id);
    if(!entry)throw Error("SoundKit P3 unknown reference sound "+id);
    const p=await safeFileWithin(ROOT,entry.file);
    const bytes=await fs.readFile(p);
    assetHashes[id]=sha(bytes);
  }
  const plan=compileSoundKitCuePlan(episode,timeline,{
    brief,decision,audioBytes,assetHashes,platform,
  });
  const out=soundKitTestPaths(brief.episodeId,language);
  const filename=platform==="shared"?"cue-plan-shared.json":"cue-plan-tiktok.json";
  await fs.mkdir(out.dir,{recursive:true});
  await fs.writeFile(path.join(out.dir,filename),JSON.stringify(plan,null,2)+"\n");
  return {
    mode:"TEST_ONLY",phase:"P3_EXACT_CUE_BINDING",episodeId:brief.episodeId,
    language:brief.language,platform,
    selectedSoundCount:plan.selected.length,
    silentSceneCount:plan.report.filter(x=>x.status==="SILENCE").length,
    boundToRealWordCues:true,voiceSha256:episode.audioSha256,
    cuePlan:path.join(out.dir,filename),
    audioMixProduced:false,productionEffectsEnabled:false,aiApiConnected:false,
    nextAgentAction:"P3 saves verified frame-accurate SOUND INTENT only. Do not feed this to Remotion until future P4 opt-in audio/voice-masking QA and exact owner approval.",
  };
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const key=process.argv[2];
  const args=process.argv.slice(3);
  const langArg=args.find(x=>x.startsWith("--language="));
  const platformArg=args.find(x=>x.startsWith("--platform="));
  if(!key||args.some(x=>!x.startsWith("--language=")&&!x.startsWith("--platform="))||
     args.filter(x=>x.startsWith("--language=")).length>1||
     args.filter(x=>x.startsWith("--platform=")).length>1){
    console.error("Usage: node scripts/codex-soundkit-bind.mjs <episode-id> [--language=ru|tg] [--platform=shared|tiktok]");
    process.exitCode=2;
  }else{
    const language=langArg?.slice("--language=".length)??activeLanguage();
    const platform=platformArg?.slice("--platform=".length)??"shared";
    prepareSoundKitCuePlan(key,{language,platform})
      .then(x=>console.log(JSON.stringify(x,null,2)))
      .catch(e=>{console.error("SoundKit P3 BLOCKED: "+e.message);process.exitCode=1});
  }
}
