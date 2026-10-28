import {validateContentIdentity,applyPublicationMappings} from './content-attribution.mjs';
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
  if(!['instagram','tiktok','youtube'].includes(o.platform)) errors.push('invalid platform');
  if(typeof o.platformPostId!=='string' || !/^[a-zA-Z0-9_-]{6,100}$/.test(o.platformPostId)) errors.push('invalid platformPostId');
  if(typeof o.accountUsername!=='string' || !o.accountUsername.trim()) errors.push('missing accountUsername');
  if(!iso(o.publishedAt)||!iso(o.observedAt)) errors.push('invalid timestamps');
  if(iso(o.publishedAt)&&iso(o.observedAt)&&Date.parse(o.publishedAt)>Date.parse(o.observedAt)) errors.push('observation precedes publication');
  if(!windows.has(o.window)) errors.push('invalid window');
  // Post age is necessary but NOT proof of a fixed-age metric window.
  // Zernio lifetime and calendar-day timeline data must never pass as 24h/7d.
  const ageRequiredHours = {'24h':24,'72h':72,'7d':168}[o.window];
  if (ageRequiredHours) {
    const evidence = o.source?.windowEvidence;
    if (iso(o.publishedAt) && iso(o.observedAt) &&
        Date.parse(o.observedAt)-Date.parse(o.publishedAt)<ageRequiredHours*3600000)
      errors.push('window '+o.window+' claimed before required post age');
    if (!evidence || evidence.kind !== 'provider-exact-post-age' ||
        evidence.window !== o.window || !iso(evidence.startAt) || !iso(evidence.endAt) ||
        typeof evidence.providerRecordId !== 'string' || !evidence.providerRecordId.trim() ||
        (iso(o.publishedAt) && Date.parse(evidence.startAt) !== Date.parse(o.publishedAt)) ||
        (iso(evidence.startAt) && iso(evidence.endAt) &&
         Date.parse(evidence.endAt)-Date.parse(evidence.startAt)!==ageRequiredHours*3600000) ||
        (iso(o.observedAt) && iso(evidence.endAt) &&
         Date.parse(evidence.endAt)>Date.parse(o.observedAt)) ||
        ['analytics_get_analytics','analytics_get_daily_metrics','analytics_get_post_timeline','posts_list']
          .includes(o.source?.endpoint)) {
      errors.push('missing exact provider-fixed-window evidence (lifetime or calendar-day totals are not 24h/7d)');
    }
  }
  if(o.source?.provider!=='Zernio'||!iso(o.source?.syncedAt)||!o.source?.endpoint) errors.push('missing Zernio provenance');
  if(o.postUrl!=null && (typeof o.postUrl!=='string'||!/^https:\/\/(www\.)?(instagram\.com|tiktok\.com|youtube\.com)\//.test(o.postUrl))) errors.push('invalid postUrl');
  if(o.episodeId!=null && (typeof o.episodeId!=='string'||!/^[a-z0-9-]+$/.test(o.episodeId))) errors.push('invalid episodeId');
  if(o.content!=null) {
    errors.push(...validateContentIdentity(o.content));
    if(o.episodeId && o.content.id!==o.episodeId)errors.push('content ID conflicts with episodeId');
  }
  if(o.hookFormat!=null && !['question','contrast','scenario'].includes(o.hookFormat)) errors.push('invalid hookFormat');
  if(o.hskLevel!=null && (typeof o.hskLevel!=='string'||!/^HSK\s*[1-6](?:\s*[-–]\s*[1-6])?$/.test(o.hskLevel))) errors.push('invalid hskLevel');
  if(o.effectStyle!=null && (typeof o.effectStyle!=='string'||o.effectStyle.length>80)) errors.push('invalid effectStyle');
  if(o.creativeFormatId!=null && (!/^[a-z][a-z0-9-]{2,80}$/.test(o.creativeFormatId) || (!o.episodeId || !o.hookFormat || !o.hskLevel) && o.content?.type!=='advertisement'))
    errors.push('creativeFormatId requires valid ID and verified episode/hook/HSK mapping');
  if(o.storytellingPattern!=null && (!['direct','single-rehook','layered'].includes(o.storytellingPattern) ||
      !o.episodeId || !o.hookFormat || !o.hskLevel || !o.creativeFormatId))
    errors.push('storytellingPattern requires a verified episode, hook, HSK and creative format attribution');
  for(const name of fields){
    const v=o.metrics?.[name];
    // YouTube's provider omits reach and skip rate entirely; preserve them
    // as unknown rather than manufacturing zeros or rejecting sourced posts.
    const absent = !Object.hasOwn(o.metrics || {}, name);
    const optionalYouTube = o.platform === 'youtube' && ['reach','skipRatePercent'].includes(name);
    if ((absent && !optionalYouTube) || (!absent && !(v===null || (typeof v==='number' && Number.isFinite(v) && v>=0)))) errors.push('invalid metric '+name);
    if(!absent && ['views','reach','likes','comments','saves','shares'].includes(name) && v!==null && !Number.isInteger(v)) errors.push('count not integer: '+name);
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
    platform:o.platform,accountUsername:o.accountUsername,postId:o.platformPostId,episodeId:o.episodeId,
    contentId:o.content?.id??o.episodeId??null,contentType:o.content?.type??'legacy-unverified',
    language:o.content?.language??'ru',series:o.content?.series??null,sourceHash:o.content?.sourceHash??null,
    hookFormat:o.hookFormat,hskLevel:o.hskLevel,creativeFormatId:o.creativeFormatId??null,
    storytellingPattern:o.storytellingPattern??null,window:o.window,
    observedAt:o.observedAt,publishedAt:o.publishedAt,
    durationBand:durationBand(durationSeconds),views,skipRatePercent:skipRatePercent??null,
    averageWatchSeconds:avgWatchMs==null?null:+(avgWatchMs/1000).toFixed(3),
    averageWatchRatio:avgWatchMs==null||!durationSeconds?null:+(avgWatchMs/1000/durationSeconds).toFixed(4),
    savesPer1000Views:saves==null||!views?null:+(1000*saves/views).toFixed(2),
    sharesPer1000Views:shares==null||!views?null:+(1000*shares/views).toFixed(2)
  };
}
export function analyzeObservations(observations,policy={}, {asOf = new Date()} = {}){
  const lookbackDays=policy.analysisLookbackDays??30;
  const earlyWindow=policy.earlySignalWindow??'24h';
  const primaryWindow=policy.primaryDecisionWindow??'7d';
  const asOfDate=asOf instanceof Date?asOf:new Date(asOf);
  if(Number.isNaN(asOfDate.valueOf()))throw Error('Invalid analysis asOf timestamp');
  if(!Number.isSafeInteger(lookbackDays)||lookbackDays<1||lookbackDays>365)
    throw Error('Invalid analysisLookbackDays');
  if(!windows.has(earlyWindow)||!windows.has(primaryWindow)||
      earlyWindow==='lifetime'||primaryWindow==='lifetime'||earlyWindow===primaryWindow)
    throw Error('Invalid analysis windows');
  const cutoffMs=asOfDate.valueOf()-lookbackDays*86400000;
  const latest=new Map();
  let observationsAfterAsOf=0;
  for(const o of observations){
    const errors=validateObservation(o); if(errors.length) throw Error(errors.join('; '));
    if(Date.parse(o.observedAt)>asOfDate.valueOf()) {observationsAfterAsOf++;continue;}
    const key=[o.platform,o.accountUsername,o.platformPostId,o.window].join('/');
    if(!latest.has(key)||latest.get(key).observedAt<o.observedAt) latest.set(key,o);
  }
  const allPosts=[...latest.values()].map(deriveMetrics);
  // Use PUBLICATION time, never collection time, to select the recent cohort.
  const posts=allPosts.filter(p=>
    Date.parse(p.publishedAt)>=cutoffMs &&
    Date.parse(p.publishedAt)<=asOfDate.valueOf()
  ).sort((a,b)=>a.postId.localeCompare(b.postId));
  const historicalPostWindowsExcluded=allPosts.length-posts.length;
  const cohorts=new Map();
  for(const p of posts){
    // 24h is an early signal; ONLY provider-grounded 7d evidence can be
    // considered the primary comparable cohort. Lifetime/72h never substitute.
    if(![earlyWindow,primaryWindow].includes(p.window) ||
        !(p.contentType==='advertisement' ? p.contentId && p.creativeFormatId : p.episodeId && p.hookFormat && p.hskLevel) ||
        p.averageWatchRatio==null) continue;
    const key=[p.platform,p.accountUsername,p.language,p.contentType,p.series?.part??'standalone',p.window,p.hskLevel??'not-applicable',p.durationBand,p.hookFormat??'not-applicable',
      p.creativeFormatId??'creative-unverified',p.storytellingPattern??'storytelling-unverified'].join('|');
    if(!cohorts.has(key)) cohorts.set(key,[]);
    cohorts.get(key).push(p);
  }
  const comparableGroups=[...cohorts].map(([key,group])=>{
    const eligible=group.filter(p=>p.views!=null&&p.views>=(policy.minimumViewsPerPost??500));
    const ratios=eligible.map(p=>p.averageWatchRatio).sort((a,b)=>a-b);
    const n=ratios.length;
    const median=n?(n%2?ratios[(n-1)/2]:(ratios[n/2-1]+ratios[n/2])/2):null;
    const phase=group[0].window===primaryWindow?'primary':'early';
    const readiness=n<(policy.minimumPostsPerFormat??3)?
      'insufficient-sample':phase==='early'?'early-signal-only':'descriptive-only-owner-review';
    return {key,window:group[0].window,phase,postCount:n,medianWatchRatio:median,readiness};
  });
  const caveats=[];
  if(posts.some(p=>p.window==='lifetime'))
    caveats.push('Lifetime metrics have unequal post ages: never a controlled 24h/7d comparison.');
  if(posts.some(p=>p.episodeId==null||p.hookFormat==null||p.hskLevel==null))
    caveats.push('Unverified episode/hook/HSK attribution; do not infer creative effectiveness from these posts.');
  if(posts.some(p=>p.creativeFormatId==null))
    caveats.push('Some creative formats are unverified; do not pool them with an attributed visual treatment.');
  if(!comparableGroups.some(p=>p.phase==='primary'&&p.readiness==='descriptive-only-owner-review'))
    caveats.push('No eligible primary 7d cohort: insufficient evidence for adopting a performance-led script change.');
  if(!posts.length) caveats.push('Unmeasured is not zero. No analytics observations in the rolling window.');
  if(observationsAfterAsOf) caveats.push('Snapshots collected after asOf were omitted from this historical analysis.');
  return {
    schemaVersion:1,
    analysisWindow:{publishedLookbackDays:lookbackDays,asOf:asOfDate.toISOString(),
      publicationCutoff:new Date(cutoffMs).toISOString(),earlySignalWindow:earlyWindow,
      primaryDecisionWindow:primaryWindow},
    observationCount:observations.length,
    recentPostWindows:posts.length,
    historicalPostWindowsExcluded,
    futureSnapshotsExcluded:observationsAfterAsOf,
    distinctPostWindows:posts.length,
    posts,comparableGroups,
    performanceChangeEvidence:comparableGroups.some(p=>p.phase==='primary'&&p.readiness==='descriptive-only-owner-review')?'owner-review-required':'insufficient-evidence',
    decision:'no-automatic-winner',
    caveats,
    nextActions:['Use grounded 24h data only as a preliminary signal; require actual 7d window for primary decisions.',
      'Hand off a testable proposed change to Calendar Reserve after owner review; Feedback must not edit scripts or calendars.',
      'Keep CTA, approved/published snapshots and publishing owner-approval gates unchanged.']
  };
}
export function loadObservations(dir=path.join(root,'content/feedback/observations')){
  if(!fs.existsSync(dir)) return [];
  const results=[];
  for(const f of fs.readdirSync(dir).filter(v=>v.endsWith('.json')).sort()){
    results.push(...validateDataset(JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'))));
  }
  const receipt=path.join(dir,'../publications.json');
  if(!fs.existsSync(receipt))return results;
  const registry=JSON.parse(fs.readFileSync(receipt,'utf8'));
  if(registry.schemaVersion!==1||!Array.isArray(registry.records))throw Error('Invalid publication registry');
  return applyPublicationMappings(results,registry.records);
}
export function runCli(args=process.argv.slice(2)){
  if(args.some(x=>x!=='--json')) throw Error('Unknown command option; only --json supported');
  const policy=JSON.parse(fs.readFileSync(path.join(root,'content/hook-lab.json'),'utf8')).policy;
  const result=analyzeObservations(loadObservations(),policy);
  if(args.includes('--json')) console.log(JSON.stringify(result,null,2));
  else {
    console.log('Zernio: last '+result.analysisWindow.publishedLookbackDays+' days; '+result.recentPostWindows+' recent post/windows; '+result.historicalPostWindowsExcluded+' historical windows excluded');
    for(const p of result.posts) console.log(p.platform+' '+p.postId+' '+p.window+' views='+p.views+' watchRatio='+p.averageWatchRatio+' skip='+p.skipRatePercent);
    for(const note of result.caveats) console.log('CAUTION: '+note);
    console.log('Evidence: '+result.performanceChangeEvidence+'; decision: '+result.decision);
  }
  return 0;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{process.exitCode=runCli();}catch(error){console.error('Invalid feedback: '+error.message);process.exitCode=1;}
}
