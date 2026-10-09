import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fields = ['views','reach','likes','comments','saves','shares','avgWatchMs','skipRatePercent','durationSeconds'];
const windows = new Set(['lifetime','24h','72h','7d']);
const iso = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v));

export function validateObservation(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return ['observation must be object'];
  const errors=[];
  if(!['instagram','tiktok'].includes(o.platform)) errors.push('invalid platform');
  if(typeof o.platformPostId!=='string' || !/^[a-zA-Z0-9_-]{6,100}$/.test(o.platformPostId)) errors.push('invalid platformPostId');
  if(typeof o.accountUsername!=='string' || !o.accountUsername.trim()) errors.push('missing accountUsername');
  if(!iso(o.publishedAt)||!iso(o.observedAt)) errors.push('invalid timestamps');
  if(iso(o.publishedAt)&&iso(o.observedAt)&&Date.parse(o.publishedAt)>Date.parse(o.observedAt)) errors.push('observation precedes publication');
  if(!windows.has(o.window)) errors.push('invalid window');
  if(o.source?.provider!=='Zernio'||!iso(o.source?.syncedAt)||!o.source?.endpoint) errors.push('missing Zernio provenance');
  if(o.postUrl!=null && (typeof o.postUrl!=='string'||!/^https:\/\/(www\.)?(instagram\.com|tiktok\.com)\//.test(o.postUrl))) errors.push('invalid postUrl');
  if(o.episodeId!=null && (typeof o.episodeId!=='string'||!/^[a-z0-9-]+$/.test(o.episodeId))) errors.push('invalid episodeId');
  if(o.hookFormat!=null && !['question','contrast','scenario'].includes(o.hookFormat)) errors.push('invalid hookFormat');
  if(o.hskLevel!=null && (typeof o.hskLevel!=='string'||!/^HSK\s*[1-6](?:\s*[-–]\s*[1-6])?$/.test(o.hskLevel))) errors.push('invalid hskLevel');
  if(o.effectStyle!=null && (typeof o.effectStyle!=='string'||o.effectStyle.length>80)) errors.push('invalid effectStyle');
  for(const name of fields){
    const v=o.metrics?.[name];
    if(!Object.hasOwn(o.metrics||{},name) || !(v===null||(typeof v==='number'&&Number.isFinite(v)&&v>=0))) errors.push('invalid metric '+name);
    if(['views','reach','likes','comments','saves','shares'].includes(name) && v!==null && !Number.isInteger(v)) errors.push('count not integer: '+name);
  }
  if(o.metrics?.skipRatePercent!=null && o.metrics.skipRatePercent>100) errors.push('skipRatePercent out of bounds');
  if(o.metrics?.durationSeconds===0) errors.push('durationSeconds cannot be zero');
  return errors;
}

export function validateDataset(data) {
  if(data?.schemaVersion!==1 || !Array.isArray(data.observations)) throw Error('Expected schemaVersion 1 and observations[]');
  const ids=new Set();
  for(const [i,o] of data.observations.entries()){
    const errors=validateObservation(o);
    if(errors.length) throw Error('Observation '+i+': '+errors.join('; '));
    const id=[o.platform,o.platformPostId,o.window,o.observedAt].join('/');
    if(ids.has(id)) throw Error('Duplicate observation '+id);
    ids.add(id);
  }
  return data.observations;
}

export function durationBand(sec) {
  return sec==null?'unknown':sec<25?'under-25s':sec<30?'25-29s':sec<=35?'30-35s':'over-35s';
}
export function deriveMetrics(o){
  const {views,saves,shares,avgWatchMs,skipRatePercent,durationSeconds}=o.metrics;
  return {
    platform:o.platform,postId:o.platformPostId,episodeId:o.episodeId,
    hookFormat:o.hookFormat,hskLevel:o.hskLevel,window:o.window,
    observedAt:o.observedAt,publishedAt:o.publishedAt,
    durationBand:durationBand(durationSeconds),views,skipRatePercent,
    averageWatchSeconds:avgWatchMs==null?null:+(avgWatchMs/1000).toFixed(3),
    averageWatchRatio:avgWatchMs==null||!durationSeconds?null:+(avgWatchMs/1000/durationSeconds).toFixed(4),
    savesPer1000Views:saves==null||!views?null:+(1000*saves/views).toFixed(2),
    sharesPer1000Views:shares==null||!views?null:+(1000*shares/views).toFixed(2)
  };
}
export function analyzeObservations(observations,policy={}){
  const latest=new Map();
  for(const o of observations){
    const errors=validateObservation(o); if(errors.length) throw Error(errors.join('; '));
    const key=[o.platform,o.platformPostId,o.window].join('/');
    if(!latest.has(key)||latest.get(key).observedAt<o.observedAt) latest.set(key,o);
  }
  const posts=[...latest.values()].map(deriveMetrics).sort((a,b)=>a.postId.localeCompare(b.postId));
  const cohorts=new Map();
  for(const p of posts){
    if(p.window==='lifetime'||!p.hookFormat||!p.hskLevel||p.averageWatchRatio==null) continue;
    const key=[p.platform,p.window,p.hskLevel,p.durationBand,p.hookFormat].join('|');
    if(!cohorts.has(key)) cohorts.set(key,[]);
    cohorts.get(key).push(p);
  }
  const comparableGroups=[...cohorts].map(([key,group])=>{
    const eligible=group.filter(p=>p.views!=null&&p.views>=(policy.minimumViewsPerPost??500));
    const ratios=eligible.map(p=>p.averageWatchRatio).sort((a,b)=>a-b);
    const n=ratios.length;const median=n?(n%2?ratios[(n-1)/2]:(ratios[n/2-1]+ratios[n/2])/2):null;
    return {key,postCount:n,medianWatchRatio:median,readiness:n>=(policy.minimumPostsPerFormat??3)?'descriptive-only-owner-review':'insufficient-sample'};
  });
  const caveats=[];
  if(posts.some(p=>p.window==='lifetime')) caveats.push('Lifetime metrics have unequal post ages: not a controlled retention or hook comparison.');
  if(posts.some(p=>p.episodeId==null||p.hookFormat==null||p.hskLevel==null)) caveats.push('Missing verified post-to-episode/format/HSK matching: do not attribute a result to a creative choice.');
  if(!posts.length) caveats.push('Unmeasured is not zero. No analytics observations.');
  return {
    schemaVersion:1,observationCount:observations.length,distinctPostWindows:posts.length,posts,
    comparableGroups,decision:'no-automatic-winner',caveats,
    nextActions:['Test a single opening or edit variable, not several at once.','Keep CTA and publishing owner-approval gates unchanged.']
  };
}
export function loadObservations(dir=path.join(root,'content/feedback/observations')){
  if(!fs.existsSync(dir)) return [];
  const results=[];
  for(const f of fs.readdirSync(dir).filter(v=>v.endsWith('.json')).sort()){
    results.push(...validateDataset(JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))));
  }
  return results;
}
export function runCli(args=process.argv.slice(2)){
  if(args.some(x=>x!=='--json')) throw Error('Unknown command option; only --json supported');
  const policy=JSON.parse(fs.readFileSync(path.join(root,'content/hook-lab.json'),'utf8')).policy;
  const result=analyzeObservations(loadObservations(),policy);
  if(args.includes('--json')) console.log(JSON.stringify(result,null,2));
  else {
    console.log('Zernio: '+result.observationCount+' observations, '+result.distinctPostWindows+' post/windows');
    for(const p of result.posts) console.log(p.platform+' '+p.postId+' '+p.window+' views='+p.views+' watchRatio='+p.averageWatchRatio+' skip='+p.skipRatePercent);
    for(const note of result.caveats) console.log('CAUTION: '+note);
    console.log('Decision: '+result.decision);
  }
  return 0;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{process.exitCode=runCli();}catch(error){console.error('Invalid feedback: '+error.message);process.exitCode=1;}
}
