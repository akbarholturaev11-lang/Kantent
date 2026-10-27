/** Synthetic timestamp fixture for the actual canonical dated-loader path.
 * It cannot be published or mistaken for an imported Gemini audio file.
 */
import fs from "node:fs";
import { getPlannedEpisode } from "./lib.mjs";
import { prepareSemanticRender } from "./semantic-review-integration.mjs";
const outfile=process.argv[2];
if(!outfile) throw Error("Usage: node scripts/semantic-planned-fixture.mjs /tmp/props.json");
const {episode}=await getPlannedEpisode("2026-10-21");
if(!episode.semanticVisual || !episode.autoSemantic)
  throw Error("Normal production loader failed to apply semantic shot plan");
let frame=0;
const captions=[];
for(const scene of episode.scenes){
  const frames=Math.ceil((scene.durationSec??4)*30);
  scene.durationFrames=frames;
  scene.startMs=frame/30*1000;
  scene.endMs=(frame+frames)/30*1000;
  const first=String(scene.narration??"").match(/[\p{L}\p{M}]+/u)?.[0]??"test";
  captions.push({text:first,startMs:scene.startMs+100,endMs:scene.startMs+250});
  frame+=frames;
}
episode.captions=captions;
episode.captionSource="gemini-word-timestamps";
episode.voiceTextHash="SYNTHETIC-TEST-ONLY-NO-GEMINI-OR-VOICE";
const semanticTimeline=prepareSemanticRender(episode);
if(!semanticTimeline || semanticTimeline.scenes.length!==episode.scenes.length-1)
  throw Error("Semantic timeline did not span actual lesson scenes");
fs.writeFileSync(outfile,JSON.stringify({episode,semanticTimeline},null,2));
console.log("Synthetic timestamps ONLY; semantic review props:",outfile);
