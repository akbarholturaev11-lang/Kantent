import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {createHash} from "node:crypto";
import {spawnSync} from "node:child_process";
import {reviewExistingVideo} from "./cue-frame-review.mjs";
import {cueTimelineSource} from "./cue-timeline.mjs";
import {episodeContentHash} from "./lib.mjs";

function run(bin,args){
  const p=spawnSync(bin,args,{encoding:"utf8"});
  if(p.error||p.status!==0)throw Error(bin+" failed: "+(p.stderr||p.error));
}
async function readPngSize(file) {
  const bytes=await fs.readFile(file);
  assert.equal(bytes.subarray(0,8).toString("hex"),"89504e470d0a1a0a");
  return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
}

test("real ffmpeg contact sheet uses exact encoded frame index and never approves itself",async(t)=>{
  const folder=await fs.mkdtemp(path.join(os.tmpdir(),"hsk-cue-frame-proof-"));
  t.after(async()=>fs.rm(folder,{recursive:true,force:true}));
  const video=path.join(folder,"synthetic.mp4");
  run("ffmpeg",["-hide_banner","-loglevel","error","-y","-f","lavfi","-i",
    "testsrc2=size=1080x1920:rate=30:duration=3",
    "-frames:v","90","-c:v","libx264","-preset","ultrafast",
    "-pix_fmt","yuv420p",video]);
  const episode={
    id:"test-only-synthetic",languageCode:"ru-RU",voiceTextHash:"FAKE-NO-API",
    audioSha256:"a".repeat(64),captionSource:"gemini-word-timestamps",
    scenes:[
      {id:"hook",kind:"example",narration:"Книга",startMs:0,endMs:2000,
        durationFrames:60,motionBeats:[{id:"book",kind:"graphic",cueText:"Книга"}]},
      {id:"cta",kind:"cta",narration:"HSK AI",startMs:2000,endMs:3000,durationFrames:30},
    ],
    captions:[{text:"Книга",startMs:400,endMs:700},{text:"HSK",startMs:2200,endMs:2400},
      {text:"AI",startMs:2450,endMs:2750}],
  };
  const timeline={
    schemaVersion:1,episodeId:episode.id,languageCode:episode.languageCode,
    fps:30,voiceTextHash:episode.voiceTextHash,audioSha256:episode.audioSha256,
    wordCues:structuredClone(episode.captions),cueSource:cueTimelineSource(episode),
    scenes:[
      {sceneId:"hook",motionBeats:[{
        id:"book",kind:"graphic",cueText:"Книга",startMs:400,endMs:700,
        startFrame:12,localFrame:12,
        visual:{graphic:{tracks:[{nodeId:"book",property:"x",keyframes:[
          {atMs:0,value:-20},{atMs:500,value:0}]}]}}
      }]},
      {sceneId:"cta",motionBeats:[]}
    ],
  };
  const sha=createHash("sha256").update(await fs.readFile(video)).digest("hex");
  const status={
    stage:"rendered-pending-owner-approval",
    contentHash:episodeContentHash(episode),
    platformPackages:{instagram:{videoSha256:sha}},
  };
  for(const [file,value] of [["episode.json",episode],["cue-timeline.json",timeline],["status.json",status]])
    await fs.writeFile(path.join(folder,file),JSON.stringify(value));
  const output=path.join(folder,"new-review-only");
  const evidence=await reviewExistingVideo({
    episodeFile:path.join(folder,"episode.json"),timelineFile:path.join(folder,"cue-timeline.json"),
    statusFile:path.join(folder,"status.json"),videoFile:video,outputDir:output,
  });
  assert.equal(evidence.samples.length,1);
  assert.equal(evidence.verdict,"FRAME_SAMPLES_GENERATED_NOT_VISUALLY_APPROVED");
  assert.equal(evidence.ownerPreviewApproved,false);
  assert.deepEqual(await readPngSize(path.join(output,"hook-book-cue-full.png")),[1080,1920]);
  assert.deepEqual(await readPngSize(path.join(output,"hook-book-cue-phone.png")),[270,480]);
  const html=await fs.readFile(path.join(output,"index.html"),"utf8");
  assert.match(html,/Frame evidence ONLY/);
  assert.match(html,/NOT QA approval/);
  // Identical review output paths are immutable by default.
  await assert.rejects(reviewExistingVideo({
    episodeFile:path.join(folder,"episode.json"),timelineFile:path.join(folder,"cue-timeline.json"),
    statusFile:path.join(folder,"status.json"),videoFile:video,outputDir:output,
  }),/EEXIST/);
  // Stale/substituted video bytes cannot pass the stored package hash.
  status.platformPackages.instagram.videoSha256="b".repeat(64);
  await fs.writeFile(path.join(folder,"status.json"),JSON.stringify(status));
  await assert.rejects(reviewExistingVideo({
    episodeFile:path.join(folder,"episode.json"),timelineFile:path.join(folder,"cue-timeline.json"),
    statusFile:path.join(folder,"status.json"),videoFile:video,outputDir:path.join(folder,"wrong-hash"),
  }),/SHA-256/);
});
