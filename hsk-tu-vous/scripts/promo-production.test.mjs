import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewPromoPlan} from './promo-plan.mjs';
import {materializePromo,validatePromoMedia,compilePromoTimeline} from './promo-production.mjs';
import {resolvePromoCue} from './promo-visual.mjs';
import {ctaContextSnapshot} from './cta-lab.mjs';
const draft=()=>materializePromo({id:'cafe-first-phrase-20261029',date:'2026-10-29',contentType:'advertisement'},reviewPromoPlan('cafe-first-phrase-20261029').plan,{voiceProfile:{provider:'gemini-api',profileId:'ru-gemini-kore-v1'},ctaLab:{},composeCta:e=>e});
test('authored ad uses approved generic media contract without inventing lesson facts or hook tests',()=>{
 const e=draft();assert.equal(e.kind,'advertisement');assert.equal(e.contentIdentity.type,'advertisement');
 assert.equal(e.hookExperiment,undefined);assert.equal(e.learningFacts,undefined);assert.equal(e.scenes.length,6);assert.equal(validatePromoMedia(e),true);
});
test('prose-only art or unresolved product capture cannot reach paid voice/render',()=>{
 const e=draft();delete e.scenes[0].promoVisual.graphic;assert.throws(()=>validatePromoMedia(e),/Graphic/);
 const b=draft();b.scenes[3].promoVisual.limitations='private text';assert.throws(()=>validatePromoMedia(b),/limitations/);
 const c=draft();c.scenes[3].promoVisual.crop.width=99999;assert.throws(()=>validatePromoMedia(c),/crop/);
});
test('promo action timing uses unique imported words, not proportional scene time',()=>{
 const scene={id:'try',startMs:1000,endMs:3000,promoVisual:{cueText:'микрофона'}};
 const words=[{text:'кнопка',startMs:1100,endMs:1500},{text:'микрофона',startMs:1620,endMs:2100}];
 assert.equal(resolvePromoCue(scene,words).startFrame,49);
 assert.throws(()=>resolvePromoCue({...scene,promoVisual:{cueText:'missing'}},words),/missing/);
 assert.throws(()=>compilePromoTimeline(draft()),/real word/);
});
test('changed promo artwork invalidates CTA context registration',()=>{
 const a=draft(),b=draft();b.scenes[0].promoVisual.graphic.nodes[1].x=30;
 assert.notEqual(ctaContextSnapshot(a).nonCtaContentHash,ctaContextSnapshot(b).nonCtaContentHash);
});
