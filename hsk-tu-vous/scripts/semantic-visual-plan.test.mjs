import test from "node:test";
import assert from "node:assert/strict";
import { compileSemanticVisualTimeline, validateSemanticVisualEpisode } from "./semantic-visual-plan.mjs";

const lesson=()=>({
  id:"lai-qu-semantic-test",captionSource:"gemini-word-timestamps",voiceTextHash:"test-voice-hash",
  semanticVisual:{schemaVersion:1,mode:"review-only"},
  scenes:[
    {id:"direction",kind:"example",startMs:0,endMs:4100,
     semanticShot:{environmentId:"street",shotType:"medium",cameraStyle:"static",actorIds:["traveler"],objectIds:[]},
     visualBeats:[
      {hero:"来",syncCueText:"приходит",semanticAction:{type:"approach-camera",subjectId:"traveler",durationMs:500}},
      {hero:"去",syncCueText:"уходит",semanticAction:{type:"move-away",subjectId:"traveler",durationMs:600}}
     ]},
    {id:"cta",kind:"cta",startMs:4100,endMs:5100,visualBeats:[{hero:"HSK AI"}]}
  ],
  captions:[
    {text:"человек",startMs:100,endMs:450},
    {text:"приходит",startMs:1000,endMs:1450},
    {text:"потом",startMs:1600,endMs:1900},
    {text:"уходит",startMs:2500,endMs:2850},
    {text:"дальше",startMs:3100,endMs:3400},
    {text:"HSK",startMs:4300,endMs:4500}
  ]
});
test("come and go action motion begins on spoken cue, no beat-entry lead",()=>{
 const t=compileSemanticVisualTimeline(lesson());
 assert.equal(t.scenes.length,1);
 assert.deepEqual(t.scenes[0].actions.map(a=>[a.action,a.startMs,a.startFrame]),
  [["approach-camera",1000,30],["move-away",2500,75]]);
 assert.equal(t.scenes[0].actions[0].endFrame,45);
 assert.equal(t.rendererReady,false);
});
test("legacy episodes remain untouched and require no semantic metadata",()=>{
 const e=lesson(); delete e.semanticVisual;delete e.scenes[0].semanticShot;
 e.scenes[0].visualBeats=e.scenes[0].visualBeats.map(({hero})=>({hero}));
 assert.deepEqual(validateSemanticVisualEpisode(e),[]);
 assert.throws(()=>compileSemanticVisualTimeline(e),/not opted in/);
});
test("silent semantic opt-in without episode marker is rejected",()=>{
 const e=lesson();delete e.semanticVisual;
 assert.match(validateSemanticVisualEpisode(e).join(" "),/opt-in/);
});
test("unrecognized action and missing subject are rejected",()=>{
 const e=lesson();e.scenes[0].visualBeats[0].semanticAction={type:"teleport",subjectId:"other"};
 assert.match(validateSemanticVisualEpisode(e).join(" "),/unsupported semantic action/);
 assert.match(validateSemanticVisualEpisode(e).join(" "),/subjectId/);
});
test("unmatched spoken cue fails rather than falling back to proportional timing",()=>{
 const e=lesson();e.scenes[0].visualBeats[0].syncCueText="я";
 assert.throws(()=>compileSemanticVisualTimeline(e),/spoken cue not found/);
});
test("repeated spoken word requires explicit occurrence; supports selected second occurrence",()=>{
 const e=lesson();e.captions[2].text="приходит";
 assert.throws(()=>compileSemanticVisualTimeline(e),/ambiguous cue/);
 e.scenes[0].visualBeats[0].syncCueOccurrence=2;
 e.scenes[0].visualBeats[0].semanticAction.durationMs=1100;
 assert.throws(()=>compileSemanticVisualTimeline(e),/overlapping or out-of-order/);
 e.scenes[0].visualBeats[0].semanticAction.durationMs=160;
 // Second occurrence at 1600, ends before outgoing action at 2500.
 const t=compileSemanticVisualTimeline(e);
 assert.equal(t.scenes[0].actions[0].startMs,1600);
});
test("word-level captions must remain in imported scene boundary",()=>{
 const e=lesson();e.captions[0].startMs=-100;
 assert.throws(()=>compileSemanticVisualTimeline(e),/cue crosses scene boundary/);
});
test("semantic action may not continue past end of scene",()=>{
 const e=lesson();e.scenes[0].visualBeats[1].semanticAction.durationMs=2200;
 assert.throws(()=>compileSemanticVisualTimeline(e),/overruns scene/);
});
test("semantics are prohibited in central CTA",()=>{
 const e=lesson();e.scenes[1].semanticShot={environmentId:"home",shotType:"medium",cameraStyle:"static"};
 assert.match(validateSemanticVisualEpisode(e).join(" "),/forbidden in CTA/);
});
test("selected motion word requires its own timestamp, not a multiword caption",()=>{
 const e=lesson(); e.captions[1].text="он приходит";
 assert.throws(()=>compileSemanticVisualTimeline(e),/selected cue is inside a multiword caption/);
});
test("irrelevant grouped captions do not invalidate exact action cues",()=>{
 const e=lesson(); e.captions[0].text="один человек";
 assert.equal(compileSemanticVisualTimeline(e).scenes[0].actions[0].startMs,1000);
});
test("cue frame always starts on or after fractional millisecond offset",()=>{
 const e=lesson(); e.captions[1].startMs=1010;
 const t=compileSemanticVisualTimeline(e);
 assert.equal(t.scenes[0].actions[0].startFrame,31);
 assert.ok(t.scenes[0].actions[0].startFrame*1000/30 >= 1010);
});
test("visual-only metadata changes timeline fingerprint but not voice fingerprint",()=>{
 const a=lesson(),b=lesson();b.scenes[0].semanticShot.cameraStyle="follow";
 const x=compileSemanticVisualTimeline(a),y=compileSemanticVisualTimeline(b);
 assert.notEqual(x.sourceFingerprint,y.sourceFingerprint);
 assert.equal(x.timingFingerprint,y.timingFingerprint);
});
test("episode with no actors is supported for object-centric teaching",()=>{
 const e=lesson();e.scenes[0].semanticShot.actorIds=[];
 e.scenes[0].semanticShot.objectIds=["moving-cup"];
 for(const b of e.scenes[0].visualBeats)b.semanticAction.subjectId="moving-cup";
 assert.equal(validateSemanticVisualEpisode(e).length,0);
});
