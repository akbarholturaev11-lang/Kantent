import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeObservations, loadObservations } from './feedback-analyzer.mjs';
import { evaluateDiscovery, discoveryWeekCutoff, planDiscoveryWeek, makeDiscoveryFreezeRecord, freezeDiscoveryCalendar, validateDiscoveryCalendar } from './viral-discovery.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const isoDate = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T00:00:00Z'));

export function localDate(date, timezone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = (key) => parts.find((p) => p.type === key)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function recommendCreativeFormats({ calendar, episodeByFile, registry, feedback, policy, date }) {
  if (!isoDate(date)) throw new Error('date must be YYYY-MM-DD');
  if (registry.schemaVersion !== 1 || !Array.isArray(registry.formats) || !registry.formats.length)
    throw new Error('Invalid creative format registry');
  const seen = new Set();
  for (const format of registry.formats) {
    if (!/^[a-z][a-z0-9-]+$/.test(format.id) || seen.has(format.id) || !Array.isArray(format.hookFormats))
      throw new Error('Invalid/duplicate creative format');
    seen.add(format.id);
  }
  const candidateItems = [...calendar.items]
    .filter((item) => item.status === 'planned' && item.date >= date)
    .sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  let nextFormatIndex = 0;
  const upcoming = candidateItems.map((item) => {
    if(item.contentType==='advertisement')return {date:item.date,contentId:item.id,contentType:'advertisement',status:'use-promo-plan',source:item.promoFile,creativeFormatId:null};
    const episode = episodeByFile[item.episodeFile];
    if (!episode || episode.id !== item.id || episode.date !== item.date)
      return { date: item.date, episodeId: item.id, status: 'missing-or-mismatched-episode', creativeFormatId: null };
    if (episode.publishingStatus && episode.publishingStatus !== 'pending-owner-review')
      return { date: item.date, episodeId: item.id, status: 'existing-approval-state-protected', creativeFormatId: null };
    const hookFormat = episode.hookExperiment?.formatId;
    const formats = registry.formats;
    // Owner-authorized re-cut is a separate new experiment, but does not
    // advance the fixed four-format rotation of original calendar slots.
    // It must share a valid registered family with its original episode.
    if (episode.pilotRemakeOfEpisodeId) {
      const parent = calendar.items.find(x=>x.id===episode.pilotRemakeOfEpisodeId);
      const parentEpisode = parent && episodeByFile[parent.episodeFile];
      const pinned = formats.find(x=>x.id===episode.creativeFormatId);
      if (!parent || !parentEpisode || !pinned || !pinned.hookFormats.includes(hookFormat) ||
          episode.id===parent.id || episode.date===parent.date ||
          parentEpisode.id!==parent.id) {
        return {date:item.date,episodeId:item.id,status:'invalid-recut',creativeFormatId:null};
      }
      return {
        date:item.date,episodeId:item.id,status:'creative-brief-only',
        currentHookFormat:hookFormat,creativeFormatId:pinned.id,creativeFormatLabel:pinned.label,
        currentTopic:episode.topic,audienceProblem:episode.audienceProblem??null,
        recommendedBeats:pinned.beats,editorialCheck:pinned.editorial,
        note:'Explicit fresh cinematic pilot, independently measured; does not alter the legacy published episode or subsequent format rotation.'
      };
    }
    let idx = -1;
    for (let n=0; n<formats.length; n++) {
      const i = (nextFormatIndex+n) % formats.length;
      if (formats[i].hookFormats.includes(hookFormat)) { idx = i; break; }
    }
    if (idx < 0) return { date: item.date, episodeId: item.id, status: 'no-compatible-format', hookFormat, creativeFormatId: null };
    nextFormatIndex = (idx+1) % formats.length;
    const selected = formats[idx];
    return {
      date: item.date, episodeId: item.id, status: 'creative-brief-only',
      currentHookFormat: hookFormat,
      creativeFormatId: selected.id, creativeFormatLabel: selected.label,
      currentTopic: episode.topic, audienceProblem: episode.audienceProblem ?? null,
      recommendedBeats: selected.beats, editorialCheck: selected.editorial,
      note: 'Suggestion only: check references, scenes, Hook Lab and CTA before any future-draft edit. Existing voice/render are not changed.'
    };
  });

  // Derive evidence only from source-labelled 7d platform windows with VERIFIED
  // episode/hook/level mapping. Different levels/duration bands are never pooled.
  // Older posts remain in Zernio/analytics history, but an owner-authorized
  // cinematic remake starts a NEW experiment. Never assign its published
  // predecessor's views (or watch metrics) to the new creative pilot.
  const replacedLegacyEpisodeIds = new Set(
    Object.values(episodeByFile).map(ep=>ep?.pilotRemakeOfEpisodeId).filter(Boolean)
  );
  const groups = new Map();
  for (const post of feedback.posts) {
    if (replacedLegacyEpisodeIds.has(post.episodeId)) continue;
    if (post.window !== policy.primaryDecisionWindow || !seen.has(post.creativeFormatId) ||
        !post.episodeId || !post.hookFormat || !post.hskLevel ||
        post.averageWatchRatio == null || post.views == null ||
        post.views < policy.minimumViewsPerPost) continue;
    const key = [post.platform,post.accountUsername??'account-unverified',post.language??'ru',post.contentType??'legacy-unverified',post.series?.part??'standalone',post.hskLevel,post.durationBand,post.creativeFormatId].join('|');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(post);
  }
  const evidence = [...groups].map(([key, posts]) => {
    const values = posts.map((p) => p.averageWatchRatio).sort((a,b)=>a-b);
    const middle = Math.floor(values.length/2);
    const median = values.length % 2 ? values[middle] : (values[middle-1]+values[middle])/2;
    return {
      cohortKey:key, postCount:posts.length, medianWatchRatio:+median.toFixed(4),
      readiness:posts.length >= policy.minimumPostsPerFormat ? 'eligible-for-owner-comparison' : 'insufficient-sample'
    };
  }).sort((a,b)=>a.cohortKey.localeCompare(b.cohortKey));
  return {
    schemaVersion:1, asOfDate:date, readOnly:true, target:registry.aspiration,
    pilot:registry.pilot, currentCalendarPlannedCount:upcoming.length,
    upcoming, evidence, evidenceStatus: evidence.some((x)=>x.readiness === 'eligible-for-owner-comparison')
      ? 'owner-review-required' : 'insufficient-evidence',
    publishingAuthorized:false, formatPromotionAuthorized:false,
    productFunnel: { profileLinkClickers:null, siteDownloads:null, verifiedNewLessonStarts:null,
      status:'unmeasured-no-app-telemetry', explanation:'Do not derive app activation from social views, likes or profile visits.' },
    diagnostics:feedback.caveats,
    guardrails:registry.productionGuardrails
  };
}

/** Shared read-only weekly proposal used by the CLI, MCP reserve and autopilot. */
export function readDiscoveryWeek({ projectRoot=root, calendar, today, now=new Date() }={}) {
  const policyPath=path.join(projectRoot,'content/hook-lab.json');
  if(!fs.existsSync(policyPath))return null;
  const policy=readJson(policyPath).policy.discoveryPilot;
  if(!policy?.enabled)return null;
  calendar??=readJson(path.join(projectRoot,'content/calendar.json'));
  today??=localDate(now,calendar.timezone);
  const registry=readJson(path.join(projectRoot,'content/creative-formats.json'));
  const publications=readJson(path.join(projectRoot,'content/feedback/publications.json')).records;
  const destinations=readJson(path.join(projectRoot,'content/publication-destinations.json'));
  const week=discoveryWeekCutoff(today,now);
  const frozen=(calendar.discoveryWeeks??[]).find(w=>w.weekStart===week.startDate);
  if(frozen){
    validateDiscoveryCalendar(calendar,registry);
    return {...frozen,mode:'active',status:'frozen',freezeRecord:frozen,slots:frozen.slots.map(s=>({...s,brief:registry.discoveryFamilies.find(f=>f.id===s.discoveryFormatId)?.brief??null})),assignmentAuthorized:true,publicationAuthorized:false};
  }
  const observations=loadObservations(path.join(projectRoot,'content/feedback/observations'),{applyMappings:false});
  const cutoff=week.cutoff;
  const discovery=evaluateDiscovery({observations,publications,destinations,policy,asOf:cutoff});
  const plan=planDiscoveryWeek({calendar,registry,discovery,publications,today,now});
  const active=policy.mode==='active'&&plan.weekStart>=policy.activeFrom;
  const freezeRecord=makeDiscoveryFreezeRecord(plan,{calendar,registry,policy,now});
  return {...plan,mode:active?'active':'shadow-read-only',status:freezeRecord?'ready-to-freeze':active?'preview-or-needs-family':'historical-preview',freezeRecord,assignmentAuthorized:!!freezeRecord};
}

export function runCli(args = process.argv.slice(2), { now = new Date() } = {}) {
  let json=false, date=null, freeze=false, write=false;
  for(let i=0; i<args.length; i++) {
    if(args[i]==='--json') json=true;
    else if(args[i]==='--freeze-week') freeze=true;
    else if(args[i]==='--write') write=true;
    else if(args[i]==='--date' && args[i+1]) date=args[++i];
    else throw new Error('Usage: npm run content:viral-plan -- [--date YYYY-MM-DD] [--json]');
  }
  const calendar=readJson(path.join(root,'content/calendar.json'));
  const registry=readJson(path.join(root,'content/creative-formats.json'));
  const policy=readJson(path.join(root,'content/hook-lab.json')).policy;
  const asOf=date ?? localDate(now,calendar.timezone);
  if(!isoDate(asOf)) throw new Error('Invalid date');
  if(write&&!freeze)throw Error('--write requires --freeze-week');
  if(freeze){
    const proposal=readDiscoveryWeek({calendar,today:asOf,now});
    if(!proposal?.freezeRecord)throw Error('No freeze record available: wait for the Sunday cutoff or register a new family; existing production is untouched');
    const next=freezeDiscoveryCalendar(calendar,proposal.freezeRecord,registry);
    if(write&&next!==calendar){const file=path.join(root,'content/calendar.json');const temp=file+'.discovery-tmp';fs.writeFileSync(temp,JSON.stringify(next,null,2)+'\n');fs.renameSync(temp,file);}
    console.log(JSON.stringify({written:write&&next!==calendar,freezeRecord:proposal.freezeRecord},null,2));
    return proposal;
  }
  const episodeByFile={};
  for(const item of calendar.items) {
    if(!item.episodeFile || episodeByFile[item.episodeFile]) continue;
    const epPath=path.resolve(root,'content',item.episodeFile);
    if(!epPath.startsWith(path.join(root,'content','episodes')+path.sep)) throw new Error('Unsafe episode path');
    if(fs.existsSync(epPath)) episodeByFile[item.episodeFile]=readJson(epPath);
  }
  const observations=loadObservations();
  const feedback=analyzeObservations(observations,policy,{asOf:now});
  const plan=recommendCreativeFormats({calendar,episodeByFile,registry,feedback,policy,date:asOf});
  if(policy.discoveryPilot?.enabled){
    const publications=readJson(path.join(root,'content/feedback/publications.json')).records;
    const destinations=readJson(path.join(root,'content/publication-destinations.json'));
    const raw=loadObservations(undefined,{applyMappings:false});
    plan.discovery=evaluateDiscovery({observations:raw,publications,destinations,policy:policy.discoveryPilot,asOf:now});
    plan.discoveryWeek=readDiscoveryWeek({calendar,today:asOf,now});
  }
  if(json) console.log(JSON.stringify(plan,null,2));
  else {
    console.log('Viral content PILOT (not guaranteed 50–90K views), from '+asOf);
    for(const item of plan.upcoming)
      console.log(`${item.date} ${item.episodeId}: ${item.creativeFormatId ?? item.status} [${item.currentHookFormat ?? '?'}]`);
    console.log('7d creative evidence: '+plan.evidenceStatus+'; app conversions: unmeasured');
    if(plan.discovery)console.log('Discovery: '+plan.discovery.families.length+' families; '+plan.discovery.unattributedHits.length+' unattributed threshold hits.');
    console.log('No video, voice, CTA or publication changed.');
  }
  return plan;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { runCli(); } catch (e) { console.error(e.message); process.exitCode=1; }
}
