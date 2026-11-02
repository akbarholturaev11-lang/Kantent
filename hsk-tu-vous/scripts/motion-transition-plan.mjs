/**
 * M5: seek-safe, semantic beat transition styles.
 * Applies ONLY to authored action artwork, not voice, subtitles, logo or CTA.
 * Frame duration remains exactly unchanged. No overlays, network or timers.
 */
const ease=n=>{const x=Math.min(1,Math.max(0,n));return x*x*(3-2*x)};
const supported=new Set(["cut","crossfade","slide-match","masked-reveal","focus-reveal"]);
const directional=new Set(["slide-match","masked-reveal"]);
const object=x=>x!==null&&typeof x==="object"&&!Array.isArray(x);

export function validateMotionTransition(value){
  if(!object(value)||Object.keys(value).some(k=>!["kind","frames","direction"].includes(k))||
     !supported.has(value.kind)||!Number.isInteger(value.frames)||
     value.frames<0||value.frames>16)
    throw Error("Motion transition: invalid kind/frames/fields");
  if(value.kind==="cut"&&value.frames!==0||
     value.kind!=="cut"&&value.frames<2)
    throw Error("Motion transition: invalid duration");
  if(directional.has(value.kind)){
    if(!["left","right"].includes(value.direction))
      throw Error("Motion transition: slide/mask requires direction");
  }else if(value.direction!==undefined)throw Error("Motion transition: direction prohibited for this kind");
  return value;
}

const clean=()=>({opacity:1,transform:"none",clipPath:"none",filter:"none"});
export function resolveMotionTransition(value,frame,{slideDistancePx=44,focusBlurPx=2}={}){
  validateMotionTransition(value);
  if(!Number.isFinite(frame)||!Number.isFinite(slideDistancePx)||
     slideDistancePx<0||slideDistancePx>44||
     !Number.isFinite(focusBlurPx)||focusBlurPx<0||focusBlurPx>3)
    throw Error("Motion transition: frame or effect exceeds safe bounds");
  const outgoing=clean(),incoming=clean();
  if(value.kind==="cut")return {progress:1,incoming,outgoing:{...outgoing,opacity:0}};
  const progress=ease((frame+1)/value.frames);
  if(value.kind==="crossfade"){
    incoming.opacity=progress;outgoing.opacity=1-progress;
  }else if(value.kind==="slide-match"){
    const direction=value.direction==="left"?-1:1;
    incoming.opacity=progress;outgoing.opacity=1-progress;
    incoming.transform=`translateX(${-direction*(1-progress)*slideDistancePx}px)`;
    outgoing.transform=`translateX(${direction*progress*slideDistancePx}px)`;
  }else if(value.kind==="masked-reveal"){
    // The complete previous scene stays under the incoming scene. Never hide
    // future visual content before the real word cue.
    const covered=100*(1-progress);
    incoming.clipPath=value.direction==="left"
      ?`inset(0 ${covered}% 0 0)`
      :`inset(0 0 0 ${covered}%)`;
  }else if(value.kind==="focus-reveal"){
    incoming.opacity=progress;outgoing.opacity=1-progress;
    incoming.transform=`scale(${0.98+0.02*progress})`;
    incoming.filter=`blur(${focusBlurPx*(1-progress)}px)`;
  }
  return {progress,incoming,outgoing};
}
