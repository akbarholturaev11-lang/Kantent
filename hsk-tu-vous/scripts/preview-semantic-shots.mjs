import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { suggestSemanticShots } from "./semantic-shot-adviser.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const id=process.argv[2];
if(!id || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))
  throw Error("Usage: npm run content:semantic-plan -- <planned-episode-id>");
const contentDir=path.join(root,"content");
const calendar=JSON.parse(fs.readFileSync(path.join(contentDir,"calendar.json"),"utf8"));
const item=calendar.items.find(entry=>entry.id===id);
if(!item) throw Error("Episode ID not present in canonical calendar: "+id);
if(!/^episodes\/[a-z0-9]+(?:-[a-z0-9]+)*\.json$/.test(item.episodeFile??""))
  throw Error("Unsafe episode file reference in calendar");
const episode=JSON.parse(fs.readFileSync(path.join(contentDir,item.episodeFile),"utf8"));
if(episode.id!==item.id || episode.date!==item.date)
  throw Error("Calendar identity mismatch");
const result=suggestSemanticShots(episode,{eligibility:item.status});
process.stdout.write(JSON.stringify(result,null,2)+"\n");
// Read-only: never create a working review file, alter a lesson, or publish.
