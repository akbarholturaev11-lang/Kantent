import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileSemanticVisualTimeline } from "./semantic-visual-plan.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const id=process.argv[2];
if (!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
  throw Error("Usage: node scripts/prepare-semantic-visual.mjs <review-episode-id>");
const folder=path.join(root,"review",id);
const episode=JSON.parse(await fs.readFile(path.join(folder,"episode.json"),"utf8"));
if (episode.id!==id) throw Error("Review episode ID/path mismatch");
const status=await fs.readFile(path.join(folder,"status.json"),"utf8").then(JSON.parse).catch(err=>{
  if(err.code==="ENOENT") return {stage:"plan-ready"};
  throw err;
});
const protectedStages=new Set(["rendered-pending-owner-approval","owner-approved-for-zernio-publishing",
"zernio-published","zernio-scheduled","zernio-publication-processing","zernio-publication-partial",
"zernio-publication-failed"]);
if (protectedStages.has(status.stage) || ["published","scheduled"].includes(episode.publishingStatus))
  throw Error("Approved/published review package is protected; do not overwrite its visual timeline");
const compiled=compileSemanticVisualTimeline(episode);
const output=path.join(folder,"visual-timeline.json");
const temporary=output+".tmp";
await fs.writeFile(temporary,JSON.stringify(compiled,null,2)+"\n","utf8");
await fs.rename(temporary,output);
console.log("Review-only semantic timeline:",output);
console.log("Actions:",compiled.scenes.reduce((sum,scene)=>sum+scene.actions.length,0));
console.log("Renderer still disabled; no MP4 generated or published.");
