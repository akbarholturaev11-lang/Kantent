import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as z from "zod/v4";
import {validateGraphicScene,graphicNodeState,graphicFingerprint} from "./graphic-scene.mjs";
import {graphicSceneSchema} from "./graphic-scene-schema.mjs";
import {validateActionLesson} from "./action-design-plan.mjs";
import {compileMotionDesignTimeline} from "./motion-design-plan.mjs";
const example=JSON.parse(fs.readFileSync(new URL("../content/visual-examples/swimming-and-gate.json",import.meta.url)));
const policy=JSON.parse(fs.readFileSync(new URL("../content/visual-system.json",import.meta.url))).lessonPresentation;
const [swim,gate]=example.states.map(state=>state.graphic);
const beat=(id,graphic,cueText)=>({id,kind:"graphic",cueText,explains:"Show the real narrated action",visual:{title:id,hanzi:"",pinyin:"",meaning:"",graphic}});
const scene={id:"lesson",kind:"example",startMs:0,endMs:8000,motionBeats:[beat("skill",swim,"умею"),beat("closed",gate,"закрыт")]};
const episode={id:"technical-test",date:"2026-10-28",motionDesign:true,motionDesignStyle:"explain-actions-v1",captionSource:"gemini-word-timestamps",captions:[{text:"умею",startMs:100,endMs:500},{text:"закрыт",startMs:4000,endMs:4500}],scenes:[scene]};

test("new swimming/gate drawings are data and their movement is deterministic at arbitrary frames",()=>{
  for(const graphic of [swim,gate])assert.doesNotThrow(()=>validateGraphicScene(graphic));
  const arm=swim.nodes.find(node=>node.id==="arm");
  const first=graphicNodeState(swim,arm,0);
  assert.notDeepEqual(graphicNodeState(swim,arm,500),first);
  assert.deepEqual(graphicNodeState(swim,arm,1100),first);
  assert.deepEqual(graphicNodeState(swim,arm,500),graphicNodeState(swim,arm,500));
  assert.doesNotThrow(()=>validateActionLesson(episode,{requireVisibleChange:true}));
});
test("MCP JSON schema advertises new shapes and does not drop the drawing payload",()=>{
  assert.deepEqual(graphicSceneSchema.parse(swim),swim);
  const schema=z.toJSONSchema(graphicSceneSchema);
  assert.ok(JSON.stringify(schema).includes("keyframes"));
  assert.ok(JSON.stringify(schema).includes("polygon"));
  assert.throws(()=>graphicSceneSchema.parse({...swim,externalUrl:"https://example.org"}));
});
test("text, executable/remote nodes, invalid geometry, cycles and hidden drawings are rejected",()=>{
  const change=patch=>({...swim,nodes:[...swim.nodes,{id:"new-node",type:"circle",attrs:{r:20,fill:"gold"},...patch}]});
  for(const patch of [{type:"text"},{type:"image",attrs:{href:"https://example.org"}},{attrs:{r:20,onload:"evil"}},
    {parentId:"new-node"},{attrs:{r:0,fill:"gold"}},{type:"path",attrs:{d:"M0 0",fill:"gold"}},
    {type:"polyline",attrs:{points:" ",stroke:"gold"}}])assert.throws(()=>validateGraphicScene(change(patch)));
  assert.throws(()=>validateGraphicScene({width:400,height:400,nodes:[{id:"hidden",type:"circle",opacity:0,attrs:{r:20,fill:"gold"}}],tracks:[]}),/hidden/);
  const flashing=structuredClone(swim);flashing.tracks[0]={nodeId:"swimmer",property:"opacity",loop:true,keyframes:[{atMs:0,value:1},{atMs:400,value:0},{atMs:800,value:1}]};
  assert.throws(()=>validateGraphicScene(flashing),/non-flashing/);
});
test("changing subtitles/metadata or renaming drawing IDs cannot fake visible variety",()=>{
  const renamed=structuredClone(swim);
  for(const node of renamed.nodes){node.id="new-"+node.id;if(node.parentId)node.parentId="new-"+node.parentId;}
  for(const track of renamed.tracks)track.nodeId="new-"+track.nodeId;
  assert.deepEqual(graphicFingerprint(renamed),graphicFingerprint(swim));
  renamed.tracks.reverse();
  assert.deepEqual(graphicFingerprint(renamed),graphicFingerprint(swim));
  const hiddenChange={scenes:[{...scene,motionBeats:[beat("one",swim,"умею"),beat("two",renamed,"закрыт")]}]};
  assert.throws(()=>validateActionLesson(hiddenChange,{requireVisibleChange:true}),/no visible state change/);
});
test("actual word anchors start new drawings and long unchanged holds fail before render",()=>{
  const timeline=compileMotionDesignTimeline(episode,policy);
  assert.deepEqual(timeline.scenes[0].beats.map(beat=>beat.startFrame),[3,120]);
  assert.equal(timeline.scenes[0].visualHold.longestHoldMs,4000);
  const late=structuredClone(episode);late.captions[1].startMs=7000;late.captions[1].endMs=7400;
  assert.throws(()=>compileMotionDesignTimeline(late,policy),/unchanged visual holds/);
  const missing=structuredClone(episode);missing.captions[1].text="другое";
  assert.throws(()=>compileMotionDesignTimeline(missing,policy),/missing\/ambiguous/);
  const metadata=structuredClone(episode);
  metadata.scenes[0].motionBeats.splice(1,0,{...beat("same-scene",swim,"тоже"),visual:{...beat("same-scene",swim,"тоже").visual,title:"Different planning title"}});
  metadata.captions.splice(1,0,{text:"тоже",startMs:1000,endMs:1200});
  metadata.captions[2].startMs=7000;metadata.captions[2].endMs=7400;
  assert.throws(()=>compileMotionDesignTimeline(metadata,policy),/unchanged visual holds 7.00s/);
});
