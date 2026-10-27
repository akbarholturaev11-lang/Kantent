import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateGraphicScene} from './graphic-scene.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const idPattern=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const text=value=>typeof value==='string' && value.trim().length>=3;
const load=file=>JSON.parse(fs.readFileSync(file,'utf8'));

export function readPromoRules(root=ROOT) {
  const policy=load(path.join(root,'content/creative-formats.json')).promoPolicy;
  const visual=load(path.join(root,'content/visual-system.json'));
  const languages=load(path.join(root,'content/languages.json')).languages;
  const presentation=visual.promoPresentation;
  if(policy?.schemaVersion!==1 || !Array.isArray(policy.formats) || !Array.isArray(policy.beatRoles) ||
      policy.styleId!==presentation?.styleId || presentation.maximumFocalSubjects!==1 ||
      presentation.maximumNarrativeTextLayers!==1 || !Array.isArray(presentation.backgroundTokens) ||
      presentation.backgroundTokens.some(token=>!visual.colors?.[token]))
    throw Error('Missing/invalid canonical promo policy or minimal presentation');
  return {policy,presentation,languages};
}

export function validatePromoPlan(plan,{policy,presentation,languages}=readPromoRules()) {
  const errors=[];
  const fail=message=>errors.push(message);
  if(!plan || plan.schemaVersion!==1 || !idPattern.test(plan.id??'') || plan.kind!=='advertisement')
    return ['Expected an identified schemaVersion:1 advertisement plan'];
  if(plan.status!=='draft')fail('New promo plans must remain unapproved drafts');
  if(!languages[plan.language] || plan.languageCode!==languages[plan.language]?.languageCode)
    fail('Promo language must match its configured languageCode');
  if(plan.styleId!==presentation.styleId || !policy.formats.includes(plan.formatId))fail('Unsupported promo style or story format');
  if(!text(plan.benefit) || ['setting','learnerGoal','friction'].some(key=>!text(plan.situation?.[key])))
    fail('Describe one supported benefit and a concrete life situation, goal and friction');
  if(!['illustrative','documented'].includes(plan.storyType))fail('Declare illustrative or documented story provenance');
  if(['cta','ctaExperiment','audioSrc','captions','approval','publishedAt'].some(key=>Object.hasOwn(plan,key)))
    fail('Source plans cannot carry CTA copy, generated voice/timing, approval or publication records');
  if(!Array.isArray(plan.evidence) || !plan.evidence.length)fail('Checked product evidence is required');
  const evidence=new Map();
  for(const item of Array.isArray(plan.evidence)?plan.evidence:[]) {
    if(!idPattern.test(item?.id??'') || evidence.has(item.id) || !text(item.sourcePath) ||
        !['product-source','personal-story'].includes(item.kind) ||
        !text(item.supports) || !/^\d{4}-\d{2}-\d{2}$/.test(item.checkedAt??''))fail('Invalid/duplicate product evidence receipt');
    else evidence.set(item.id,item);
  }
  if(plan.storyType==='documented' && evidence.get(plan.storySourceId)?.kind!=='personal-story')fail('A documented personal story needs its own evidence receipt');
  if(!Array.isArray(plan.beats) || plan.beats.length<3)return [...errors,'Write a complete story, product demonstration and resolution'];
  const ids=new Set();
  const demoIndex=plan.beats.findIndex(beat=>beat?.role==='product-demo');
  if(plan.beats[0]?.role!=='situation' || plan.beats.at(-1)?.role!=='resolution' || demoIndex<1 || demoIndex>=plan.beats.length-1)
    fail('Start in the life situation, demonstrate the product and resolve the task afterwards');
  if(plan.storyType==='illustrative' && (!text(plan.storyDisclosure) ||
      typeof plan.beats[0]?.narration!=='string' || !plan.beats[0].narration.includes(plan.storyDisclosure)))
    fail('Introduce the imagined situation explicitly in the first narrated caption');
  const spoken=plan.beats.map(beat=>beat?.narration??'').join('\n');
  const claims=new Map();
  if(!Array.isArray(plan.claims) || !plan.claims.length)fail('Author supported product claims');
  for(const claim of Array.isArray(plan.claims)?plan.claims:[]) {
    if(!idPattern.test(claim?.id??'') || claims.has(claim.id) || !text(claim.text) ||
        !spoken.includes(claim.text) || !Array.isArray(claim.evidenceIds) || !claim.evidenceIds.length ||
        claim.evidenceIds.some(id=>evidence.get(id)?.kind!=='product-source'))fail('Each product claim needs exact narration and checked source IDs');
    else claims.set(claim.id,claim);
  }
  for(const beat of plan.beats) {
    const v=beat?.visual;
    if(!idPattern.test(beat?.id??'') || ids.has(beat.id) || !policy.beatRoles.includes(beat.role) || !text(beat.narration))
      fail('Invalid/duplicate beat identity, role or narration');
    ids.add(beat?.id);
    if(!v || !text(v.focalSubject) || !text(v.action) || !text(v.continuityKey) ||
        !text(v.cueText) || typeof beat?.narration!=='string' || !beat.narration.includes(v.cueText) || !presentation.backgroundTokens.includes(v.backgroundToken))
      fail(`${beat?.id}: author one subject, meaningful action, continuity and an exact spoken cue`);
    if(['headline','screenCaption','overlayTexts'].some(key=>Object.hasOwn(beat??{},key) || Object.hasOwn(v??{},key)))
      fail(`${beat?.id}: only one narration caption layer is allowed`);
    if(v?.type==='product-capture') {
      if(!text(v.assetPath) || !/\.(png|jpe?g|webp|mp4|mov)$/i.test(v.assetPath) ||
          !text(v.uiLanguage) || v.provenance!=='genuine-product-capture' ||
          !Array.isArray(beat.claimIds) || !beat.claimIds.length || beat.claimIds.some(id=>!claims.has(id)))
        fail(`${beat?.id}: product demonstrations need a genuine capture and supported claim IDs`);
      else if(beat.claimIds.some(id=>typeof beat.narration!=='string' || !beat.narration.includes(claims.get(id).text)))
        fail(`${beat.id}: demo narration must include the referenced product claim`);
      if(v.uiLanguage!==plan.languageCode && !text(v.limitations))
        fail(`${beat?.id}: disclose the capture language mismatch as outstanding production work`);
    } else if(v?.type==='illustration') {
      if(!text(v.drawingBrief))fail(`${beat?.id}: describe the actual original object/action to build`);
      if(v.graphic) {try{validateGraphicScene(v.graphic);}catch(error){fail(`${beat.id}: ${error.message}`);}}
    } else fail(`${beat?.id}: use an original illustration or genuine product capture`);
    if(beat?.role==='product-demo' && v?.type!=='product-capture')fail(`${beat.id}: a product demo cannot be an invented UI drawing`);
  }
  return errors;
}

function containedFile(root,relative) {
  const repository=fs.realpathSync(path.resolve(root,'..'));
  if(typeof relative!=='string' || path.isAbsolute(relative))throw Error('Use repository-relative evidence and asset paths');
  const file=fs.realpathSync(path.resolve(root,relative));
  if(!file.startsWith(repository+path.sep) || !fs.statSync(file).isFile())throw Error('Evidence/asset must be a file within this repository');
  return file;
}

export function reviewPromoPlan(id,{root=ROOT,language}={}) {
  if(!idPattern.test(id??''))throw Error('Use a lowercase hyphenated promo ID');
  const rules=readPromoRules(root);
  const plan=load(path.join(root,'content/promos',id+'.json'));
  if(plan.id!==id)throw Error('Promo ID does not match its file');
  if(language && plan.language!==language)throw Error('Promo belongs to another language; select its actual version');
  const errors=validatePromoPlan(plan,rules);
  if(errors.length)throw Error(errors.join('\n'));
  for(const item of plan.evidence)containedFile(root,item.sourcePath);
  for(const beat of plan.beats)if(beat.visual.assetPath)containedFile(root,beat.visual.assetPath);
  return {mode:'read-only-promo-planning',plan,structurallyValid:true,
    ctaSource:path.posix.join(rules.languages[plan.language].contentRoot,'cta-lab.json'),
    voiceSource:path.posix.join(rules.languages[plan.language].contentRoot,'voice-profile.json'),
    requiredBeforeMedia:[
      ...plan.beats.filter(beat=>beat.visual.type==='illustration' && !beat.visual.assetPath && !beat.visual.graphic)
        .map(beat=>`${beat.id}: build and inspect the original drawing; a prose brief is not a rendered frame`),
      ...plan.beats.filter(beat=>beat.visual.limitations).map(beat=>`${beat.id}: ${beat.visual.limitations}`),
      'Independently verify claim accuracy, current capture language/privacy and the truth of the story; file existence is not semantic verification.',
      'Append the current central CTA, generate approved matching voice and exact word cues, then render and inspect the complete MP4.',
      'Get separate approval of the exact language/platform publication preview.',
    ],voiceGenerated:false,renderReady:false,publicationAuthorized:false};
}

if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [id,...extra]=process.argv.slice(2);
    if(extra.length)throw Error('Usage: npm run content:promo-plan -- <promo-id>');
    console.log(JSON.stringify(reviewPromoPlan(id),null,2));
  } catch(error){console.error(error.message);process.exitCode=1;}
}
