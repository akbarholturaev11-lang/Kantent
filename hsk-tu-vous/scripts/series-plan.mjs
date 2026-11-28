import {expectedContentSlot} from './content-schedule.mjs';
import {validatePublicationMapping} from './content-attribution.mjs';
import {validateObservation} from './feedback-analyzer.mjs';
import fs from 'node:fs';
import path from 'node:path';
const weekdays = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function dateValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) throw Error('Expected a real YYYY-MM-DD date');
  const date = new Date(value + 'T12:00:00Z');
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value)
    throw Error('Invalid calendar date ' + value);
  return date;
}

function addDays(value, days) {
  const date = dateValue(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function requirePolicy(calendar) {
  const policy = calendar.seriesPolicy;
  if (policy?.schemaVersion !== 1 || policy.continuationGapDays !== 1 ||
      policy.allowContinuationOutsidePlanningWeekdays !== true || policy.requireCompleteDraftSet !== true)
    throw Error('Invalid calendar.seriesPolicy: consecutive-day continuations and a complete draft set are required');
  return policy;
}

/** Calendar-only identity: no duplicate series dates/part numbers in lesson files. */
export function validateSeriesCalendar(calendar) {
  const errors = [];
  if (!Array.isArray(calendar?.items)) return ['Missing calendar.items'];
  const parts = calendar.items.filter(item => item?.series !== undefined);
  if (!parts.length && calendar.seriesPolicy === undefined) return errors; // Legacy calendars.
  let policy;
  try { policy = requirePolicy(calendar); } catch (error) { return [error.message]; }
  const groups = new Map();
  for (const item of parts) {
    const s = item.series;
    if (!s || !idPattern.test(s.id ?? '') || !Number.isSafeInteger(s.part) ||
        !Number.isSafeInteger(s.totalParts) || s.totalParts < 2 || s.part < 1 || s.part > s.totalParts) {
      errors.push(`${item.id}: invalid series id, part or totalParts`);
      continue;
    }
    try { dateValue(item.date); } catch (error) { errors.push(`${item.id}: ${error.message}`); continue; }
    if (!groups.has(s.id)) groups.set(s.id, []);
    groups.get(s.id).push(item);
  }
  for (const [id, items] of groups) {
    const ordered = [...items].sort((a, b) => a.series.part - b.series.part);
    const total = ordered[0].series.totalParts;
    if (ordered.length !== total || new Set(ordered.map(x => x.series.part)).size !== total ||
        ordered.some(x => x.series.totalParts !== total) || ordered[0].series.part !== 1) {
      errors.push(`${id}: register the complete, uniquely numbered series before its first part`);
      continue;
    }
    const first = ordered[0];
    if (!calendar.planningWeekdays?.includes(weekdays[dateValue(first.date).getUTCDay()]))
      errors.push(`${id}: the first part must use a regular planning weekday`);
    for (const item of ordered) {
      const slot=expectedContentSlot(calendar,item.date);
      if(slot && (slot.contentType!=='series-part' || slot.series.part!==item.series.part || slot.series.totalParts!==total))
        errors.push(`${id} part ${item.series.part}: must match the configured weekly series slot`);
      const expected = addDays(first.date, (item.series.part - 1) * policy.continuationGapDays);
      if (item.date !== expected)
        errors.push(`${id} part ${item.series.part}: expected next consecutive date ${expected}, got ${item.date}`);
      if (calendar.items.some(other => other !== item && other.date === item.date))
        errors.push(`${id} part ${item.series.part}: date ${item.date} conflicts with another calendar item`);
    }
  }
  return errors;
}

/** A proposal, not a reservation, completed script or publishing authorization. */
export function proposeSeries(calendar, {seriesId, startDate, totalParts, today} = {}) {
  const policy = requirePolicy(calendar);
  const errors = validateSeriesCalendar(calendar);
  if (errors.length) throw Error(errors.join('\n'));
  if (!idPattern.test(seriesId ?? '')) throw Error('Use a lowercase hyphenated series ID');
  // Bound one read-only planning request; not an editorial series-length rule.
  if (!Number.isSafeInteger(totalParts) || totalParts < 2 || totalParts > 366)
    throw Error('A planning request needs 2–366 parts');
  dateValue(today);
  const start = dateValue(startDate);
  if (startDate <= today) throw Error('A new series must start in the future');
  if (!calendar.planningWeekdays?.includes(weekdays[start.getUTCDay()]))
    throw Error('The first part must use a regular planning weekday');
  const firstSlot=expectedContentSlot(calendar,startDate);
  if(firstSlot && (firstSlot.contentType!=='series-part' || firstSlot.series.part!==1 || firstSlot.series.totalParts!==totalParts))
    throw Error('Start the complete series on its configured weekly first-part slot');
  if (calendar.items.some(item => item.series?.id === seriesId)) throw Error('Series ID already exists');
  const propose = Array.from({length: totalParts}, (_, index) => ({
    type: 'author-new-script', date: addDays(startDate, index * policy.continuationGapDays),
    series: {id: seriesId, part: index + 1, totalParts},
    requiresVerifiedLearningFacts: true, requiresHookExperiment: true,
    ctaSource: 'content/cta-lab.json', status: 'planned',
  }));
  for (const item of propose) {
    const slot=expectedContentSlot(calendar,item.date);
    if(slot && (slot.contentType!=='series-part' || slot.series.part!==item.series.part || slot.series.totalParts!==totalParts))
      throw Error('Series continuation does not match the weekly content schedule');
    if (calendar.items.some(existing => existing.date === item.date))
      throw Error(`Series date ${item.date} is occupied; do not move an existing episode or skip a day`);
  }
  return {date: today, timeZone: calendar.timezone, seriesId, propose,
    proposalsAreScripts: false, requiresCompleteDraftSet: policy.requireCompleteDraftSet,
    publicationAuthorized: false,
    note: 'Author and verify every part in all production languages before registering the complete set. Each part must resolve its own useful lesson; dates do not schedule social posts.'};
}

/** A structural editorial contract, not an automatic prediction of excitement. */
export function validateSerialArc(item,episode,policy,peer){
 if(!item?.series||!policy?.effectiveFromDate||item.date<policy.effectiveFromDate)return [];
 const a=episode?.storytelling?.serialArc, b=peer?.storytelling?.serialArc;
 const errors=[], label=item.id+': serial arc ';
 const nonempty=v=>typeof v==='string'&&v.trim().length>0;
 const scenes=(episode?.scenes??[]).filter(x=>x.kind!=='cta');
 const cue=(c)=>scenes.findIndex(x=>x.id===c?.sceneId&&nonempty(c.cueText)&&x.narration?.includes(c.cueText));
 if(!a||!policy.families?.some(x=>x.id===a.familyId)||!['premise','stakes','unresolvedQuestion','payoffPlan'].every(k=>nonempty(a[k])))return [label+'requires registered family, premise, stakes, unresolved question and payoff plan'];
 if(!b||a.familyId!==b.familyId||a.premise!==b.premise||a.stakes!==b.stakes||a.unresolvedQuestion!==b.unresolvedQuestion||a.payoffPlan!==b.payoffPlan)errors.push(label+'both parts must share the same planned narrative in this language');
 if(cue(a.opening)!==0)errors.push(label+'opening must refer to an exact first-scene narration cue');
 const progress=cue(a.progress);
 if(progress<0||a.progress?.cueText===a.opening?.cueText)errors.push(label+'progress must reference a distinct real narration cue');
 if(item.series.part===1){
   const cliff=cue(a.cliffhanger);
   if(cliff!==scenes.length-1||!scenes.at(-1)?.narration?.trim().endsWith(a.cliffhanger?.cueText?.trim()??'INVALID')||cliff<progress||a.cliffhanger?.cueText===a.progress?.cueText||a.cliffhanger?.cueText===a.opening?.cueText)errors.push(label+'specific cliffhanger must be the final non-CTA narration cue after progress');
   if(a.resolution!=null)errors.push(label+'part 1 must not claim the final resolution');
 }else if(item.series.part===2){
   const resolution=cue(a.resolution);
   if(resolution<0||resolution<progress||a.resolution?.cueText===a.progress?.cueText)errors.push(label+'part 2 needs a real resolution cue after progress');
   if(a.cliffhanger!=null)errors.push(label+'part 2 must finish the story, not tease a third part');
 }
 return errors;
}
export function readSerialArcErrors(root,item,episode,contentRoot,canonical){
 if(!item?.series)return [];
 const file=path.join(root,'content/creative-formats.json');
 if(!fs.existsSync(file))return [];
 const policy=JSON.parse(fs.readFileSync(file,'utf8')).storytellingPolicy?.seriesPartPolicy?.narrativeDiscovery;
 if(!policy||item.date<policy.effectiveFromDate)return [];
 const calendar=JSON.parse(fs.readFileSync(path.join(root,'content/calendar.json'),'utf8'));
 const peerItem=calendar.items.find(x=>x.series?.id===item.series.id&&x.series.part!==item.series.part);
 if(!peerItem||peerItem.episodeFile!=='episodes/'+peerItem.id+'.json')return [item.id+': complete serial pair required'];
 const peerPath=path.join(root,contentRoot,peerItem.episodeFile);
 if(!fs.existsSync(peerPath))return [item.id+': missing peer serial source'];
 const errors=validateSerialArc(item,episode,policy,JSON.parse(fs.readFileSync(peerPath,'utf8')));
 if(canonical&&episode.storytelling?.serialArc?.familyId!==canonical.storytelling?.serialArc?.familyId)errors.push(item.id+': localized serial family differs from canonical');
 return errors;
}

/** Pair analytics: strict approved-post identity, never infer individual return. */
export function serialReadbacks({publications,observations,asOf=new Date()}){
 const cutoff=+asOf, H=3600000, groups=new Map();
 for(const p of publications){
  if(p.content?.type!=='series-part'||p.content.series?.totalParts!==2||p.status!=='published'||validatePublicationMapping(p).length||!(Date.parse(p.publishedAt)<=cutoff)||!(Date.parse(p.verifiedAt)<=cutoff))continue;
  const rows=observations.filter(o=>!validateObservation(o).length&&o.platform===p.platform&&o.accountId===p.accountId&&
   (o.platformPostId===p.platformPostId||(!p.platformPostId&&o.zernioPostId&&o.zernioPostId===p.zernioPostId))&&
   (!o.zernioPostId||!p.zernioPostId||o.zernioPostId===p.zernioPostId)&&
   (!o.content||(o.content.id===p.content.id&&o.content.sourceHash===p.content.sourceHash&&o.content.language===p.content.language))&&
   (!o.videoSha256||o.videoSha256===p.videoSha256)&&Math.abs(Date.parse(o.publishedAt)-Date.parse(p.publishedAt))<=60000&&
   Date.parse(o.observedAt)<=cutoff&&!(Date.parse(o.collectedAt)>cutoff)&&!['pending','unavailable'].includes(o.source.syncStatus))
   .map(o=>({o,age:(Math.min(Date.parse(o.observedAt),Date.parse(o.source.providerMetricUpdatedAt??o.source.syncedAt))-Date.parse(p.publishedAt))/H}))
   .filter(x=>x.o.metrics.views!=null&&Number.isFinite(x.age));
  const exact=rows.filter(x=>x.o.window==='7d').sort((a,b)=>Date.parse(a.o.observedAt)-Date.parse(b.o.observedAt))[0];
  const near=rows.filter(x=>x.o.window==='lifetime'&&x.age>=72&&x.age<96).sort((a,b)=>a.age-b.age)[0];
  const extract=(x,window)=>x?{window,ageHours:x.age,views:x.o.metrics.views,
    follows:x.o.metrics.follows??null,profileVisits:Number.isSafeInteger(x.o.metrics.profileVisits)&&x.o.metrics.profileVisits>=0&&x.o.source.profileVisitsScope==='post-attributed'?x.o.metrics.profileVisits:null,
    followsPer1000Views:x.o.metrics.follows==null||!x.o.metrics.views?null:1000*x.o.metrics.follows/x.o.metrics.views,
    observedAt:x.o.observedAt}:null;
  const key=JSON.stringify([p.content.series.id,p.content.language,p.platform,p.accountId]);
  const g=groups.get(key)??{seriesId:p.content.series.id,language:p.content.language,platform:p.platform,accountId:p.accountId,parts:{}};
  const part=p.content.series.part;
  if(g.parts[part])g.conflict=true;
  g.parts[part]={contentId:p.content.id,familyId:p.creative?.serialFamilyId??null,exact:extract(exact,'7d'),near:extract(near,'lifetime-72-to-96h')};
  groups.set(key,g);
 }
 return [...groups.values()].map(g=>{
  const a=g.parts[1],b=g.parts[2], exact=a?.exact&&b?.exact, near=a?.near&&b?.near;
  const first=exact?a.exact:near?a.near:null, second=exact?b.exact:near?b.near:null;
  const comparable=!g.conflict&&first&&second&&first.views>0;
  return {...g,familyId:a?.familyId&&a.familyId===b?.familyId?a.familyId:null,
   firstPartFollowsPer1000Views:!g.conflict?(a?.exact??a?.near)?.followsPer1000Views??null:null,
   partContinuationRatio:comparable?second.views/first.views:null,
   comparisonWindow:comparable?first.window:null,interpretation:'Descriptive reach continuation, not returning viewers or a causal winner.'};
 });
}

/** Candidate order, not a winner score. Prefer repeat follower evidence within
 * one account/locale/window; otherwise expose novel families for exploration. */
export function serialPlanningBrief(policy,readbacks,weekStart){
 if(!policy?.families?.length||weekStart<policy.effectiveFromDate)return null;
 const families=policy.families.map(f=>{
  const rows=readbacks.filter(r=>r.familyId===f.id&&!r.conflict);
  const cohorts=new Map();
  for(const r of rows){
   const first=r.parts[1]?.exact??r.parts[1]?.near;
   if(!first||first.followsPer1000Views==null||first.views<500)continue;
   const k=JSON.stringify([r.language,r.platform,r.accountId,first.window]);
   if(!cohorts.has(k))cohorts.set(k,[]);
   cohorts.get(k).push({seriesId:r.seriesId,followsPer1000Views:first.followsPer1000Views,views:first.views});
  }
  const repeatEvidence=[...cohorts.entries()].filter(([,x])=>x.filter(row=>row.followsPer1000Views>0).length>=2)
   .map(([cohort,rows])=>({cohort:JSON.parse(cohort),rows}));
  return {...f,observedStories:new Set(rows.map(r=>r.seriesId)).size,repeatEvidence};
 });
 const proven=families.filter(f=>f.repeatEvidence.length);
 const fresh=families.filter(f=>!f.observedStories);
 return {goal:policy.goal,mode:'editorial-candidates',candidateOrder:[...proven,...fresh,...families.filter(f=>!proven.includes(f)&&!fresh.includes(f))].map(f=>f.id),
 families,selection:policy.selection,beats:policy.beats,editorialCheck:policy.editorialCheck,
 note:'Pitch three distinct plot concepts. Repeat follower evidence is descriptive and not causal proof; do not compare follower rates across different cohorts. New families and missing evidence never delay the pair.'};
}
