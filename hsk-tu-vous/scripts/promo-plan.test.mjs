import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {readPromoRules,validatePromoPlan,reviewPromoPlan} from './promo-plan.mjs';
import {recommendSkills} from './skill-router.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'content/promos/speaking-cafe-example.json');
const fixture=()=>JSON.parse(fs.readFileSync(source,'utf8'));
const errors=plan=>validatePromoPlan(plan).join('\n');

test('canonical ad story is a draft, bound to sources and exact narration, with honest media gaps',()=>{
  const before=fs.readFileSync(source,'utf8');
  assert.equal(readPromoRules().presentation.styleId,'minimal-story-v1');
  assert.deepEqual(validatePromoPlan(fixture()),[]);
  const report=reviewPromoPlan('speaking-cafe-example',{language:'ru'});
  assert.equal(report.structurallyValid,true);
  assert.equal(report.renderReady,false);
  assert.equal(report.voiceGenerated,false);
  assert.equal(report.publicationAuthorized,false);
  assert.ok(report.requiredBeforeMedia.some(item=>item.includes('build and inspect')));
  assert.ok(report.requiredBeforeMedia.some(item=>item.includes('Tajik UI')));
  assert.equal(report.ctaSource,'content/cta-lab.json');
  assert.equal(fs.readFileSync(source,'utf8'),before);
});

test('advertising guidance reaches both engines without changing lesson routing or installing a skill',()=>{
  for(const [task,existingEngine,engine] of [
    ['Яна реклама роликларида минималистик стилда видео ясалишини юлга кой','unknown','remotion'],
    ['reklama rolikini minimalistik uslubda tayyorla','unknown','remotion'],
    ['Create premium HSK AI promo video','unknown','hyperframes'],
    ['Edit an existing promo video','hyperframes','hyperframes'],
  ]) {
    const r=recommendSkills(task,{existingEngine});
    assert.equal(r.engine,engine);
    assert.equal(r.creativeGuidance.workflow,'content/PROMO_WORKFLOW.md');
  }
  assert.equal(recommendSkills('Создай HSK 1 урок видео').creativeGuidance,undefined);
  assert.equal(recommendSkills('Create HyperFrames promo',{existingEngine:'remotion'}).engine,'approval-required');
});

test('imagined anecdotes are disclosed; documented first-person stories require receipts',()=>{
  const p=fixture();p.storyDisclosure='Несказанная фраза';
  assert.match(errors(p),/imagined situation/);
  p.storyType='documented';
  assert.match(errors(p),/personal story/);
  p.storySourceId='voice-practice';
  assert.match(errors(p),/personal story/,'product evidence is not a personal experience receipt');
});

test('missing claims, invented source IDs and unrelated demo narration fail',()=>{
  let p=fixture();p.claims[0].evidenceIds=['made-up'];
  assert.match(errors(p),/checked source IDs/);
  p=fixture();p.claims[0].text='Unspoken miracle result';
  assert.match(errors(p),/exact narration/);
  p=fixture();p.beats[4].claimIds=['practice-mode'];
  assert.match(errors(p),/demo narration/);
  p=fixture();p.evidence=[];
  assert.match(errors(p),/evidence/);
});

test('a product demonstration requires a genuine capture, supported claim and declared UI language',()=>{
  let p=fixture();p.beats[3].visual.type='illustration';p.beats[3].visual.drawingBrief='A made-up app window';
  assert.match(errors(p),/invented UI drawing/);
  p=fixture();p.beats[3].visual.provenance='ai-generated';
  assert.match(errors(p),/genuine capture/);
  p=fixture();delete p.beats[3].visual.limitations;
  assert.match(errors(p),/language mismatch/);
  p=fixture();p.beats[3].visual.assetPath='fake-interface.html';
  assert.match(errors(p),/genuine capture/);
});

test('one caption, a real subject/action and exact spoken anchor cannot be replaced with headings',()=>{
  let p=fixture();p.beats[0].headline='Duplicate title';
  assert.match(errors(p),/one narration caption/);
  p=fixture();p.beats[0].visual.cueText='not in the speech';
  assert.match(errors(p),/exact spoken cue/);
  p=fixture();p.beats[0].visual.focalSubject='';
  assert.match(errors(p),/one subject/);
  p=fixture();p.beats[0].visual.backgroundToken='#fake-palette';
  assert.match(errors(p),/exact spoken cue/);
});

test('CTA/voice/approval cannot be smuggled into an ad source or copied across languages',()=>{
  const p=fixture();p.cta='Old closing';p.audioSrc='old-voice.mp3';p.approval={approved:true};
  assert.match(errors(p),/cannot carry CTA/);
  assert.equal(reviewPromoPlan('speaking-cafe-example',{language:'tg'}).plan.languageCode,'tg-TJ');
  const translated=fixture();translated.language='tg';translated.languageCode='ru-RU';
  assert.match(errors(translated),/languageCode/);
});

test('malformed objects and incomplete story structures return actionable errors',()=>{
  assert.ok(validatePromoPlan(null).length);
  for(const value of [null,{},'wrong']) {
    const p=fixture();p.evidence=value;p.claims=value;
    assert.ok(validatePromoPlan(p).length);
  }
  let p=fixture();p.beats[0].narration=42;
  assert.ok(validatePromoPlan(p).length);
  p=fixture();p.beats[0]=null;
  assert.ok(validatePromoPlan(p).length);
  p=fixture();p.beats.pop();
  assert.match(errors(p),/resolve the task/);
});

test('source and asset paths cannot escape the real repository through absolute paths or symlinks',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'hsk-promo-paths-'));
  const repo=path.join(folder,'repo'),project=path.join(repo,'hsk');
  try {
    fs.mkdirSync(path.join(project,'content/promos'),{recursive:true});
    for(const name of ['creative-formats.json','visual-system.json','languages.json'])
      fs.copyFileSync(path.join(root,'content',name),path.join(project,'content',name));
    const p=fixture();
    const outside=path.join(folder,'outside.md');fs.writeFileSync(outside,'Not project evidence');
    p.evidence[0].sourcePath=outside;
    const file=path.join(project,'content/promos',p.id+'.json');
    fs.writeFileSync(file,JSON.stringify(p));
    assert.throws(()=>reviewPromoPlan(p.id,{root:project}),/relative/);
    fs.symlinkSync(outside,path.join(project,'external.md'));
    p.evidence[0].sourcePath='external.md';fs.writeFileSync(file,JSON.stringify(p));
    assert.throws(()=>reviewPromoPlan(p.id,{root:project}),/within this repository/);
  } finally {fs.rmSync(folder,{recursive:true,force:true});}
});

test('the CLI validates read-only and never produces voice, a render or publication',()=>{
  const before=fs.readFileSync(source,'utf8');
  const result=spawnSync(process.execPath,[path.join(root,'scripts/promo-plan.mjs'),'speaking-cafe-example'],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  const r=JSON.parse(result.stdout);
  assert.equal(r.mode,'read-only-multilingual-promo-planning');
  assert.deepEqual(r.requestedLanguages,['ru','tg']);
  assert.equal(r.plansComplete,true);
  assert.equal(r.renderReady,false);
  assert.equal(r.publicationAuthorized,false);
  assert.equal(fs.readFileSync(source,'utf8'),before);
});
