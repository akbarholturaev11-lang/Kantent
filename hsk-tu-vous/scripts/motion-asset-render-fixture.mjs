/** Synthetic timing and original review-only assets; NO real Gemini voice or post approval. */
import fs from "node:fs";
import {validateActionLesson} from "./action-design-plan.mjs";
import {compileMotionDirectorScene} from "./motion-director-plan.mjs";
import {resolveMotionBeats} from "./motion-design-plan.mjs";
const output=process.argv[2];
if(!output)throw Error("Usage: node scripts/motion-asset-render-fixture.mjs /tmp/motion-asset-props.json");
const visual=(assetId,hanzi,pinyin,meaning)=>({title:meaning,hanzi,pinyin,meaning,assetId});
const scene={
 id:"objects",kind:"example",durationFrames:140,startMs:0,endMs:4667,
 headline:"TECHNICAL TEST ONLY",narration:"Книга, потом чай, потом магазин",
 motionBeats:[
  {id:"book",kind:"asset",cueText:"Книга",explains:"Show a physical study book",visual:visual("study-book","书","shū","книга")},
  {id:"tea",kind:"asset",cueText:"чай",explains:"Show a recognizable tea cup, not a generic book",visual:visual("tea-cup","茶","chá","чай")},
  {id:"market",kind:"asset",cueText:"магазин",explains:"Show a small market shop",visual:visual("market-stall","商店","shāngdiàn","магазин")}
 ],
 motionDirection:{schemaVersion:1,shots:[
  {shotId:"book-shot",beatId:"book",meaningCue:"Книга",assetIds:["asset:study-book"],camera:{xPx:0,yPx:0,scale:1},transition:{kind:"cut",frames:0},focalRole:"object",zIndex:0},
  {shotId:"tea-shot",beatId:"tea",meaningCue:"чай",assetIds:["asset:tea-cup"],camera:{xPx:20,yPx:-10,scale:1.04},transition:{kind:"slide-match",frames:12,direction:"left"},focalRole:"object",zIndex:0},
  {shotId:"market-shot",beatId:"market",meaningCue:"магазин",assetIds:["asset:market-stall"],camera:{xPx:0,yPx:0,scale:1.05},transition:{kind:"masked-reveal",frames:12,direction:"right"},focalRole:"object",zIndex:0}
 ]}
};
const episode={id:"assets-synthetic-review-only",languageCode:"ru-RU",title:"M4 Asset Smoke",level:"HSK 1",topic:"book tea",motionDesign:true,motionDesignStyle:"explain-actions-v1",
 voiceTextHash:"SYNTHETIC-NO-VOICE",captionSource:"gemini-word-timestamps",
 scenes:[scene],captions:[
 {text:"Книга",startMs:900,endMs:1230},{text:"потом",startMs:1680,endMs:1950},
 {text:"чай",startMs:2200,endMs:2490},
 {text:"потом",startMs:2720,endMs:2900},
 {text:"магазин",startMs:3400,endMs:3800}
 ]};
validateActionLesson(episode,{requireVisibleChange:true});
const result=compileMotionDirectorScene(scene,resolveMotionBeats(scene,episode.captions,30,episode.languageCode));
if(result.shots[1].cueFrame!==66||result.shots[2].cueFrame!==102)throw Error("Wrong imported cue frames");
fs.writeFileSync(output,JSON.stringify({episode},null,2));
console.log("Review-only original assets, synthetic timestamps; NOT a publishable video",output);
