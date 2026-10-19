import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const script=path.join(root,"scripts/prepare-semantic-visual.mjs");
const makeEpisode=id=>({
  id,captionSource:"gemini-word-timestamps",voiceTextHash:"immutable-test-narration",
  semanticVisual:{schemaVersion:1,mode:"review-only"},
  scenes:[{id:"come",kind:"example",startMs:0,endMs:2000,
    semanticShot:{environmentId:"street",shotType:"medium",cameraStyle:"static",actorIds:["learner"]},
    visualBeats:[{hero:"来",syncCueText:"идёт",semanticAction:{type:"approach-camera",subjectId:"learner",durationMs:400}}]}],
  captions:[{text:"идёт",startMs:500,endMs:900}]
});
async function fixture(status) {
 const id="semantic-cli-fixture-"+process.pid;
 const dir=path.join(root,"review",id);
 await fs.mkdir(dir,{recursive:true});
 await fs.writeFile(path.join(dir,"episode.json"),JSON.stringify(makeEpisode(id)));
 await fs.writeFile(path.join(dir,"status.json"),JSON.stringify({stage:status}));
 return {id,dir};
}
test("CLI compiles review-only timeline without creating videos or approvals",async()=>{
 const {id,dir}=await fixture("voice-and-captions-imported");
 try{
  execFileSync(process.execPath,[script,id],{cwd:root,stdio:"pipe"});
  const plan=JSON.parse(await fs.readFile(path.join(dir,"visual-timeline.json"),"utf8"));
  assert.equal(plan.rendererReady,false);
  assert.equal(plan.scenes[0].actions[0].startFrame,15);
  assert.equal(plan.scenes[0].actions[0].action,"approach-camera");
  assert.equal(plan.sourceFingerprint.length,64);
  assert.equal(plan.timingFingerprint.length,64);
  const entries=await fs.readdir(dir);
  assert.equal(entries.includes("video.mp4"),false);
  assert.equal(entries.includes("approval.json"),false);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test("CLI cannot overwrite owner-approved review package",async()=>{
 const {id,dir}=await fixture("owner-approved-for-zernio-publishing");
 try{
  assert.throws(()=>execFileSync(process.execPath,[script,id],{cwd:root,stdio:"pipe"}),/Command failed/);
  const exists=await fs.stat(path.join(dir,"visual-timeline.json")).then(()=>true,()=>false);
  assert.equal(exists,false);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
