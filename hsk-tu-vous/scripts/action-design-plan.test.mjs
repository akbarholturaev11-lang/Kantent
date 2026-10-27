import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {validateActionVisual,validateActionLesson} from "./action-design-plan.mjs";
import {compileMotionDesignTimeline} from "./motion-design-plan.mjs";
const visual={title:"Количество",hanzi:"两本书",pinyin:"liǎng běn shū",meaning:"две книги",object:"book",count:2};
const beat={id:"count-books",kind:"quantity",cueText:"две",explains:"Show the spoken quantity",visual};
const scene={id:"any-lesson",kind:"example",startMs:0,endMs:5000,motionBeats:[beat,{...beat,id:"group",cueText:"вместе",visual:{...visual,grouped:true}}]};
const episode={id:"unrelated-topic",motionDesign:true,motionDesignStyle:"explain-actions-v1",captionSource:"gemini-word-timestamps",scenes:[scene],captions:[{text:"две",startMs:501,endMs:800},{text:"вместе",startMs:2801,endMs:3200}]};
test("reusable plan represents different objects/counts without an episode-specific style",()=>{
  for(const object of ["tea-cup","book","apple"])for(const count of [1,2,6])
    assert.doesNotThrow(()=>validateActionVisual({...beat,visual:{...visual,object,count}}));
  const timeline=compileMotionDesignTimeline(episode);
  assert.equal(timeline.coverage.actionCount,2);
  assert.deepEqual(timeline.scenes[0].beats.map(b=>b.startFrame),[16,85]);
});
test("missing scene actions, identical states and missing speech cues block rendering",()=>{
  assert.throws(()=>compileMotionDesignTimeline({...episode,scenes:[{...scene,motionBeats:[]}]}),/at least two/);
  assert.throws(()=>validateActionLesson({scenes:[{...scene,motionBeats:[beat,{...beat,id:"duplicate"}]}]}),/identical visuals/);
  assert.throws(()=>compileMotionDesignTimeline({...episode,captions:episode.captions.slice(0,1)}),/missing\/ambiguous/);
});
test("unrenderable or misleading payloads fail instead of falling back to a generic background",()=>{
  for(const patch of [{count:0},{count:7},{object:"car"},{object:undefined},{grouped:"false"},{focus:"不存在"}])assert.throws(()=>validateActionVisual({...beat,visual:{...visual,...patch}}));
  assert.throws(()=>validateActionVisual({...beat,kind:"phrase",visual:{...visual,parts:["两","杯","茶"]}}),/exact shown phrase/);
  assert.throws(()=>compileMotionDesignTimeline({...episode,motionDesignStyle:"le-context-v1"}),/legacy styles/);
  assert.throws(()=>validateActionVisual({...beat,kind:"comparison",visual:{...visual,models:[{...visual,kind:"comparison"},{...visual,kind:"quantity"}]}}),/Nested/);
});
test("owner-approved pilot plan covers every authored lesson scene with diverse actions",()=>{
  const plan=JSON.parse(fs.readFileSync(new URL("../content/pilots/quantity-cafe-20261026.json",import.meta.url)));
  const report=validateActionLesson({scenes:plan.scenes.map(s=>({id:s.sceneId,kind:"example",motionBeats:s.beats}))});
  assert.equal(report.sceneCount,5);assert.equal(report.actionCount,23);
  assert.ok(plan.scenes.flatMap(s=>s.beats).some(b=>b.kind==="ordinal"));
});
