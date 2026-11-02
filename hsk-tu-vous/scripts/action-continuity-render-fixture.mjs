/** Visual-only synthetic action continuity fixture. NO Gemini, no publishable audio. */
import fs from "node:fs";
import {resolveMotionBeats} from "./motion-design-plan.mjs";
import {validateActionLesson} from "./action-design-plan.mjs";
const outfile=process.argv[2];
if(!outfile) throw Error("Usage: node scripts/action-continuity-render-fixture.mjs /tmp/action-props.json");
const scene={
  id:"action",kind:"example",headline:"TECHNICAL TEST ONLY",durationFrames:120,startMs:0,endMs:4000,
  narration:"Две чашки, затем три чашки.",
  motionBeats:[
    {id:"two-cups",kind:"quantity",cueText:"Две",explains:"Illustrate two cups",
      visual:{title:"Two cups",hanzi:"两杯茶",pinyin:"liǎng bēi chá",meaning:"Два чая",object:"tea-cup",count:2}},
    {id:"three-cups",kind:"quantity",cueText:"три",explains:"Count changes to three at the new cue",
      visual:{title:"Three cups",hanzi:"三杯茶",pinyin:"sān bēi chá",meaning:"Три чая",object:"tea-cup",count:3}}
  ]
};
const episode={
  id:"synthetic-action-continuity-only",languageCode:"ru-RU",title:"Synthetic continuity smoke",
  level:"HSK 1",topic:"two to three cups",motionDesign:true,
  motionDesignStyle:"explain-actions-v1",captionSource:"gemini-word-timestamps",
  voiceTextHash:"SYNTHETIC-NO-GEMINI-NO-VOICE",scenes:[scene],
  captions:[
    {text:"Две",startMs:900,endMs:1100},
    {text:"чашки",startMs:1110,endMs:1460},
    {text:"затем",startMs:1800,endMs:2100},
    {text:"три",startMs:2200,endMs:2450},
    {text:"чашки",startMs:2500,endMs:2850}
  ]
};
validateActionLesson(episode,{requireVisibleChange:true});
const resolved=resolveMotionBeats(scene,episode.captions,30,episode.languageCode);
if(resolved.map(b=>b.localFrame).join(",")!=="27,66")
  throw Error("Synthetic continuity cue frames changed");
fs.writeFileSync(outfile,JSON.stringify({episode},null,2));
console.log("Visual-only technical fixture, synthetic timestamps, no audio or publishing",outfile);
