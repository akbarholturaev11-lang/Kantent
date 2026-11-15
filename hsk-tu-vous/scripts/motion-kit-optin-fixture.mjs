/**
 * Synthetic CI integration fixture: real existing HSKAI-Episode renderer,
 * existing approved repo art copied into an untracked throwaway test ID,
 * simulated captions and no customer/production audio. NOT a real Gemini QA.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {createHash} from "node:crypto";
import {compileCueTimeline} from "./compile-cue-timeline.mjs";
import {compileMotionKitCuePlan} from "./motion-kit-cue-plan.mjs";
import visual from "../content/visual-system.json" with {type:"json"};

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const id="motionkit-synthetic-ci";
const artSrc=path.join(ROOT,"public/lesson-art/youdianr-vs-yidianr-price-20261111");
const output=path.resolve(process.argv[2]??"/tmp/motion-kit-optin");
await fs.mkdir(output,{recursive:true});
await fs.mkdir(path.join(ROOT,"public/lesson-art",id),{recursive:true});
await fs.copyFile(path.join(artSrc,"park-request.jpg"),
 path.join(ROOT,"public/lesson-art",id,"art-one.jpg"));
await fs.copyFile(path.join(artSrc,"market-request.jpg"),
 path.join(ROOT,"public/lesson-art",id,"art-two.jpg"));

const scenes=[{
  id:"test-scene",kind:"example",headline:"Technical preview",
  narration:"Первый пример",durationFrames:90,startMs:0,endMs:3000,
  motionBeats:[
    {id:"first",kind:"phrase",cueText:"Первый",explains:"Synthetic visual change one",
     visual:{title:"Проверка произношения",hanzi:"你好",pinyin:"nǐ hǎo",meaning:"салом",
       illustration:{layout:"scene",images:["art-one"]}}},
    {id:"second",kind:"phrase",cueText:"пример",explains:"Synthetic visual change two",
     visual:{title:"Другая проверка",hanzi:"谢谢",pinyin:"xièxie",meaning:"раҳмат",
       illustration:{layout:"scene",images:["art-two"]}}},
  ],
}];
const captions=[
  {text:"Первый",startMs:100,endMs:460},
  {text:"пример",startMs:1500,endMs:1910},
];
const voiceTextHash=createHash("sha256").update(scenes.map(x=>x.narration.trim()).join("\n\n")+"\n","utf8").digest("hex");
const episode={
  id,date:"2026-11-15",timezone:"Asia/Shanghai",languageCode:"ru-RU",
  title:"Synthetic technical motion integration preview",level:"HSK 1",topic:"CI",
  captionSource:"gemini-word-timestamps", // SYNTHETIC fixture ONLY
  voiceTextHash,audioSha256:"a".repeat(64),motionDesign:true,
  motionDesignStyle:"explain-actions-v1",scenes,captions,
};
const cueTimeline=compileCueTimeline(episode,{fps:30,presentationPolicy:visual.lessonPresentation});
const motionKitPlan=compileMotionKitCuePlan(episode,cueTimeline,{contentType:"lesson"});
await Promise.all([
  fs.writeFile(path.join(output,"baseline.json"),JSON.stringify({episode,cueTimeline},null,2)),
  fs.writeFile(path.join(output,"candidate.json"),JSON.stringify({episode,cueTimeline,motionKitPlan},null,2)),
]);
console.log(JSON.stringify({status:"synthetic-ci-only",episodeId:id,selected:motionKitPlan.scenes.map(x=>x.componentId),
 files:["baseline.json","candidate.json"],frameAtFirstCue:3},null,2));
