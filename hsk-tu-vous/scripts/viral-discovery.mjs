// Read-only threshold discovery. Never substitutes for an exact-window A/B result.
import {validatePublicationMapping} from './content-attribution.mjs';
import {validateObservation} from './feedback-analyzer.mjs';
import {nextFullCalendarWeek, addCalendarDays, expectedContentSlot, calendarWeekday, contentTypeOf} from './content-schedule.mjs';
import fs from 'node:fs';
import path from 'node:path';

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
    const peak=readings.filter(x=>x.ageHours>=minimumAgeHours).sort((a,b)=>b.views-a.views||timestamp(a.observedAt)-timestamp(b.observedAt))[0]??null;
    a.platforms[p.platform]={status:!first?'pending':laterHit?'hit':'miss',first,hit:laterHit??null,peak};
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
    else if(g.attempts.length===1&&Object.values(g.attempts[0].platforms).some(p=>p.status!=='pending'))state=g.attempts[0].hitCount>=2?'multi-platform-hit':'retry';
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
  for(const old of calendar.discoveryWeeks??[])if(old.weekStart<week.startDate&&old.weekEnd>=addCalendarDays(week.startDate,-7)){
    for(const slot of old.slots??[])if(slot.discoveryFormatId&&!publications.some(p=>p.status==='published'&&p.creative?.discoveryFormatId===slot.discoveryFormatId&&calendar.items.some(i=>i.date===slot.date&&i.id===p.content?.id)))booked.add(slot.discoveryFormatId);
  }
  for(const p of publications)if(['scheduled','processing'].includes(p.status)&&p.content?.type==='lesson'&&p.creative?.discoveryFormatId)booked.add(p.creative.discoveryFormatId);
  const byFamily=new Map(families.map(f=>[f.id,discovery.families.filter(g=>g.actionable&&g.family===f.id)]));
  const classify=f=>{
    const groups=byFamily.get(f.id);
    const canRetry=groups.some(g=>g.nextAction==='retry-new-topic');
    const canRepeat=groups.some(g=>g.nextAction==='replicate');
    const pending=groups.some(g=>['await-existing-attempt','await-data'].includes(g.nextAction));
    const peak=Math.max(0,...groups.flatMap(g=>g.attempts.flatMap(a=>Object.values(a.platforms).map(p=>p.peak?.views??p.hit?.views??0))));
    const rank=Math.max(0,...groups.map(g=>g.state==='repeat-hit'?4:g.state==='cross-platform-hit'?3:g.state==='multi-platform-hit'?2:g.state==='platform-hit'?1:0));
    return {f,groups,canRetry,canRepeat,pending,peak,rank};
  };
  const entries=families.map(classify);
  // Historical reports before the typed calendar remain valid; never invent slots.
  if(calendar.weeklySchedule&&week.startDate<calendar.weeklySchedule.effectiveFromDate)return {
    mode:'shadow-read-only',weekStart:week.startDate,weekEnd:week.endDate,cutoff:week.cutoff.toISOString(),slots:[],
    status:'before-typed-calendar',assignmentAuthorized:false,publicationAuthorized:false};
  const slots=Array.from({length:7},(_,i)=>expectedContentSlot(calendar,addCalendarDays(week.startDate,i)));
  if(slots.some(s=>!s))throw Error('Weekly discovery requires the canonical typed schedule');
  const tier=views=>views>=100000?4:views>=50000?3:views>=10000?2:views>=3000?1:0;
  const sortWins=(a,b)=>tier(b.peak)-tier(a.peak)||b.rank-a.rank||b.peak-a.peak||a.f.id.localeCompare(b.f.id);
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

export function discoveryApplies(policy,item){
 return policy?.enabled===true&&policy.mode==='active'&&contentTypeOf(item)==='lesson'&&item.date>=policy.activeFrom;
}
export function readDiscoveryRules(root){
 const file=path.join(root,'content/hook-lab.json');
 if(!fs.existsSync(file))return null;
 const policy=JSON.parse(fs.readFileSync(file,'utf8')).policy?.discoveryPilot;
 if(policy?.mode!=='active'||!policy.enabled)return null;
 const read=name=>JSON.parse(fs.readFileSync(path.join(root,'content',name),'utf8'));
 return {policy,calendar:read('calendar.json'),registry:read('creative-formats.json')};
}
export function validateDiscoveryCalendar(calendar,registry){
 const families=new Map(validateDiscoveryFamilies(registry).map(f=>[f.id,f]));
 const seen=new Set();
 if(calendar.discoveryWeeks!==undefined&&!Array.isArray(calendar.discoveryWeeks))throw Error('discoveryWeeks must be an array');
 for(const record of calendar.discoveryWeeks??[]){
   if(calendarWeekday(record.weekStart)!=='MO'||seen.has(record.weekStart)||record.weekEnd!==addCalendarDays(record.weekStart,6)||
      record.cutoff!==addCalendarDays(record.weekStart,-1)+'T00:00:00.000Z'||!Array.isArray(record.slots)||record.slots.length!==7)
      throw Error('Invalid or duplicate frozen discovery week '+record.weekStart);
   seen.add(record.weekStart);
   const used=new Set();
   for(const [i,s] of record.slots.entries()){
     const date=addCalendarDays(record.weekStart,i);
     const expected=expectedContentSlot(calendar,date);
     if(s.date!==date||s.contentType!==expected?.contentType)throw Error('Discovery slot conflicts with calendar '+date);
     if(s.contentType!=='lesson'){
       if(s.action!=='unchanged'||s.discoveryFormatId!=null)throw Error('Discovery cannot assign ads or series '+date);
       continue;
     }
     if(s.action==='preserve-existing'){
       if(!s.contentId||!calendar.items.some(x=>x.date===date&&x.id===s.contentId))throw Error('Preserved source must already exist '+date);
       continue;
     }
     const family=families.get(s.discoveryFormatId);
     if(!['explore','retry','replicate'].includes(s.action)||!family||family.hookFormat!==s.hookFormat||used.has(family.id))
       throw Error('Invalid or duplicate lesson family '+date);
     used.add(family.id);
   }
 }
 return true;
}
export function makeDiscoveryFreezeRecord(plan,{calendar,registry,policy,now=new Date()}){
 if(!policy?.enabled||policy.mode!=='active'||plan.weekStart<policy.activeFrom)return null;
 const cutoff=addCalendarDays(plan.weekStart,-1)+'T00:00:00.000Z';
 if(+now<timestamp(cutoff)||plan.cutoff!==cutoff||plan.slots.length!==7)return null;
 if(plan.slots.some(s=>s.action==='author-new-family'))return null;
 const record={weekStart:plan.weekStart,weekEnd:plan.weekEnd,cutoff,
   slots:plan.slots.map(s=>({date:s.date,contentType:s.contentType,action:s.action,
     ...(s.contentType==='lesson'?{discoveryFormatId:s.discoveryFormatId??null,hookFormat:s.hookFormat??null,
       ...(s.action==='preserve-existing'?{contentId:s.contentId}:{})}:{} )}))};
 validateDiscoveryCalendar({...calendar,discoveryWeeks:[...(calendar.discoveryWeeks??[]),record]},registry);
 return record;
}
export function freezeDiscoveryCalendar(calendar,record,registry){
 const existing=(calendar.discoveryWeeks??[]).find(w=>w.weekStart===record?.weekStart);
 if(existing){if(JSON.stringify(existing)!==JSON.stringify(record))throw Error('Discovery week is already frozen; no reassignment');return calendar;}
 if(!record)throw Error('No freeze record: use the actual Sunday cutoff and add a new family if needed');
 const next={...calendar,discoveryWeeks:[...(calendar.discoveryWeeks??[]),record].sort((a,b)=>a.weekStart.localeCompare(b.weekStart))};
 validateDiscoveryCalendar(next,registry);
 return next;
}
export function discoveryDraftErrors(rules,item,source){
 if(!rules||!discoveryApplies(rules.policy,item))return [];
 const slot=rules.calendar.discoveryWeeks?.flatMap(w=>w.slots).find(s=>s.date===item.date);
 if(!slot)return ['Discovery: freeze the weekly calendar assignment before authoring '+item.date];
 if(slot.action==='preserve-existing')return slot.contentId===item.id?[]:['Discovery: preserved content identity changed'];
 const family=validateDiscoveryFamilies(rules.registry).find(f=>f.id===slot.discoveryFormatId);
 if(!family||source?.hookExperiment?.discoveryFormatId!==family.id||source?.hookExperiment?.formatId!==family.hookFormat)
   return ['Discovery: '+item.id+' must carry the frozen family '+slot.discoveryFormatId+' and Hook format '+slot.hookFormat];
 if(source.experiment?.id==='lesson-opening-v1')return ['Discovery: new lesson must not carry the retired lesson A/B arm'];
 return [];
}

/** Existing dated authoring interfaces also expose the new frozen family. */
export function discoveryBrief(rules,item){
 if(!rules||!discoveryApplies(rules.policy,item))return null;
 const slot=rules.calendar.discoveryWeeks?.flatMap(w=>w.slots).find(s=>s.date===item.date);
 if(!slot)return 'Discovery: no frozen assignment. Read the weekly plan and freeze the week before authoring.';
 if(slot.action==='preserve-existing')return 'Discovery: preserve existing source '+slot.contentId+'; no new assignment.';
 const family=validateDiscoveryFamilies(rules.registry).find(f=>f.id===slot.discoveryFormatId);
 if(!family)throw Error('Unknown frozen family '+slot.discoveryFormatId);
 return 'Discovery '+slot.action+' — '+family.id+' ('+family.hookFormat+'): '+family.brief+'; author a new verified topic in both locales with the frozen family ID.';
}
