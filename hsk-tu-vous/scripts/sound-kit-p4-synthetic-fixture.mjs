/** TEST ONLY synthetic audio/Remotion CI fixture. No real Gemini voice, no paid API. */
import fs from "node:fs/promises";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {compileCueTimeline} from "./compile-cue-timeline.mjs";
import {makeSoundKitRenderPlan} from "./sound-kit-render-plan.mjs";
import visualSystem from "../content/visual-system.json" with {type:"json"};
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const PUBLIC=path.join(ROOT,"public");
const output=path.resolve(process.argv[2]??"/tmp/soundkit-p4-fixture");
const voice="generated/soundkit-p4-synthetic-voice.wav";
const stage="soundkit-p4-preview-synthetic-ci";
const sfxHash=p=>createHash("sha256").update(p).digest("hex");
async function run(args){
  const r=spawnSync(args[0],args.slice(1),{cwd:ROOT,encoding:"utf8",timeout:30000});
  if(r.error||r.status!==0)throw Error("Synthetic FFmpeg asset gen failed: "+(r.stderr??r.error?.message));
}
if(process.argv.includes("--clean")){
  await fs.rm(path.join(PUBLIC,voice),{force:true});
  await fs.rm(path.join(PUBLIC,stage),{recursive:true,force:true});
  console.log("Synthetic P4 fixture temporary voice and SFX staging cleaned");
}else{
  await fs.mkdir(path.join(PUBLIC,"generated"),{recursive:true});
  await fs.mkdir(path.join(PUBLIC,stage),{recursive:true});
  await fs.mkdir(output,{recursive:true});
  run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","lavfi","-i",
    "sine=frequency=440:duration=5","-ac","1","-ar","48000",path.join(PUBLIC,voice)]);
  const sfx=path.join(output,"synthetic-effect.wav");
  run(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","lavfi","-i",
    "sine=frequency=1300:duration=0.15","-af","afade=t=in:st=0:d=0.03,afade=t=out:st=0.12:d=0.03",
    "-ac","1","-ar","48000",sfx]);
  const wav=await fs.readFile(sfx),assetSha256=sfxHash(wav);
  await fs.copyFile(sfx,path.join(PUBLIC,stage,assetSha256+".wav"));
  const scenes=[
    {id:"hook",kind:"hook",headline:"Synthetic test",narration:"Это",
      startMs:0,endMs:1200,durationFrames:36},
    {id:"demo",kind:"example",headline:"Spoken cue test",narration:"пример слышно",
      startMs:1200,endMs:3500,durationFrames:69,motionBeats:[
        {id:"show",kind:"meaning",cueText:"пример",visual:{title:"Слово",graphic:{nodes:[]}}},
      ]},
    {id:"cta",kind:"cta",headline:"Not audible SFX",narration:"Скачай",
      startMs:3500,endMs:5000,durationFrames:45},
  ];
  const episode={
    id:"soundkit-p4-synthetic-ci",date:"2026-11-15",languageCode:"ru-RU",
    title:"SYNTHETIC CI — NOT REAL GEMINI",topic:"technical",level:"HSK 1",
    motionDesign:true,motionDesignStyle:"le-context-v1",
    voiceTextHash:sfxHash(scenes.map(s=>s.narration.trim()).join("\n\n")+"\n"),
    audioSha256:sfxHash(await fs.readFile(path.join(PUBLIC,voice))),
    audioDurationMs:5000,audioSrc:voice,captionSource:"gemini-word-timestamps",
    scenes,captions:[
      {text:"Это",startMs:100,endMs:400},
      {text:"пример",startMs:1500,endMs:1900},
      {text:"слышно",startMs:2500,endMs:2800},
      {text:"Скачай",startMs:3750,endMs:4200},
    ],
  };
  const timeline=compileCueTimeline(episode,{fps:30});
  const beat=timeline.scenes[1].motionBeats[0];
  const id="kenney-interface-sounds/select_001.wav";
  const soundKitRenderPlan=makeSoundKitRenderPlan(episode,timeline,{
    mode:"TEST_ONLY",phase:"P3_EXACT_CUE_BINDING",renderEnabled:false,
    audioMixProduced:false,audioSha256:episode.audioSha256,
    voiceTextHash:episode.voiceTextHash,languageCode:episode.languageCode,
    fps:30,cueTimelineSha256:sfxHash(Buffer.from(JSON.stringify(timeline))),
    sourceSha256:"a".repeat(64),librarySha256:"b".repeat(64),policySha256:"c".repeat(64),
    selected:[{sceneId:"demo",eventId:"show",soundId:id,
      assetSha256,role:"gentle-illustration-reveal",
      file:"assets/sound-library/kenney-interface-sounds/select_001.wav",
      startMs:beat.startMs,endCueMs:beat.endMs,
      captionIndex:beat.captionIndex,startFrame:beat.startFrame,
      localFrame:beat.localFrame,clipFrames:5,endFrame:beat.startFrame+5,
      hardDeadlineFrame:105,reason:"SYNTHETIC effect timing only"}],
  },{[id]:stage+"/"+assetSha256+".wav"},visualSystem.sound);
  await fs.writeFile(path.join(output,"baseline.json"),
    JSON.stringify({episode,cueTimeline:timeline},null,2));
  await fs.writeFile(path.join(output,"candidate.json"),
    JSON.stringify({episode,cueTimeline:timeline,soundKitRenderPlan},null,2));
  console.log(JSON.stringify({
    mode:"SYNTHETIC-ONLY",voiceSha256:episode.audioSha256,
    effectAssetSha256:assetSha256,srcUnchanged:true,
    firstEffectFrame:beat.startFrame,output,
  }));
}
