import {resolveMotionBeats} from './motion-design-plan.mjs';
export function resolvePromoCue(scene,captions,fps=30,locale='ru-RU') {
 return resolveMotionBeats({...scene,motionBeats:[{id:'promo-action',kind:'question',cueText:scene.promoVisual.cueText}]},captions,fps,locale)[0];
}
