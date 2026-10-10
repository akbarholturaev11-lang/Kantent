import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateStoryboardEpisode, validateStoryboardScene } from './storyboard-validation.mjs';
import { composeLessonCta } from './episode-cta-assembly.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const load=(file)=>JSON.parse(fs.readFileSync(path.join(root,'content',file),'utf8'));
const pilot=load('episodes/zai-location.json');
const ctaLab=load('cta-lab.json');

test('all four cinematic scenes use valid creative story treatment',()=>{
  assert.equal(pilot.creativeFormatId,'street-situation');
  assert.equal(pilot.scenes.length,4);
  assert.equal(validateStoryboardEpisode(pilot),true);
  assert.ok(pilot.scenes.every((s)=>s.storyboard?.formatId===pilot.creativeFormatId));
  assert.deepEqual(pilot.scenes.map(s=>s.storyboard.setting),['campus','street','home','campus']);
});
test('only central CTA may generate CTA scenes; pilot is CTA-free',()=>{
  assert.equal(pilot.cta,undefined);
  assert.equal(pilot.ctaExperiment,undefined);
  assert.equal(pilot.scenes.some(s=>s.kind==='cta'),false);
  const version=composeLessonCta(pilot,ctaLab);
  assert.equal(version.scenes.at(-1).kind,'cta');
  assert.equal(version.scenes.at(-1).storyboard,undefined);
});
test('rejects injected storyboard at CTA boundary',()=>{
  const s={kind:'cta',storyboard:pilot.scenes[0].storyboard};
  assert.match(validateStoryboardScene(s).join(' '),/CTA/);
});
test('rejects malformed metadata and quiz without options',()=>{
  let s={kind:'hook',storyboard:{...pilot.scenes[0].storyboard,formatId:'speed-quiz'}};
  assert.match(validateStoryboardScene(s).join(' '),/requires options/);
  s={kind:'hook',storyboard:{...pilot.scenes[0].storyboard,setting:'imaginary-city'}};
  assert.match(validateStoryboardScene(s).join(' '),/setting/);
});
test('keeps legacy videos on their original non-cinematic path',()=>{
  const legacy=load('episodes/ni-nin-nimen-20260928.json');
  assert.ok(legacy.scenes.every(s=>s.storyboard==null));
  assert.equal(validateStoryboardEpisode(legacy),true);
});
