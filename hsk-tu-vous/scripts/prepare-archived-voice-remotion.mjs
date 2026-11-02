/**
 * Restore immutable Oct 30 RU/TJ single-take Gemini Kore voice to canonical
 * Remotion HSKAI-Episode — REVIEW ONLY. Never invent word timings.
 *
 * Inputs from separately archived GitHub Actions original voice and earlier
 * low-RMS scene review. No TTS, transcription, network or source mutations.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";

const CONFIG={
 ru:{code:"ru-RU",folder:"2026-10-31T08-07-45-724Z",sub:"",wave:"562c368a0dd5800f11da724a54480797631ed141625bcabba248111184cc652c",text:"75d2bad12fc1c5347ea097cb0d772c0abd1d4390178078ddc0987bace022ef59",profile:"content/voice-profile.json"},
 tg:{code:"tg-TJ",folder:"2026-10-31T08-07-45-540Z",sub:"tg/",wave:"df7d2073f37d0c4bbd23f6542ac99cf9368823196f54a47104d29ce71bb80c23",text:"4bbb1e7ff18c262004f8a454c0efa804dd67780dffda478ad3ef18ac37335842",profile:"content/locales/tg/voice-profile.json"}
};
const sha256=v=>crypto.createHash("sha256").update(v).digest("hex");
const readJson=file=>JSON.parse(fs.readFileSync(file,"utf8"));
export const verifyWavBytes=(wav)=>{
 if(!Buffer.isBuffer(wav)||wav.toString("ascii",0,4)!=="RIFF"||wav.toString("ascii",8,12)!=="WAVE")
   throw Error("Archived voice: invalid RIFF WAV");
 let offset=12,channels=0,rate=0,bits=0,pcm=0,dataBytes=0;
 while(offset+8<=wav.length){
  const type=wav.toString("ascii",offset,offset+4),bytes=wav.readUInt32LE(offset+4);
  if(offset+8+bytes>wav.length)throw Error("Archived voice: incomplete RIFF chunk");
  if(type==="fmt "){
    if(bytes<16)throw Error("Archived voice: invalid WAV fmt");
    pcm=wav.readUInt16LE(offset+8);channels=wav.readUInt16LE(offset+10);
    rate=wav.readUInt32LE(offset+12);bits=wav.readUInt16LE(offset+22);
  }
  if(type==="data")dataBytes+=bytes;
  offset+=8+bytes+(bytes%2);
 }
 if(pcm!==1||channels!==1||rate!==24000||bits!==16||!dataBytes)
   throw Error("Archived voice: expected original mono PCM16 24000Hz");
 return {durationSec:dataBytes/(rate*channels*bits/8),rate,channels,bits};
};
export function prepareArchivedVoicePreview(root,language,archiveRoot,baselineEvidence,output){
 const conf=CONFIG[language];
 if(!conf)throw Error("Archived voice: only ru or tg accepted");
 const folder=path.join(archiveRoot,"youdianr-vs-yidianr-price-20261030",conf.sub);
 const episode=readJson(path.join(folder,"episode.json"));
 const bundle=path.join(folder,"gemini-production",conf.folder);
 const source=fs.readFileSync(path.join(bundle,"voice.wav"));
 if(sha256(source)!==conf.wave)throw Error("Archived voice: source WAV hash mismatch");
 const wav=verifyWavBytes(source);
 const profile=readJson(path.join(root,conf.profile));
 if(profile.status!=="approved"||profile.locale!==conf.code||profile.voiceName!=="Kore"||
    episode.voiceProfileId!==profile.profileId||episode.languageCode!==conf.code)
   throw Error("Archived voice: approved profile mismatch");
 const narration=episode.scenes.map(s=>s.narration.trim().replace(/\s+/g," ")).join(" ");
 if(sha256(Buffer.from(narration,"utf8"))!==conf.text)
   throw Error("Archived voice: original script SHA-256 mismatch");
 const meta=readJson(path.join(bundle,"metadata.json"));
 if(meta.ttsGenerationMode!=="continuous-pilot"||![1,2].includes(meta.ttsRequestCount))
   throw Error("Archived voice: generation must be original one-take");
 if(episode.captionSource!=="pending-gemini-generation"||episode.captions.length)
   throw Error("Archived voice: unexpected nonempty or asserted captions");
 const baseline=readJson(baselineEvidence);
 if(baseline.language!==language||baseline.sourceAudioSha256!==conf.wave||
    baseline.sourceNarrationSha256!==conf.text||
    baseline.verifiedWordTimestamps!==false||
    baseline.audioRegenerationCalls!==0)
   throw Error("Archived voice: scene-boundary evidence mismatched");
 const frames=baseline.sceneFrameCounts;
 if(!Array.isArray(frames)||frames.length!==episode.scenes.length||
    frames.some(n=>!Number.isInteger(n)||n<30)||
    Math.abs(frames.reduce((a,b)=>a+b,0)-wav.durationSec*30)>1.1)
   throw Error("Archived voice: scene-frame totals contradict PCM duration");
 const mediaName="review-only/20261030-"+language+"-archived-kore.wav";
 const mediaPath=path.join(root,"public",mediaName);
 fs.mkdirSync(path.dirname(mediaPath),{recursive:true});
 fs.writeFileSync(mediaPath,source);
 const seconds=1000/30;let cursor=0;
 const scenes=episode.scenes.map((scene,i)=>{
  const from=cursor;cursor+=frames[i];
  // Read-only review intentionally disables cue-driven animation because ASR
  // failed. Preserve canonical authored storyboard and genuine CTA artwork;
  // never synthesize future word times or claim synchronized subtitles.
  const {motionBeats,motionDirection,semanticShot,...original}=scene;
  return {...original,durationFrames:frames[i],startMs:from*seconds,endMs:cursor*seconds};
 });
 const reviewEpisode={
  ...episode,
  scenes,
  id:"archived-20261030-"+language+"-canonical-remotion-review",
  audioSrc:mediaName,
  audioDurationMs:Math.round(wav.durationSec*1000),
  motionDesign:false,
  motionDesignStyle:undefined, // archived source failed ASR; do not assert an action-word lesson
  captions:[],
  captionSource:"asr-rejected-review-only"
 };
 const report={
  status:"REVIEW_ONLY_NOT_FOR_PUBLICATION",
  renderer:"canonical-remotion-HSKAI-Episode",
  archivedEpisodeId:episode.id,
  archiveDate:"2026-10-31",
  language:conf.code,sourceWavSha256:conf.wave,sourceNarrationSha256:conf.text,
  sourceDurationSec:Number(wav.durationSec.toFixed(4)),
  approvedVoiceProfile:profile.profileId,
  reusedExistingAudio:true,ttsApiCalls:0,originalSourceModified:false,
  cameraStoryboard:"original-authored-storyboards",
  sceneFrameCounts:frames,sceneTimings:"previously measured RMS-estimated scene boundaries",
  verifiedWordCueCount:0,captionRendering:"disabled-until-authentic-transcription",
  autoPublicationAuthorized:false,ownerApprovedFinalVideo:false,
  integrity:"source WAV and narration SHA-256 match Oct 31 archive",
  constraints:"Scene timing is estimated. No real word-level synchronization or approved production export."
 };
 fs.mkdirSync(output,{recursive:true});
 fs.writeFileSync(path.join(output,language+"-props.json"),JSON.stringify({episode:reviewEpisode},null,2));
 fs.writeFileSync(path.join(output,language+"-evidence.json"),JSON.stringify(report,null,2));
 return report;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const [root,lang,archive,baseline,out]=process.argv.slice(2);
 if(!root||!lang||!archive||!baseline||!out)
  throw Error("Usage: node scripts/prepare-archived-voice-remotion.mjs <project-root> <ru|tg> <archive> <baseline-json> <out>");
 console.log(JSON.stringify(prepareArchivedVoicePreview(root,lang,archive,baseline,out)));
}
