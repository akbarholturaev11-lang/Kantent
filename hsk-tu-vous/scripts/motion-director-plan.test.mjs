import test from "node:test";
import assert from "node:assert/strict";
import {compileMotionDirectorScene as compile,resolveDirectorCamera as camera,resolvePersistentRootPose} from "./motion-director-plan.mjs";
import {resolveMotionBeats} from "./motion-design-plan.mjs";

const scene={
  id:"cafe",kind:"example",startMs:0,endMs:4000,
  motionBeats:[
    {id:"two",kind:"quantity",cueText:"Две",visual:{object:"tea-cup",count:2}},
    {id:"three",kind:"quantity",cueText:"три",visual:{object:"tea-cup",count:3}}
  ],
  motionDirection:{schemaVersion:1,shots:[
    {shotId:"first",beatId:"two",meaningCue:"Две",assetIds:["object:tea-cup"],
      camera:{xPx:0,yPx:0,scale:1},transition:{kind:"cut",frames:0},focalRole:"object",zIndex:0},
    {shotId:"second",beatId:"three",meaningCue:"три",assetIds:["object:tea-cup"],
      camera:{xPx:32,yPx:-12,scale:1.06},transition:{kind:"crossfade",frames:8},
      focalRole:"action",zIndex:1}
  ]}
};
const captions=[
  {text:"Две",startMs:900,endMs:1100},
  {text:"чашки",startMs:1100,endMs:1400},
  {text:"три",startMs:2200,endMs:2450}
];
const resolved=resolveMotionBeats(scene,captions);
const work=(edit)=>{const copy=structuredClone(scene);edit(copy);return compile(copy,resolved);};

test("opt-in only, exact cue times and frame-local director trace",()=>{
  assert.equal(compile({...scene,motionDirection:undefined},resolved),null);
  const result=compile(scene,resolved);
  assert.equal(result.timingSource,"verified-word-cues");
  assert.deepEqual(result.shots.map(s=>s.cueFrame),[27,66]);
  assert.deepEqual(result.shots.map(s=>s.cueStartMs),[900,2200]);
  assert.deepEqual(result.shots[1].persistentElementIds,[]);
  assert.equal(result.shots[0].cueOccurrence,null);
});

test("camera only moves on the real second cue and seek order is irrelevant",()=>{
  const t=compile(scene,resolved);
  assert.deepEqual(camera(t,65),{xPx:0,yPx:0,scale:1});
  const onset=camera(t,66);
  assert.ok(onset.xPx>0&&onset.xPx<32);
  assert.deepEqual(camera(t,73),{xPx:32,yPx:-12,scale:1.06});
  camera(t,90);
  assert.deepEqual(camera(t,69),camera(t,69));
  assert.deepEqual(camera(null,69),{xPx:0,yPx:0,scale:1});
  assert.throws(()=>camera(t,NaN),/finite/);
});

test("reject hallucinated assets, conflicting persistence, and wrong voices",()=>{
  assert.throws(()=>work(s=>s.motionDirection.shots[1].assetIds=["object:book"]),/unknown/);
  assert.throws(()=>work(s=>s.motionDirection.shots[1].meaningCue="coffee"),/exact verified meaning cue/);
  assert.throws(()=>work(s=>s.motionDirection.shots[1].beatId="two"),/original beat ID/);
  assert.throws(()=>work(s=>s.motionDirection.shots[1].cueOccurrence=2),/matching occurrence/);
  assert.throws(()=>work(s=>s.motionDirection.shots[1].persistentElementIds=["object:book"]),/persistent/);
  assert.throws(()=>work(s=>s.motionDirection.shots[1].persistentElementIds=["object:tea-cup"]),/supports only same authored SVG root/);
  assert.throws(()=>work(s=>s.motionDirection.shots[1].assetIds=["object:tea-cup","object:tea-cup"]),/distinct/);
});

test("reject unsupported transition, cue timing inversion and unsafe framing",()=>{
  assert.throws(()=>work(s=>s.motionDirection.shots[1].transition.frames=99),/invalid duration/);
  assert.throws(()=>work(s=>s.motionDirection.shots[0].transition={kind:"crossfade",frames:8}),/invalid duration/);
  assert.equal(work(s=>s.motionDirection.shots[1].transition={kind:"cut",frames:0}).shots[1].transition.kind,"cut");
  assert.throws(()=>work(s=>s.motionDirection.shots[1].camera.scale=1.4),/bounded safe-stage/);
  assert.throws(()=>work(s=>s.motionDirection.shots[1].camera.xPx=100),/bounded safe-stage/);
  assert.throws(()=>work(s=>s.motionDirection.shots[1].zIndex=8),/focal role/);
  assert.throws(()=>work(s=>s.motionDirection.shots.reverse()),/original beat ID/);
  assert.throws(()=>work(s=>s.motionDirection.shots[1].hack="surprise"),/unknown fields/);
  assert.throws(()=>work(s=>s.kind="cta"),/CTA/);
});

test("unknown/reused graphic group identity cannot masquerade as same object",()=>{
  const graphic=fill=>({nodes:[
    {id:"cup-group",type:"g",attrs:{}},
    {id:"cup-body",parentId:"cup-group",type:"rect",attrs:{x:80,y:80,width:100,height:100,fill}},
  ]});
  const from=structuredClone(scene);
  from.motionBeats=[
    {id:"two",kind:"graphic",cueText:"Две",visual:{graphic:graphic("teal")}},
    {id:"three",kind:"graphic",cueText:"три",visual:{graphic:graphic("red")}}
  ];
  for(const s of from.motionDirection.shots){
    s.assetIds=["node:cup-group"];s.persistentElementIds=s.shotId==="second"?["node:cup-group"]:[];
  }
  const graphicBeats=resolveMotionBeats(from,captions);
  assert.throws(()=>compile(from,graphicBeats),/identical drawable geometry/);
  from.motionBeats[1].visual.graphic=graphic("teal");
  assert.equal(compile(from,graphicBeats).shots[1].persistentElementIds[0],"node:cup-group");
  assert.deepEqual(resolvePersistentRootPose(from.motionBeats[0].visual.graphic,from.motionBeats[1].visual.graphic,"cup-group",39,3,8),{x:0,y:0,scale:1,rotate:0,opacity:1});
});

test("inputs untouched and metadata without direction remains valid",()=>{
  const original=JSON.stringify(scene),raw=JSON.stringify(resolved);
  compile(scene,resolved);
  assert.equal(JSON.stringify(scene),original);
  assert.equal(JSON.stringify(resolved),raw);
  assert.equal(compile({id:"legacy"},[]),null);
});

test("persistent SVG root poses move without frame-order dependency",()=>{
  const svg=x=>({nodes:[{id:"book",type:"g",x,attrs:{}},
    {id:"cover",type:"rect",parentId:"book",attrs:{x:50,y:50,width:70,height:80,fill:"teal"}}],tracks:[]});
  const a=resolvePersistentRootPose(svg(-40),svg(40),"book",40,3,8);
  assert.equal(a.x,0);
  assert.deepEqual(a,resolvePersistentRootPose(svg(-40),svg(40),"book",40,3,8));
  assert.equal(resolvePersistentRootPose(svg(-40),svg(40),"book",40,7,8).x,40);
  assert.throws(()=>resolvePersistentRootPose(svg(-40),svg(40),"absent",40,3,8),/matching geometry/);
});
