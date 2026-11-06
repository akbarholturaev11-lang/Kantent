import test from "node:test";
import assert from "node:assert/strict";
import {resolveMotionBeats,compileMotionDesignTimeline,validateMotionBeatNarration,validateGraphicTrackTiming} from "./motion-design-plan.mjs";
const scene={id:"example",startMs:1000,endMs:6000,motionBeats:[{id:"buy",kind:"purchase",cueText:"купил"}]};
const words=[{text:"Я",startMs:1200,endMs:1400},{text:"купил",startMs:1551,endMs:1800},
  {text:"книгу.",startMs:1900,endMs:2200}];
test("meaningful motion starts on the spoken cue frame, without early lead",()=>{
  const [beat]=resolveMotionBeats(scene,words);
  assert.equal(beat.startFrame,47);assert.equal(beat.localFrame,17);assert.equal(beat.startMs,1551);
});
test("source narration preflight checks motion cue presence, ambiguity and order",()=>{
  const cues=[{id:"one",cueText:"купил"},{id:"two",cueText:"книгу"}];
  assert.deepEqual(validateMotionBeatNarration({id:"example",narration:"Я купил книгу.",motionBeats:cues}),[]);
  assert.match(validateMotionBeatNarration({id:"example",narration:"Я купил товар.",motionBeats:cues}).join(" "),/two: motion cue is missing/);
  const repeated={id:"repeat",cueText:"купил"};
  assert.match(validateMotionBeatNarration({id:"example",narration:"Я купил книгу, потом купил чай.",motionBeats:[repeated]}).join(" "),/ambiguous/);
  assert.deepEqual(validateMotionBeatNarration({id:"example",narration:"Я купил книгу, потом купил чай.",motionBeats:[{...repeated,cueOccurrence:2}]},"ru-RU"),[]);
  assert.match(validateMotionBeatNarration({id:"example",narration:"Я книгу купил.",motionBeats:cues}).join(" "),/two: motion cue is out of narration order/);
});
test("graphic motions must settle before the next spoken cue, while deliberate loops may continue",()=>{
  const visual={graphic:{tracks:[{nodeId:"hero",property:"x",keyframes:[{atMs:0,value:100},{atMs:5000,value:300}]}]}};
  const beats=[{id:"move",kind:"graphic",startMs:1000,visual},{id:"settle",kind:"meaning",startMs:2200}];
  assert.throws(()=>validateGraphicTrackTiming({id:"scene",endMs:5000},beats),/settles at 5000ms.*next spoken cue arrives after 1200ms/);
  const short={...visual,graphic:{tracks:[{...visual.graphic.tracks[0],keyframes:[{atMs:0,value:100},{atMs:800,value:300}]}]}};
  assert.equal(validateGraphicTrackTiming({id:"scene",endMs:5000},[{...beats[0],visual:short},beats[1]]),true);
  const loop={...visual,graphic:{tracks:[{...visual.graphic.tracks[0],loop:true}]}};
  assert.equal(validateGraphicTrackTiming({id:"scene",endMs:5000},[{...beats[0],visual:loop},beats[1]]),true);
});
test("motion timeline compilation rejects a graphic reveal that misses its actual next word cue",()=>{
  const drawing=(fill,tracks=[])=>({width:400,height:400,nodes:[{id:"hero",type:"rect",attrs:{x:100,y:100,width:100,height:100,fill}}],tracks});
  const episode={id:"graphic-window",motionDesign:true,motionDesignStyle:"explain-actions-v1",captionSource:"gemini-word-timestamps",
    captions:[{text:"плывёт",startMs:100,endMs:400},{text:"останавливается",startMs:1300,endMs:1650}],
    scenes:[{id:"scene",kind:"example",startMs:0,endMs:6000,narration:"плывёт и останавливается",motionBeats:[
      {id:"move",kind:"graphic",cueText:"плывёт",explains:"Show movement",visual:{title:"move",hanzi:"",pinyin:"",meaning:"",graphic:drawing("teal",[
        {nodeId:"hero",property:"x",keyframes:[{atMs:0,value:0},{atMs:5000,value:200}]},
      ])}},
      {id:"stop",kind:"graphic",cueText:"останавливается",explains:"Show the stop",visual:{title:"stop",hanzi:"",pinyin:"",meaning:"",graphic:drawing("gold")}},
    ]}]};
  assert.throws(()=>compileMotionDesignTimeline(episode),/scene\/move: hero\/x settles at 5000ms.*next spoken cue arrives after 1200ms/);
  episode.scenes[0].motionBeats[0].visual.graphic.tracks[0].keyframes[1]={atMs:800,value:200};
  assert.equal(compileMotionDesignTimeline(episode).scenes[0].beats.length,2);
});
test("missing or repeated cues fail; explicit occurrence resolves repetition",()=>{
  assert.throws(()=>resolveMotionBeats(scene,words.filter(w=>w.text!=="купил")),/missing\/ambiguous/);
  const repeated=[...words,{text:"купил",startMs:3000,endMs:3300}];
  assert.throws(()=>resolveMotionBeats(scene,repeated),/ambiguous/);
  assert.equal(resolveMotionBeats({...scene,motionBeats:[{...scene.motionBeats[0],cueOccurrence:2}]},repeated)[0].startMs,3000);
});
test("a boundary-crossing word keeps its real onset, while next-scene words stay excluded",()=>{
  const boundary={...scene,endMs:1800};
  const crossing=words.map(w=>w.text==="купил"?{...w,endMs:1850}:w);
  assert.equal(resolveMotionBeats(boundary,crossing)[0].endMs,1850);
  assert.throws(()=>resolveMotionBeats({...boundary,motionBeats:[{id:"next",kind:"example",cueText:"книгу"}]},crossing),/missing/);
});
test("phrase cues use actual adjacent annotations, preserving the original timestamps",()=>{
  const input=structuredClone(words);
  assert.equal(resolveMotionBeats({...scene,motionBeats:[{id:"example",kind:"example",cueText:"купил книгу"}]},words)[0].endMs,2200);
  assert.deepEqual(words,input);
  assert.throws(()=>resolveMotionBeats({...scene,motionBeats:[{id:"bad",kind:"example",cueText:"Я книгу"}]},words),/missing/);
});
test("rejects reversed events and unverified/CTA plans",()=>{
  assert.throws(()=>resolveMotionBeats({...scene,motionBeats:[{id:"book",kind:"example",cueText:"книгу"},...scene.motionBeats]},words),/speech order/);
  const episode={id:"lesson",motionDesign:true,motionDesignStyle:"le-context-v1",captionSource:"gemini-word-timestamps",captions:words,scenes:[scene]};
  assert.equal(compileMotionDesignTimeline(episode).scenes[0].beats.length,1);
  assert.throws(()=>compileMotionDesignTimeline({...episode,captionSource:"guessed"}),/verified/);
  assert.throws(()=>compileMotionDesignTimeline({...episode,motionDesignStyle:"unimplemented"}),/Unsupported/);
  assert.throws(()=>compileMotionDesignTimeline({...episode,scenes:[{...scene,kind:"cta"}]}),/CTA/);
});
