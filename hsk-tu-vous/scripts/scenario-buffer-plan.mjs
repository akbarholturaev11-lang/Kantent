import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPlanningBuffer, isDraftReady, dateInTimezone } from './self-improvement-check.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const names = ['SU','MO','TU','WE','TH','FR','SA'];
const pattern = /^\d{4}-\d{2}-\d{2}$/;
function utcDate(s) {
  if(!pattern.test(s)) throw Error('Expected YYYY-MM-DD date');
  const d=new Date(s+'T12:00:00Z');
  if(Number.isNaN(+d)||d.toISOString().slice(0,10)!==s) throw Error('Invalid calendar date '+s);
  return d;
}
function followingDay(s) {
  const d=utcDate(s); d.setUTCDate(d.getUTCDate()+1); return d.toISOString().slice(0,10);
}
export function proposeBuffer(calendar, {today, episodeIsReady=()=>true}={}) {
  if(!Array.isArray(calendar?.planningWeekdays)||new Set(calendar.planningWeekdays).size!==calendar.planningWeekdays.length||
     calendar.planningWeekdays.length!==calendar.cadencePerWeek ||
     calendar.planningWeekdays.some(d=>!names.includes(d))) throw Error('Invalid calendar planningWeekdays or cadencePerWeek');
  const audit=auditPlanningBuffer(calendar,{today,episodeIsReady});
  const repair=audit.missing.map(x=>({type:'repair-existing-plan',date:x.date,id:x.id,reason:x.reason}));
  const count=Math.max(0,audit.shortfallToTarget-repair.length);
  const occupied=new Set(calendar.items.map(x=>x.date));
  const allDates=[today,...calendar.items.map(x=>x.date).filter(x=>pattern.test(x))].sort();
  let cursor=allDates.at(-1);
  const propose=[];
  for(let checked=0;propose.length<count && checked<366;checked++){
    cursor=followingDay(cursor);
    if(calendar.planningWeekdays.includes(names[utcDate(cursor).getUTCDay()]) && !occupied.has(cursor)){
      propose.push({type:'author-new-script',date:cursor,requiresVerifiedLearningFacts:true,requiresHookExperiment:true,ctaSource:'content/cta-lab.json',status:'planned'});
    }
  }
  if(propose.length!==count)throw Error('Failed to propose enough calendar dates within one year');
  return {date:today,timeZone:calendar.timezone,buffer:audit,repair,propose,
    writeDestination:'main',mustWriteToFeatureBranch:false,publishedMediaChangeAllowed:false,proposalsAreScripts:false,
    note:'Date suggestions only. Author full, verified, CTA-free source JSON before registering a new calendar item.'};
}
export function runCli(args=process.argv.slice(2),dir=root) {
  let requested=null,json=false;
  for(let i=0;i<args.length;i++) {
    if(args[i]==='--date')requested=args[++i];
    else if(args[i]==='--json')json=true;
    else throw Error('Unknown option '+args[i]);
  }
  const calendar=JSON.parse(fs.readFileSync(path.join(dir,'content/calendar.json'),'utf8'));
  const today=requested||dateInTimezone(new Date(),calendar.timezone);
  const result=proposeBuffer(calendar,{today,episodeIsReady:item=>isDraftReady(dir,item)});
  if(json)console.log(JSON.stringify(result,null,2));
  else console.log('Buffer='+result.buffer.readyFutureEpisodes+', repairs='+result.repair.length+', future dates to author='+result.propose.map(x=>x.date).join(', '));
  return 0; // returning a proposed plan is not an assertion that drafts have been created
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try{process.exitCode=runCli();}catch(e){console.error('Scenario buffer plan failed: '+e.message);process.exitCode=1;}
}
