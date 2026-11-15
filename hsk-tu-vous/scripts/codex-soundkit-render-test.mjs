/** SoundKit P4 manual TEST-only preview. Never modifies canonical video packages. */
import fs from "node:fs/promises";
import path from "node:path";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {activeLanguage,languageSettings,withLanguage} from "./language-context.mjs";
import {reviewDir} from "./lib.mjs";
import {loadValidCodexSoundKitDecision,soundKitTestPaths} from "./codex-soundkit-test.mjs";
import {compileSoundKitCuePlan} from "./sound-kit-cue-plan.mjs";
import {makeSoundKitRenderPlan} from "./sound-kit-render-plan.mjs";
import {assertCueTimelineMatches} from "./cue-timeline.mjs";
import visualSystem from "../content/visual-system.json" with {type:"json"};

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const PUBLIC=path.join(ROOT,"public");
const sha=x=>createHash("sha256").update(x).digest("hex");
const safeId=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const platforms=new Set(["instagram","youtube","facebook","tiktok"]);
const published=new Set(["owner-approved-for-zernio-publishing",
  "zernio-published","zernio-scheduled","zernio-publication-processing"]);

async function trustedFile(root,relative) {
  if(typeof relative!=="string"||!relative||path.isAbsolute(relative)||
     relative.split(/[\\/]+/).some(x=>!x||x==="."||x===".."))
    throw Error("SoundKit P4 invalid local path");
  const real=await fs.realpath(path.join(root,relative));
  if(!real.startsWith(path.resolve(root)+path.sep))
    throw Error("SoundKit P4 file escapes approved source root");
  return real;
}
async function noApproval(root,other) {
  for(const dir of new Set([root,other])){
    try {
      await fs.access(path.join(dir,"approval.json"));
      throw Error("SoundKit P4 will not change a previously approved video");
    } catch(e){if(e.code!=="ENOENT")throw e}
    try {
      const state=JSON.parse(await fs.readFile(path.join(dir,"status.json"),"utf8"));
      if(published.has(state.stage))throw Error("SoundKit P4 blocks published package");
    }catch(e){if(e.code!=="ENOENT")throw e}
  }
}
export async function renderSoundKitTest(key,{
  language=activeLanguage(),platform="instagram",
}={}) {
  if(process.env.HSK_AI_SOUND_DESIGN_TEST!=="1")
    throw Error("SoundKit P4 requires explicit HSK_AI_SOUND_DESIGN_TEST=1");
  if(!safeId.test(key??"")||!platforms.has(platform))
    throw Error("SoundKit P4 invalid registered video ID or platform");
  const lang=languageSettings(language);
  const {brief,decision}=await loadValidCodexSoundKitDecision(key,{language});
  const root=withLanguage(language,()=>reviewDir(brief.episodeId));
  const episodeDir=platform==="instagram"?root:path.join(root,platform);
  await noApproval(root,episodeDir);
  const episode=JSON.parse(await fs.readFile(path.join(episodeDir,"episode.json"),"utf8"));
  const timeline=JSON.parse(await fs.readFile(path.join(
    platform==="tiktok"?episodeDir:root,"cue-timeline.json"),"utf8"));
  if(episode.id!==brief.episodeId||episode.languageCode!==lang.languageCode||
     ["approved","published"].includes(episode.publishingStatus))
    throw Error("SoundKit P4 source identity/locale/approval mismatch");
  assertCueTimelineMatches(episode,timeline,30);
  const voiceProfile=JSON.parse(await fs.readFile(lang.voiceProfilePath,"utf8"));
  if(voiceProfile.status!=="approved"||voiceProfile.provider!==episode.voiceProvider||
     voiceProfile.profileId!==episode.voiceProfileId||voiceProfile.locale!==episode.languageCode)
    throw Error("SoundKit P4 requires approved real localized voice");
  const voiceBytes=await fs.readFile(await trustedFile(PUBLIC,episode.audioSrc));
  if(sha(voiceBytes)!==episode.audioSha256)
    throw Error("SoundKit P4 original narration hash mismatch");
  const candidates=new Map(brief.scenes.flatMap(scene=>
    scene.candidates.filter(x=>x.id!=="SILENCE").map(x=>[x.id,x])));
  const chosen=new Set(decision.scenes.map(x=>x.soundId).filter(x=>x!=="SILENCE"));
  const fileBytes={};const assetHashes={};
  for(const id of chosen){
    const entry=candidates.get(id);
    if(!entry)throw Error("SoundKit P4 missing approved catalog reference");
    const bytes=await fs.readFile(await trustedFile(ROOT,entry.file));
    if(sha(bytes)!==entry.sha256)throw Error("SoundKit P4 altered Kenney CC0 WAV bytes");
    fileBytes[id]=bytes;assetHashes[id]=entry.sha256;
  }
  const sourcePlatform=platform==="tiktok"?"tiktok":"shared";
  const recomputed=compileSoundKitCuePlan(episode,timeline,{
    brief,decision,audioBytes:voiceBytes,assetHashes,platform:sourcePlatform,
  });
  const soundFolder=soundKitTestPaths(brief.episodeId,language).dir;
  const storedPath=path.join(soundFolder,
    sourcePlatform==="shared"?"cue-plan-shared.json":"cue-plan-tiktok.json");
  const prior=JSON.parse(await fs.readFile(storedPath,"utf8"));
  if(JSON.stringify(recomputed)!==JSON.stringify(prior))
    throw Error("SoundKit P4 stale P3 plan; rerun exact real-voice cue binding");
  const temp=await fs.mkdtemp(path.join(PUBLIC,"soundkit-p4-preview-"));
  const out=path.join(soundFolder,"p4-preview",platform);
  try {
    const stage={};
    for(const id of chosen){
      const file=assetHashes[id]+".wav";
      const p=path.join(temp,file);
      await fs.writeFile(p,fileBytes[id],{flag:"wx"});
      stage[id]=path.basename(temp)+"/"+file;
    }
    const soundKitRenderPlan=makeSoundKitRenderPlan(
      episode,timeline,prior,stage,visualSystem.sound);
    await fs.mkdir(out,{recursive:true});
    const propsFile=path.join(temp,"props.json");
    const video=path.join(out,"p4-audio-test.mp4");
    await fs.writeFile(propsFile,JSON.stringify({episode,
      cueTimeline:timeline,soundKitRenderPlan}));
    const command=path.join(ROOT,"node_modules/.bin/remotion");
    const result=spawnSync(command,["render","src/index.ts","HSKAI-Episode",
      video,"--props",propsFile,"--codec","h264",
      "--pixel-format","yuv420p","--color-space","bt709"],{
      cwd:ROOT,encoding:"utf8",maxBuffer:3_000_000,timeout:1200000,
      env:{...process.env,HSK_AI_SOUND_DESIGN_TEST:"1"},
    });
    if(result.error||result.status!==0)
      throw Error("SoundKit P4 preview rendering failed: "
        +String(result.error?.message??result.stderr??"").slice(-2000));
    const bytes=await fs.readFile(video);
    if(!bytes.length||sha(voiceBytes)!==episode.audioSha256)
      throw Error("SoundKit P4 missing video or original voice tampering");
    const report={schemaVersion:1,mode:"TEST_ONLY",phase:"P4_ISOLATED_MIX_REVIEW",
      language:brief.language,platform,episodeId:episode.id,
      originalVoiceSha256:episode.audioSha256,originalVoiceUnmodified:true,
      selected:soundKitRenderPlan.selected.map(x=>({
        soundId:x.soundId,assetSha256:x.assetSha256,
        startFrame:x.startFrame,clipFrames:x.clipFrames,volume:x.volume,
      })),
      legacyEffectsSuppressed:true,productionEffectsEnabled:false,
      publishingAuthorized:false,ownerApproved:false,externalAiApiCalls:0,
      videoSha256:sha(bytes),output:video,
      realListeningP5P6Required:true,
    };
    await fs.writeFile(path.join(out,"p4-report.json"),JSON.stringify(report,null,2)+"\n");
    return report;
  }finally{
    await fs.rm(temp,{recursive:true,force:true});
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const key=process.argv[2],args=process.argv.slice(3);
  const lang=args.find(x=>x.startsWith("--language="));
  const plat=args.find(x=>x.startsWith("--platform="));
  if(!key||args.some(x=>!x.startsWith("--language=")&&!x.startsWith("--platform="))||
     args.filter(x=>x.startsWith("--language=")).length>1||
     args.filter(x=>x.startsWith("--platform=")).length>1){
    console.error("Usage: HSK_AI_SOUND_DESIGN_TEST=1 node scripts/codex-soundkit-render-test.mjs <id> --language=ru|tg --platform=instagram|youtube|facebook|tiktok");
    process.exitCode=2;
  }else{
    renderSoundKitTest(key,{
      language:lang?.slice("--language=".length)??activeLanguage(),
      platform:plat?.slice("--platform=".length)??"instagram",
    }).then(result=>console.log(JSON.stringify(result,null,2)))
      .catch(e=>{console.error("SoundKit P4 BLOCKED: "+e.message);process.exitCode=1});
  }
}
