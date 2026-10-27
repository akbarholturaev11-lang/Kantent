import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {reviewPromoPlan,reviewPromoVariants,runPromoCli,promoSourceHash,assertLocalizedPromoPlan,validatePromoPlan} from './promo-plan.mjs';
import {createServer} from './mcp-server.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const id='speaking-cafe-example';
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const source=()=>read(path.join(root,'content/promos',id+'.json'));
const translation=()=>read(path.join(root,'content/locales/tg/promos',id+'.json'));

function workspace(t) {
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'hsk-promo-languages-'));
  const project=path.join(folder,'repo/hsk');
  t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));
  const files=['content/creative-formats.json','content/visual-system.json','content/languages.json',
    `content/promos/${id}.json`,`content/locales/tg/promos/${id}.json`,
    ...source().evidence.map(item=>item.sourcePath),
    ...new Set(source().beats.map(beat=>beat.visual.assetPath).filter(Boolean))];
  for(const file of files){const target=path.resolve(project,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.resolve(root,file),target);}
  return project;
}

test('an ordinary promo request validates both configured languages with isolated voice, CTA and output paths',()=>{
  const report=reviewPromoVariants(id);
  assert.deepEqual(report.requestedLanguages,['ru','tg']);
  assert.equal(report.stage,'plans-validated');
  assert.equal(report.plansComplete,true);
  assert.equal(report.renderReady,false);
  assert.equal(report.variants.ru.plan.languageCode,'ru-RU');
  assert.equal(report.variants.tg.plan.languageCode,'tg-TJ');
  assert.equal(report.variants.tg.voiceSource,'content/locales/tg/voice-profile.json');
  assert.equal(report.variants.tg.ctaSource,'content/locales/tg/cta-lab.json');
  assert.notEqual(report.variants.ru.outputPaths.review,report.variants.tg.outputPaths.review);
  assert.notEqual(report.variants.ru.outputPaths.media,report.variants.tg.outputPaths.media);
  assert.equal(report.voiceGenerated,false);
  assert.equal(report.publicationAuthorized,false);
});

test('Tajik narration, claims and visual anchors are independently authored and source-bound',()=>{
  const ru=source(),tg=translation();
  assert.equal(tg.localization.sourceHash,promoSourceHash(ru));
  assert.doesNotThrow(()=>assertLocalizedPromoPlan(tg,ru));
  for(const [index,beat] of tg.beats.entries()){
    assert.notEqual(beat.narration,ru.beats[index].narration);
    assert.ok(beat.narration.includes(beat.visual.cueText));
    assert.equal(beat.visual.continuityKey,ru.beats[index].visual.continuityKey);
    if(beat.visual.type==='product-capture')assert.equal(beat.visual.uiLanguage,'tg-TJ');
  }
});

test('missing translation produces a partial report and a failing CLI status, never a Russian substitute',t=>{
  const project=workspace(t);
  fs.rmSync(path.join(project,'content/locales/tg/promos',id+'.json'));
  const report=reviewPromoVariants(id,{root:project});
  assert.equal(report.stage,'partial');
  assert.equal(report.plansComplete,false);
  assert.equal(report.variants.ru.stage,'plan-validated');
  assert.match(report.variants.tg.error,/translation is missing/);
  assert.equal(report.variants.tg.plan,undefined);
  let output;
  assert.equal(runPromoCli([id],{root:project,write:value=>{output=JSON.parse(value);}}),1);
  assert.equal(output.plansComplete,false);
});

test('a changed source blocks stale Tajik localization while the Russian plan remains independently available',t=>{
  const project=workspace(t);
  const file=path.join(project,'content/promos',id+'.json'),changed=read(file);
  changed.benefit+=' Revised source context.';
  fs.writeFileSync(file,JSON.stringify(changed));
  const report=reviewPromoVariants(id,{root:project});
  assert.equal(report.stage,'partial');
  assert.match(report.variants.tg.error,/current canonical promo/);
  assert.equal(reviewPromoVariants(id,{root:project,language:'ru'}).plansComplete,true);
});

test('source hashes cannot legitimise copied narration, changed claims or foreign-language timings',()=>{
  const ru=source();
  let tg=translation();tg.beats[0].narration=ru.beats[0].narration;
  assert.throws(()=>assertLocalizedPromoPlan(tg,ru),/copied source/);
  tg=translation();tg.beats[3].claimIds=['made-up-feature'];
  assert.throws(()=>assertLocalizedPromoPlan(tg,ru),/shared story/);
  tg=translation();tg.localization.sourceHash='stale';
  assert.throws(()=>assertLocalizedPromoPlan(tg,ru),/current canonical/);
  tg=translation();tg.captions=[{text:'Russian',startMs:0,endMs:100}];
  // Imported voice/timings cannot be saved into either language's canonical source.
  assert.match(validatePromoPlan(tg).join(' '),/cannot carry CTA/);
});

test('explicit language requests narrow the plan; a malformed or mismatched translation fails its own path',t=>{
  assert.deepEqual(reviewPromoVariants(id,{language:'tg'}).requestedLanguages,['tg']);
  assert.throws(()=>reviewPromoVariants(id,{language:'xx'}),/configured production language/);
  const project=workspace(t),file=path.join(project,'content/locales/tg/promos',id+'.json');
  const broken=read(file);broken.language='ru';fs.writeFileSync(file,JSON.stringify(broken));
  assert.throws(()=>reviewPromoPlan(id,{root:project,language:'tg'}),/another language/);
  fs.writeFileSync(file,'{not json');
  const report=reviewPromoVariants(id,{root:project});
  assert.equal(report.plansComplete,false);
  assert.equal(report.variants.ru.stage,'plan-validated');
  assert.equal(report.variants.tg.stage,'blocked');
});

test('CLI default and explicit Tajik mode use the same language contract without writing files',()=>{
  const before=JSON.stringify([source(),translation()]);
  const outputs=[];
  assert.equal(runPromoCli([id],{write:value=>outputs.push(JSON.parse(value))}),0);
  assert.equal(runPromoCli([id,'--language','tg'],{write:value=>outputs.push(JSON.parse(value))}),0);
  assert.deepEqual(outputs[0].requestedLanguages,['ru','tg']);
  assert.deepEqual(outputs[1].requestedLanguages,['tg']);
  assert.equal(JSON.stringify([source(),translation()]),before);
  assert.throws(()=>runPromoCli([id,'--language'],{write:()=>{}}),/Usage/);
});

test('MCP defaults ads to both languages and retains explicit per-language reads',async()=>{
  const server=createServer();
  try{
    const tool=server._registeredTools.get_promo_plan;
    assert.equal(tool.inputSchema.safeParse({id,language:'all'}).success,true);
    const both=await tool.handler({id});
    assert.deepEqual(both.structuredContent.requestedLanguages,['ru','tg']);
    assert.equal(both.structuredContent.plansComplete,true);
    const tg=await tool.handler({id,language:'tg'});
    assert.deepEqual(tg.structuredContent.requestedLanguages,['tg']);
    assert.equal(tg.structuredContent.variants.tg.plan.languageCode,'tg-TJ');
  }finally{await server.close();}
});
