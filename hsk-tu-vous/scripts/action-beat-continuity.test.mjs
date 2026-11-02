import test from "node:test";
import assert from "node:assert/strict";
import {resolveActionBeatLayers as layers} from "./action-beat-continuity.mjs";

const beats = [{id:"cup",localFrame:0},{id:"choice",localFrame:40},{id:"meaning",localFrame:95}];

test("first beat and pre-cue footage are unchanged", () => {
  for (const frame of [-1,0,18,39]) {
    const result=layers(beats,frame,8);
    assert.equal(result.active.id,"cup");
    assert.equal(result.incoming.opacity,1);
    assert.equal(result.outgoing,null);
    assert.equal(result.incoming.localFrame,Math.max(0,frame));
  }
});

test("incoming action begins on exact cue, never earlier; outgoing holds its last pose",()=>{
  const before=layers(beats,39,8);
  assert.equal(before.incoming.beat.id,"cup");
  const exact=layers(beats,40,8);
  assert.equal(exact.active.id,"choice");
  assert.equal(exact.incoming.localFrame,0);
  assert.ok(exact.incoming.opacity>0&&exact.incoming.opacity<1);
  assert.equal(exact.outgoing.beat.id,"cup");
  assert.equal(exact.outgoing.localFrame,39);
  for(let frame=40;frame<48;frame++){
    const current=layers(beats,frame,8);
    assert.ok(current.incoming.opacity>=0&&current.incoming.opacity<=1);
    assert.ok(Math.abs(current.incoming.opacity+current.outgoing.opacity-1)<1e-10);
    assert.equal(current.outgoing.localFrame,39);
  }
  const settled=layers(beats,48,8);
  assert.equal(settled.outgoing,null);
  assert.equal(settled.incoming.opacity,1);
});

test("seek-independent deterministic frame snapshots and new cue",()=>{
  const a=layers(beats,44,8);
  layers(beats,97,8);
  assert.deepEqual(layers(beats,44,8),a);
  assert.equal(layers(beats,95,8).outgoing.beat.id,"choice");
  assert.equal(layers(beats,95,8).outgoing.localFrame,54);
});

test("zero-window retains original immediate switch",()=>{
  const r=layers(beats,40,0);
  assert.equal(r.incoming.opacity,1);
  assert.equal(r.outgoing,null);
});

test("reject invalid/ambiguous cue plans and invalid frame windows",()=>{
  assert.throws(()=>layers([],0),/nonempty/);
  assert.throws(()=>layers([{localFrame:0},{localFrame:0}],2),/strictly increasing/);
  assert.throws(()=>layers([{localFrame:2},{localFrame:1}],2),/strictly increasing/);
  assert.throws(()=>layers([{localFrame:1.5}],2),/strictly increasing/);
  assert.throws(()=>layers(beats,Infinity),/finite/);
  assert.throws(()=>layers(beats,20,-1),/0\.\.120/);
  assert.throws(()=>layers(beats,20,3.5),/0\.\.120/);
});

test("no input mutation",()=>{
  const original=JSON.stringify(beats);
  layers(beats,44,8);
  assert.equal(JSON.stringify(beats),original);
});
