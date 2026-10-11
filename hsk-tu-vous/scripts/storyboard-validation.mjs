import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const STORY_FORMATS=new Set(['street-situation','speed-quiz','micro-series','problem-fix']);
export const STORY_SETTINGS=new Set(['street','cafe','campus','home']);
export const STORY_CHARACTERS=new Set(['student','shopkeeper']);
export const STORY_MOODS=new Set(['question','mistake','answer','practice']);

export function validateStoryboardScene(scene) {
  if (!scene?.storyboard) return [];
  const s=scene.storyboard;
  const errors=[];
  if(scene.kind==='cta') errors.push('CTA must come only from central CTA Lab, not storyboard');
  if(!s || typeof s!=='object' || Array.isArray(s)) return ['storyboard must be object'];
  if(!STORY_FORMATS.has(s.formatId)) errors.push('invalid storyboard formatId');
  if(!STORY_SETTINGS.has(s.setting)) errors.push('invalid storyboard setting');
  if(!STORY_CHARACTERS.has(s.character)) errors.push('invalid storyboard character');
  if(!STORY_MOODS.has(s.mood)) errors.push('invalid storyboard mood');
  if(s.sign!==undefined && (typeof s.sign!=='string'||s.sign.length>12)) errors.push('invalid storyboard sign');
  if(s.options!==undefined && (!Array.isArray(s.options)||s.options.length<2||s.options.length>3||
    s.options.some(v=>typeof v!=='string'||!v.trim()||v.length>18))) errors.push('storyboard options must be 2–3 short choices');
  if(s.formatId==='speed-quiz' && !s.options) errors.push('speed-quiz requires options');
  if(s.formatId!=='speed-quiz' && s.options) errors.push('options only allowed for speed-quiz');
  return errors;
}

export function validateStoryboardEpisode(episode) {
  if(!episode || !Array.isArray(episode.scenes)) throw Error('Storyboard needs episode.scenes');
  const registry=JSON.parse(fs.readFileSync(path.join(root,'content/creative-formats.json'),'utf8'));
  const allowed=new Set(registry.formats.map(f=>f.id));
  for(const scene of episode.scenes) {
    const errors=validateStoryboardScene(scene);
    if(errors.length) throw Error(`${episode.id}/${scene.id}: ${errors.join('; ')}`);
    if(scene.storyboard && !allowed.has(scene.storyboard.formatId))
      throw Error('Storyboard format is absent from canonical creative registry');
  }
  return true;
}
