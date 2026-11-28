// Read-only threshold discovery. Never substitutes for an exact-window A/B result.
import {validatePublicationMapping} from './content-attribution.mjs';
import {validateObservation} from './feedback-analyzer.mjs';
import {nextFullCalendarWeek, addCalendarDays, expectedContentSlot} from './content-schedule.mjs';

const HOUR = 3600000;
const formatPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const key = (...parts) => JSON.stringify(parts);
const timestamp = value => typeof value === 'string' ? Date.parse(value) : NaN;
const same = (a,b) => a?.id===b?.id && a?.type===b?.type &&
  a?.language===b?.language && a?.sourceHash===b?.sourceHash;

export function evaluateDiscovery({observations, publications, destinations, policy, asOf=new Date()}) {
  const cutoff=+asOf;
  const {minimumViews,minimumAgeHours}=policy;
  if(!Number.isFinite(cutoff)||!Number.isSafeInteger(minimumViews)||minimumViews<1||
      !Number.isFinite(minimumAgeHours)||minimumAgeHours<1) throw Error('Invalid discovery policy or cutoff');
  const expected = Object.fromEntries(Object.entries(destinations.videoDestinations).map(([lang,entry])=>
    [lang,Object.entries(entry.platforms).filter(([,p])=>p.zernioPublishingAuthorized===true)
      .map(([platform,p])=>({platform,accountId:p.verifiedAccountId}))]));
  const eligible = publications.filter(p=>p.content?.type==='lesson'&&p.status==='published'&&
    timestamp(p.publishedAt)<=cutoff&&timestamp(p.verifiedAt)<=cutoff&&validatePublicationMapping(p).length===0);
  const index=new Map();
  for(const p of eligible) for(const [kind,id] of [['z',p.zernioPostId],['n',p.platformPostId]]) {
    if(!id)continue;
    const k=key(p.platform,p.accountId,kind,id);
    if(index.has(k)) throw Error('Duplicate discovery publication identity '+k);
    index.set(k,p);
  }
  const matched=new Map(), unattributed=[];
  for(const o of observations) {
    if(timestamp(o?.observedAt)>cutoff||timestamp(o?.collectedAt)>cutoff||validateObservation(o).length)continue;
    const a=index.get(key(o.platform,o.accountId,'z',o.zernioPostId));
    const b=index.get(key(o.platform,o.accountId,'n',o.platformPostId));
    const p=a??b;
    const conflict=(a&&b&&a!==b)||(p?.platformPostId&&o.platformPostId!==p.platformPostId)||
      (p?.zernioPostId&&o.zernioPostId&&p.zernioPostId!==o.zernioPostId)||
      (p&&Math.abs(timestamp(o.publishedAt)-timestamp(p.publishedAt))>60000)||(p&&o.content&&!same(p.content,o.content))||(p&&o.videoSha256&&p.videoSha256!==o.videoSha256);
    if(!p||conflict) {
      if(o.metrics.views>=minimumViews)unattributed.push({platform:o.platform,accountId:o.accountId,
        platformPostId:o.platformPostId,views:o.metrics.views,observedAt:o.observedAt,postUrl:o.postUrl??null,
        reason:conflict?'identity-conflict':'no-verified-lesson-receipt'});
      continue;
    }
    if(o.window!=='lifetime'||o.metrics.views===null||o.source.syncStatus==='pending'||o.source.syncStatus==='unavailable')continue;
    const observed=timestamp(o.observedAt), synced=timestamp(o.source.syncedAt);
    const perPost=timestamp(o.source.providerMetricUpdatedAt);
    // A dashboard timestamp is a weaker proxy, never an exact post-age window.
    const measured=Number.isFinite(perPost)?Math.min(observed,perPost):Math.min(observed,synced);
    if(!Number.isFinite(measured)||measured>cutoff||measured<timestamp(p.publishedAt))continue;
    const row={views:o.metrics.views,observedAt:o.observedAt,ageHours:(measured-timestamp(p.publishedAt))/HOUR,
      timestampKind:Number.isFinite(perPost)?'provider-post-update':'dashboard-or-sync-proxy',
      evidenceWindow:'lifetime',postUrl:o.postUrl??p.platformPostUrl??null};
    if(!matched.has(p))matched.set(p,[]);
    matched.get(p).push(row);
  }
  const attempts=new Map();
  for(const p of eligible) {
    const lang=p.content.language;
    const target=expected[lang]?.find(t=>t.platform===p.platform&&t.accountId===p.accountId);
    if(!target)continue;
    // Only a prospectively registered specific family is actionable. Legacy
    // experiment arms stay visible as diagnostic families; never infer from title.
    const explicit=p.creative?.discoveryFormatId;
    const legacy=p.creative?.experimentId&&p.creative?.arm?
      'legacy:'+p.creative.experimentId+':'+p.creative.arm:null;
    const family=formatPattern.test(explicit??'')?explicit:legacy;
    if(!family)continue;
    const k=key(lang,p.content.id);
    let a=attempts.get(k);
    if(!a){a={contentId:p.content.id,language:lang,family,actionable:family===explicit,
      publishedAt:p.publishedAt,platforms:{}};attempts.set(k,a);}
    if(a.family!==family||a.platforms[p.platform]) {
      a.conflict=true;continue;
    }
    if(timestamp(p.publishedAt)<timestamp(a.publishedAt))a.publishedAt=p.publishedAt;
    const readings=(matched.get(p)??[]).sort((a,b)=>timestamp(a.observedAt)-timestamp(b.observedAt));
    const first=readings.find(x=>x.ageHours>=minimumAgeHours)??null;
    const laterHit=first&&readings.find(x=>x.ageHours>=minimumAgeHours&&x.views>=minimumViews);
    a.platforms[p.platform]={status:!first?'pending':laterHit?'hit':'miss',first,hit:laterHit??null};
  }
  const groups=new Map();
  for(const a of attempts.values()){
    if(a.conflict)continue;
    for(const {platform} of expected[a.language])a.platforms[platform]??={status:'pending',first:null,hit:null};
    const values=Object.values(a.platforms);
    a.hitCount=values.filter(v=>v.status==='hit').length;
    a.complete=values.length>0&&values.every(v=>v.status!=='pending');
    const k=key(a.language,a.family);
    if(!groups.has(k))groups.set(k,{language:a.language,family:a.family,actionable:a.actionable,attempts:[]});
    groups.get(k).attempts.push(a);
  }
  const families=[...groups.values()].map(g=>{
    g.attempts.sort((a,b)=>timestamp(a.publishedAt)-timestamp(b.publishedAt)||a.contentId.localeCompare(b.contentId));
    const complete=g.attempts.filter(a=>a.complete);
    const wins=g.attempts.filter(a=>a.hitCount>0);
    const platforms=Object.fromEntries(expected[g.language].map(({platform})=>[platform,{
      hits:g.attempts.filter(a=>a.platforms[platform].status==='hit').length,
      misses:g.attempts.filter(a=>a.platforms[platform].status==='miss').length,
      pending:g.attempts.filter(a=>a.platforms[platform].status==='pending').length}]));
    let state='pending';
    if(Object.values(platforms).some(p=>p.hits>=2))state='repeat-hit';
    else if(wins.length>=2)state='cross-platform-hit';
    else if(complete.length>=2)state=wins.length?'platform-hit':'retired';
    else if(g.attempts.length===1&&(g.attempts[0].complete||wins.length))state=g.attempts[0].hitCount>=2?'multi-platform-hit':'retry';
    // One confirmed hit can trigger a retry despite missing other platforms.
    // A second already published attempt must not be scheduled again while pending.
    const nextAction=(g.attempts.length>=2&&g.attempts.some(a=>!a.complete)&&state!=='repeat-hit')?'await-existing-attempt':
      state==='retry'?'retry-new-topic':state==='retired'?'exclude':state==='pending'?'await-data':'replicate';
    return {...g,state,nextAction,platforms};
  }).sort((a,b)=>a.language.localeCompare(b.language)||a.family.localeCompare(b.family));
  // Multiple snapshots of the same unlinked hit are a diagnostic, not trials.
  const unknown=new Map();
  for(const o of unattributed){const k=key(o.platform,o.accountId,o.platformPostId);if(!unknown.has(k)||timestamp(unknown.get(k).observedAt)<timestamp(o.observedAt))unknown.set(k,o);}
  return {mode:'shadow-read-only',asOf:new Date(cutoff).toISOString(),minimumViews,minimumAgeHours,
    families,unattributedHits:[...unknown.values()],publicationAuthorized:false,assignmentAuthorized:false};
}

/** Frozen weekly decision cutoff is Sunday 08:00 Asia/Shanghai (00:00 UTC).
 * A pre-Sunday preview can only use evidence already available. */
export function discoveryWeekCutoff(today, now=new Date()) {
  const week=nextFullCalendarWeek(today);
  return { ...week, cutoff:new Date(Math.min(+now,Date.parse(week.anchorDate+'T00:00:00Z'))) };
}

export function validateDiscoveryFamilies(registry) {
  const families=registry?.discoveryFamilies;
  if(!Array.isArray(families)||!families.length)throw Error('Missing discovery families');
  const seen=new Set();
  for(const f of families){
    if(!formatPattern.test(f.id??'')||seen.has(f.id)||!['question','contrast','scenario'].includes(f.hookFormat)||
       typeof f.brief!=='string'||!f.brief.trim())throw Error('Invalid or duplicate discovery family '+f.id);
    seen.add(f.id);
  }
  return families;
}

/** Read-only Sunday brief. One shared family per lesson preserves the RU/TG
 * translation contract. Outcomes and eligibility remain language/platform-specific.
 * No extra slots, no writes, no waiting for pending families. */
export function planDiscoveryWeek({calendar,registry,discovery,publications=[],today,now=new Date()}) {
  const families=validateDiscoveryFamilies(registry);
  const week=discoveryWeekCutoff(today,now);
  if(timestamp(discovery.asOf)>+week.cutoff)throw Error('Discovery contains evidence after weekly cutoff');
  const existing=new Map((calendar.items??[]).filter(i=>i.date>=week.startDate&&i.date<=week.endDate).map(i=>[i.date,i]));
  const booked=new Set([...existing.values()].map(i=>i.discoveryFormatId).filter(Boolean));
  for(const p of publications)if(['scheduled','processing'].includes(p.status)&&p.content?.type==='lesson'&&p.creative?.discoveryFormatId)booked.add(p.creative.discoveryFormatId);
  const byFamily=new Map(families.map(f=>[f.id,discovery.families.filter(g=>g.actionable&&g.family===f.id)]));
  const classify=f=>{
    const groups=byFamily.get(f.id);
    const canRetry=groups.some(g=>g.nextAction==='retry-new-topic');
    const canRepeat=groups.some(g=>g.nextAction==='replicate');
    const pending=groups.some(g=>['await-existing-attempt','await-data'].includes(g.nextAction));
    const peak=Math.max(0,...groups.flatMap(g=>g.attempts.flatMap(a=>Object.values(a.platforms).map(p=>p.hit?.views??0))));
    const rank=Math.max(0,...groups.map(g=>g.state==='repeat-hit'?4:g.state==='cross-platform-hit'?3:g.state==='multi-platform-hit'?2:g.state==='platform-hit'?1:0));
    return {f,groups,canRetry,canRepeat,pending,peak,rank};
  };
  const entries=families.map(classify);
  const slots=Array.from({length:7},(_,i)=>expectedContentSlot(calendar,addCalendarDays(week.startDate,i)));
  if(slots.some(s=>!s))throw Error('Weekly discovery requires the canonical typed schedule');
  const sortWins=(a,b)=>b.rank-a.rank||b.peak-a.peak||a.f.id.localeCompare(b.f.id);
  const sortRetries=(a,b)=>b.peak-a.peak||a.f.id.localeCompare(b.f.id);
  const queues={replicate:entries.filter(e=>e.canRepeat).sort(sortWins),retry:entries.filter(e=>e.canRetry).sort(sortRetries),explore:entries.filter(e=>!e.groups.length)};
  const desired=['replicate','retry','explore'];
  let lessonIndex=0;
  const result=slots.map(slot=>{
    const old=existing.get(slot.date);
    if(slot.contentType!=='lesson')return {...slot,action:'unchanged',contentId:old?.id??null};
    const preferred=desired[lessonIndex++%desired.length];
    if(old)return {...slot,action:'preserve-existing',contentId:old.id,discoveryFormatId:old.discoveryFormatId??null};
    // Prioritize an actually available lane; never wait or reuse a retired family.
    const order=[...new Set([preferred,'explore','retry','replicate'])];
    for(const lane of order){
      const pick=queues[lane].find(e=>!booked.has(e.f.id));
      if(!pick)continue;
      booked.add(pick.f.id);
      return {...slot,action:lane,discoveryFormatId:pick.f.id,hookFormat:pick.f.hookFormat,brief:pick.f.brief,
        localeEvidence:pick.groups.map(g=>({language:g.language,state:g.state,nextAction:g.nextAction,platforms:g.platforms})),
        note:'Same family in both language drafts; a new topic, not a recut. No claim of a causal winner.'};
    }
    return {...slot,action:'author-new-family',discoveryFormatId:null,
      note:'All eligible registered families are booked, pending or retired. Propose a genuinely distinct source-grounded family; do not block production or reuse a retired one.'};
  });
  return {mode:'shadow-read-only',weekStart:week.startDate,weekEnd:week.endDate,cutoff:week.cutoff.toISOString(),slots:result,
    assignmentAuthorized:false,publicationAuthorized:false};
}
