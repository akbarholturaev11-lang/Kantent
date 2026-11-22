import {validateGraphicScene} from './graphic-scene.mjs';
import {resolvePromoCue} from './promo-visual.mjs';
import {contentIdentity} from './content-attribution.mjs';
import {promoCaptureLanguageMatches} from './promo-plan.mjs';
import fs from 'node:fs';
const visualSystem=JSON.parse(fs.readFileSync(new URL('../content/visual-system.json',import.meta.url),'utf8'));
/** A reviewed realistic frame of this ad (same generator/review gate as lesson art). */
export const promoArtFrame=(id,value)=>{const m=new RegExp('^public/lesson-art/'+id+'/([a-z][a-z0-9-]{1,40})\\.jpg$','u').exec(value??'');return m?m[1]:null;};
/** Owner 2026-11-23: new ads use realistic generated frames, as lessons do (visual-system.json#promoPresentation.realisticArtFromDate). */
export const promoNeedsRealisticArt=(episode,policy=visualSystem.promoPresentation)=>Boolean(policy?.realisticArtFromDate&&episode.date>=policy.realisticArtFromDate);
const validCrop = (crop) => Boolean(crop && ['x','y','width','height','sourceWidth','sourceHeight'].every(key=>Number.isFinite(crop[key])) &&
 crop.width>0 && crop.height>0 && crop.x>=0 && crop.y>=0 && crop.x+crop.width<=crop.sourceWidth && crop.y+crop.height<=crop.sourceHeight);
/** Convert an authored ad to the existing approved voice/caption/CTA renderer contract. */
export function materializePromo(item,plan,{voiceProfile,ctaLab,composeCta}) {
 if(item.id!==plan.id||item.contentType!=='advertisement')throw Error('Promo calendar/source mismatch');
 const episode={id:item.id,date:item.date,timezone:'Asia/Shanghai',kind:'advertisement',
  languageCode:plan.languageCode,title:plan.title,topic:plan.benefit,caption:plan.caption??plan.title,
  hashtags:plan.hashtags??[],voiceProvider:voiceProfile.provider,voiceProfileId:voiceProfile.profileId,
  durationTargetSec:plan.durationTargetSec??50,motionDesign:true,motionDesignStyle:'minimalist-promo-v1',
  contentIdentity:contentIdentity(item,{language:plan.language,source:plan}),
  scenes:plan.beats.map((beat,index)=>({id:beat.id,kind:index===0?'hook':'context',
   headline:beat.visual.focalSubject,narration:beat.narration,captionStyleId:'highlight',
   promoVisual:structuredClone(beat.visual),durationSec:4}))};
 const ready=composeCta(episode,ctaLab);
 validatePromoMedia(ready);
 return ready;
}
export function validatePromoMedia(episode,policy=visualSystem.promoPresentation) {
 if(episode.kind!=='advertisement'||episode.motionDesignStyle!=='minimalist-promo-v1')throw Error('Explicit promo media style required');
 const realistic=promoNeedsRealisticArt(episode,policy);
 for(const scene of episode.scenes.filter(s=>s.kind!=='cta')) {
  const visual=scene.promoVisual;
  if(!visual||!scene.narration.includes(visual.cueText)||visual.limitations?.trim())throw Error(scene.id+': resolve promo artwork/capture limitations before voice/render');
  if(realistic) {
   const frame=visual.type==='illustration'?promoArtFrame(episode.id,visual.assetPath)
    :promoArtFrame(episode.id,visual.backdropPath)??(visual.screenMotion?.kind==='entry'?promoArtFrame(episode.id,visual.screenMotion.leadInPath):null);
   if(!frame)throw Error(scene.id+': realistic ad frames are required (owner 2026-11-23) — '+(visual.type==='illustration'?'assetPath':'backdropPath or screenMotion entry leadInPath')+
    ' must be public/lesson-art/'+episode.id+'/<name>.jpg from content/lesson-art/'+episode.id+'.json; vector-only graphic drawings are not accepted. See content/PROMO_WORKFLOW.md.');
  }
  if(visual.type==='illustration') {
   if(visual.assetPath) {
    if(!/^public\/promo-art\/[a-z0-9/-]+\.(?:jpg|png)$/u.test(visual.assetPath)&&!promoArtFrame(episode.id,visual.assetPath))
     throw Error(scene.id+': expected original artwork under public/promo-art or public/lesson-art/'+episode.id);
   } else {
    validateGraphicScene(visual.graphic);
    if(!visual.graphic.tracks.length)throw Error(scene.id+': author the meaningful drawing movement');
   }
  } else if(visual.type==='product-capture') {
   if(!visual.screenImage||!promoCaptureLanguageMatches(visual,episode.languageCode,episode.id)||!validCrop(visual.crop))
    throw Error(scene.id+': genuine language-matched cropped product image required');
   const motion=visual.screenMotion;
   if(motion && (motion.kind==='entry' ? !motion.leadInPath : motion.kind!=='swipe-focus' ||
    !motion.previous?.screenImage || !validCrop(motion.previous.crop) || !validCrop(motion.focusCrop) ||
    motion.focusCrop.sourceWidth!==visual.crop.sourceWidth || motion.focusCrop.sourceHeight!==visual.crop.sourceHeight))
    throw Error(scene.id+': incomplete product screen animation');
  } else throw Error('Unsupported promo media type');
 }
 return true;
}
export function compilePromoTimeline(episode, fps=30) {
 if(episode.kind!=='advertisement')return null;
 validatePromoMedia(episode);
 if(episode.captionSource!=='gemini-word-timestamps'||!episode.captions?.length)throw Error('Promo requires real word timestamps');
 return {schemaVersion:1,episodeId:episode.id,timingSource:episode.captionSource,
  scenes:episode.scenes.filter(s=>s.kind!=='cta').map(scene=>({sceneId:scene.id,cue:resolvePromoCue(scene,episode.captions,fps,episode.languageCode)}))};
}
