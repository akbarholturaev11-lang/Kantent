/**
 * M3 visual-only test: one authored SVG group (a book) is shared from the
 * outgoing to incoming action while the camera performs bounded cue motion.
 * Real voice, Gemini captions and social publishing are intentionally absent.
 */
import fs from "node:fs";
import {validateActionLesson} from "./action-design-plan.mjs";
import {compileMotionDirectorScene} from "./motion-director-plan.mjs";
import {resolveMotionBeats} from "./motion-design-plan.mjs";
const file=process.argv[2];
if(!file)throw Error("Usage: node scripts/motion-director-render-fixture.mjs /tmp/props.json");
const graphic=x=>({width:820,height:400,nodes:[
  {id:"book",type:"g",attrs:{},x},
  {id:"cover",type:"rect",parentId:"book",attrs:{x:280,y:65,width:250,height:286,rx:14,fill:"teal"}},
  {id:"spine",type:"rect",parentId:"book",attrs:{x:292,y:75,width:28,height:265,rx:5,fill:"gold"}},
  {id:"pages",type:"line",parentId:"book",attrs:{x1:347,y1:159,x2:480,y2:159,stroke:"foreground",strokeWidth:8}},
  {id:"base",type:"line",attrs:{x1:90,y1:340,x2:730,y2:340,stroke:"secondary",strokeWidth:5}}
],tracks:[]});
const scene={
  id:"book-move",kind:"example",durationFrames:120,startMs:0,endMs:4000,
  headline:"TEST ONLY — NOT FOR PUBLICATION",
  narration:"Книга слева, затем справа.",
  motionBeats:[
    {id:"book-left",kind:"graphic",cueText:"слева",explains:"Move the same book, shown at left",
      visual:{title:"Left",hanzi:"左边",pinyin:"zuǒbian",meaning:"слева",graphic:graphic(-125)}},
    {id:"book-right",kind:"graphic",cueText:"справа",explains:"Maintain same book and move it to right",
      visual:{title:"Right",hanzi:"右边",pinyin:"yòubian",meaning:"справа",graphic:graphic(125)}}
  ],
  motionDirection:{schemaVersion:1,shots:[
    {shotId:"left",beatId:"book-left",meaningCue:"слева",assetIds:["node:book"],
      camera:{xPx:0,yPx:0,scale:1},transition:{kind:"cut",frames:0},focalRole:"object",zIndex:0},
    {shotId:"right",beatId:"book-right",meaningCue:"справа",assetIds:["node:book"],
      persistentElementIds:["node:book"],camera:{xPx:32,yPx:-8,scale:1.05},
      transition:{kind:"crossfade",frames:12},focalRole:"action",zIndex:0}
  ]}
};
const episode={
  id:"motion-director-synthetic-only",languageCode:"ru-RU",title:"M3 shared book QA",
  level:"HSK 1",topic:"left vs right",motionDesign:true,motionDesignStyle:"explain-actions-v1",
  voiceTextHash:"SYNTHETIC-NO-VOICE-DO-NOT-PUBLISH",captionSource:"gemini-word-timestamps",
  scenes:[scene],captions:[
    {text:"Книга",startMs:100,endMs:420},
    {text:"слева",startMs:900,endMs:1150},
    {text:"затем",startMs:1720,endMs:1960},
    {text:"справа",startMs:2200,endMs:2550}
  ]
};
validateActionLesson(episode,{requireVisibleChange:true});
const beats=resolveMotionBeats(scene,episode.captions,30,episode.languageCode);
const result=compileMotionDirectorScene(scene,beats);
if(result.shots[1].cueFrame!==66||result.shots[1].persistentElementIds[0]!=="node:book")
  throw Error("Fixture must preserve same authored book at exact cue frame 66");
fs.writeFileSync(file,JSON.stringify({episode},null,2));
console.log("Only technical/synthetic scene data, no original Gemini audio",file);
