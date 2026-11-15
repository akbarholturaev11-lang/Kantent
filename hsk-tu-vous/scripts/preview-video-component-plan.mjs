import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {selectVideoComponents} from "./video-component-selector.mjs";

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const TYPES=new Set(["lesson","advertisement","series-part"]);
const WEEKDAYS=["SU","MO","TU","WE","TH","FR","SA"];
export function resolveContentType(item,calendar){
  if(TYPES.has(item.contentType))return item.contentType;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(item.date||""))throw Error("Calendar item requires a real date");
  const schedule=calendar.weeklySchedule;
  if(item.date<(schedule?.effectiveFromDate??"9999-12-31"))throw Error("Historical item has no registered contentType: "+item.id);
  const weekday=WEEKDAYS[new Date(item.date+"T12:00:00Z").getUTCDay()];
  const type=schedule?.days?.find(row=>row.weekday===weekday)?.contentType;
  if(!TYPES.has(type))throw Error("No schedule contentType for "+item.date);
  return type;
}
export function sourceRelativePath(item){
  const p=item.promoFile??item.episodeFile;
  if(typeof p!=="string"||! /^(episodes|promos)\/[a-z0-9][a-z0-9-]*\.json$/.test(p))
    throw Error("Calendar row must have a safe, exact registered episodeFile/promoFile: "+item.id);
  return p;
}
export function asSelectorEpisode(item,source,contentType){
  if(source.id!==item.id)throw Error("Source ID does not match registered calendar item: "+item.id);
  const input=contentType==="advertisement"
    ?(source.beats??source.scenes)
    :source.scenes;
  if(!Array.isArray(input)||!input.length)throw Error("No authored source beats/scenes: "+item.id);
  return {id:item.id,scenes:input.map(s=>({
    id:s.id,kind:contentType==="advertisement"?"promo":(s.kind??"story"),
    narration:s.narration,
  }))};
}
async function readItem(item,calendar){
  const contentType=resolveContentType(item,calendar),sourcePath=sourceRelativePath(item);
  const data=JSON.parse(await fs.readFile(path.join(ROOT,"content",sourcePath),"utf8"));
  return {item,contentType,sourcePath,episode:asSelectorEpisode(item,data,contentType)};
}
export async function previewVideoComponentPlan(key){
  if(!key)throw Error("Usage: node scripts/preview-video-component-plan.mjs <calendar-date-or-episode-id>");
  const calendar=JSON.parse(await fs.readFile(path.join(ROOT,"content","calendar.json"),"utf8"));
  const hits=calendar.items.filter(item=>item.date===key||item.id===key);
  if(hits.length!==1)throw Error("Calendar must contain exactly one matching registered item: "+key);
  const record=await readItem(hits[0],calendar);
  const previous=calendar.items.filter(i=>i.date<record.item.date)
    .sort((a,b)=>b.date.localeCompare(a.date));
  const histories=[],compared=[],historySkipped=[];
  for(const item of previous){
    if(histories.length>=5)break;
    let type;try{type=resolveContentType(item,calendar)}catch{continue}
    if(type!==record.contentType)continue;
    try {
      const prev=await readItem(item,calendar);
      const p=selectVideoComponents(prev.episode,{contentType:type});
      histories.push(p.sequence);
      compared.push({episodeId:prev.item.id,date:prev.item.date});
    } catch (error) {
      historySkipped.push({episodeId:item.id,date:item.date,reason:String(error.message||error)});
    }
  }
  const plan=selectVideoComponents(record.episode,{contentType:record.contentType,recentSequences:histories});
  return {date:record.item.date,sourcePath:record.sourcePath,recentCompared:compared,historySkipped,plan};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  previewVideoComponentPlan(process.argv[2]).then(p=>process.stdout.write(JSON.stringify(p,null,2)+"\n"))
    .catch(e=>{console.error(String(e.message||e));process.exitCode=1});
}
