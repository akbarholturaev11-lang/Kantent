import fs from "node:fs";
import path from "node:path";
import {createMotionQaPlan} from "./motion-visual-qa.mjs";

const [input,output]=process.argv.slice(2);
if(!input||!output)throw Error("Usage: node scripts/write-motion-qa-plan.mjs <episode-props.json> <output.json>");
const props=JSON.parse(fs.readFileSync(input,"utf8"));
const report=createMotionQaPlan(props.episode);
fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({
  episode:report.episodeId,declaredTiming:report.timingSourceDeclared,
  audioAuthenticity:report.audioAuthenticity,shotCount:report.shotCount,
  cues:report.shots.map(s=>({shot:s.shotId,frame:s.globalCueFrame,word:s.cueText}))
}));
