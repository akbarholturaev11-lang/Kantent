import test from "node:test";
import assert from "node:assert/strict";
import {resolveMotionTransition as visual,validateMotionTransition as validate} from "./motion-transition-plan.mjs";
const transition=(kind,frames=12,direction)=>({kind,frames,...(direction?{direction}:{})});

test("cut and crossfade preserve exact old duration and no compositional effects",()=>{
  const cut=visual({kind:"cut",frames:0},0);
  assert.equal(cut.incoming.opacity,1);
  assert.equal(cut.outgoing.opacity,0);
  for(let i=0;i<12;i++){
    const s=visual(transition("crossfade"),i);
    assert.ok(s.progress>0&&s.progress<=1);
    assert.ok(Math.abs(s.incoming.opacity+s.outgoing.opacity-1)<1e-9);
    assert.equal(s.incoming.clipPath,"none");
    assert.equal(s.outgoing.filter,"none");
  }
  assert.equal(visual(transition("crossfade"),11).incoming.opacity,1);
});

test("semantic slide uses small bounded lateral motion, seek independently",()=>{
  const a=visual(transition("slide-match",12,"left"),0);
  const b=visual(transition("slide-match",12,"left"),5);
  const end=visual(transition("slide-match",12,"left"),11);
  assert.match(a.incoming.transform,/translateX\(/);
  assert.ok(a.incoming.opacity>0&&a.incoming.opacity<1);
  assert.equal(end.incoming.transform,"translateX(0px)");
  assert.equal(end.outgoing.opacity,0);
  assert.deepEqual(b,visual(transition("slide-match",12,"left"),5));
  assert.notDeepEqual(visual(transition("slide-match",12,"right"),5),b);
});

test("masked reveal retains outgoing image behind incoming and settles without wipe outside bounds",()=>{
  const m=transition("masked-reveal",12,"right");
  const a=visual(m,0);
  const b=visual(m,5);
  const end=visual(m,11);
  assert.equal(a.outgoing.opacity,1);
  assert.equal(a.incoming.opacity,1);
  assert.match(a.incoming.clipPath,/^inset\(0 0 0 /);
  assert.notEqual(b.incoming.clipPath,a.incoming.clipPath);
  assert.equal(end.incoming.clipPath,"inset(0 0 0 0%)");
  assert.equal(visual(transition("masked-reveal",12,"left"),0).incoming.opacity,1);
});

test("subtle focus uses bounded blur on drawings only; not fake temporal motion blur",()=>{
  const a=visual(transition("focus-reveal"),0);
  const b=visual(transition("focus-reveal"),4);
  const end=visual(transition("focus-reveal"),11);
  assert.ok(a.incoming.opacity<b.incoming.opacity);
  assert.match(a.incoming.filter,/^blur\(/);
  assert.equal(end.incoming.filter,"blur(0px)");
  assert.equal(end.incoming.transform,"scale(1)");
});

test("unapproved kinds, unsafe directions and invalid windows fail closed",()=>{
  for(const x of [
    {kind:"glitch",frames:10},{kind:"flash",frames:6},
    {kind:"crossfade",frames:1},{kind:"crossfade",frames:99},
    {kind:"cut",frames:8},{kind:"slide-match",frames:8},
    {kind:"slide-match",frames:8,direction:"up"},
    {kind:"masked-reveal",frames:8,direction:"right",flash:true},
    {kind:"crossfade",frames:8,direction:"left"}
  ])assert.throws(()=>validate(x),/Motion transition/);
  assert.throws(()=>visual(transition("crossfade"),Infinity),/safe bounds/);
  assert.throws(()=>visual(transition("slide-match",12,"left"),4,{slideDistancePx:50}),/safe bounds/);
  assert.throws(()=>visual(transition("focus-reveal"),4,{focusBlurPx:8}),/safe bounds/);
});

test("rendering any frame does not mutate authored transition state",()=>{
 const m=Object.freeze(transition("masked-reveal",12,"left"));
 visual(m,5);visual(m,11);visual(m,0);
 assert.deepEqual(m,transition("masked-reveal",12,"left"));
});
