import type {CSSProperties} from "react";
import {AbsoluteFill} from "remotion";
import visual from "../../content/visual-system.json";
import {bell} from "../../scripts/pro-motion-plan.mjs";
import type {ProMotionPolicy, SceneTransition} from "../../scripts/pro-motion-plan.mjs";

/** Scene-boundary transitions, film finish and their small helpers
 * (content/EDITING_SPEC.md#professional-motion-system). All frame-driven. */
export const PRO=visual.proMotion as ProMotionPolicy;
export const clamp01=(value:number)=>Math.min(1,Math.max(0,value));
export const easeOut=(t:number)=>1-(1-clamp01(t))**3;
export const easeIn=(t:number)=>clamp01(t)**3;
export const easeInOut=(t:number)=>{const x=clamp01(t);return x<.5?4*x*x*x:1-(-2*x+2)**3/2;};

/** Directional (x/y) Gaussian blur as an SVG filter referenced from CSS. */
export const BlurFilter:React.FC<{id:string;x:number;y:number}>=({id,x,y})=>
  <svg width="0" height="0" style={{position:"absolute"}} aria-hidden="true">
    <filter id={id} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
      <feGaussianBlur stdDeviation={`${x.toFixed(2)} ${y.toFixed(2)}`} edgeMode="duplicate"/>
    </filter>
  </svg>;
export const blurStyle=(id:string,blur?:{x:number;y:number}):CSSProperties=>
  blur&&(blur.x>=.3||blur.y>=.3)?{filter:`url(#${id})`}:{};

export type ArtTransition={style:CSSProperties;blur?:{x:number;y:number};wipeEdge?:number};

/** How the scene art enters (`in`, scene frames 0…T) or leaves (`out`,
 * the crossfade tail after the scene's own duration). Text stays put. */
export function sceneTransitionArt(type:SceneTransition|null|undefined,phase:"in"|"out",t:number):ArtTransition|null{
  const s=PRO.sceneTransition, T=s.frames;
  if(!type||t<0||t>=T)return null;
  if(phase==="in"){
    if(type==="zoom-through"){const p=easeOut(t/T),b=s.zoomThroughBlurPx*(1-p);
      return {style:{scale:1+s.zoomThroughScale*.9*(1-p),opacity:clamp01((t+1)/6)},blur:{x:b,y:b}};}
    if(type==="wipe"){const p=easeInOut(t/(T-2)),edge=120-140*p;
      return {style:{clipPath:`polygon(${edge}% 0%, 100% 0%, 100% 100%, ${edge-20}% 100%)`},wipeEdge:p<1?edge:undefined};}
    if(type==="whip-up"){const p=1-(1-clamp01(t/T))**5;
      return {style:{translate:`0 ${(1-p)*s.whipDistancePct}%`},blur:{x:0,y:s.whipBlurPx*(1-p)**2}};}
    return {style:{opacity:easeInOut(t/T)}};
  }
  if(type==="zoom-through"){const p=easeIn(t/T),b=s.zoomThroughBlurPx*p;
    return {style:{scale:1+s.zoomThroughScale*p},blur:{x:b,y:b}};}
  if(type==="wipe")return {style:{scale:1+.04*easeInOut(t/T)}};
  if(type==="whip-up"){const p=easeIn(t/T);
    return {style:{translate:`0 ${-p*s.whipDistancePct}%`},blur:{x:0,y:s.whipBlurPx*p}};}
  return null;
}

/** Warm light leak across a soft dissolve (a gradient bloom, never a flash). */
export const LightLeak:React.FC<{frame:number;frames:number}>=({frame,frames})=>{
  const opacity=PRO.sceneTransition.lightLeakOpacity*bell(frame,frames);
  if(opacity<.004)return null;
  const x=-30+160*clamp01(frame/frames);
  return <AbsoluteFill style={{pointerEvents:"none",mixBlendMode:"screen",opacity,
    background:`radial-gradient(60% 45% at ${x}% 38%, rgba(255,196,120,.95) 0%, rgba(255,140,60,.5) 35%, transparent 70%), radial-gradient(40% 30% at ${x+25}% 72%, rgba(255,228,186,.7) 0%, transparent 70%)`}}/>;
};

/** Soft gold edge that rides the diagonal wipe. */
export const WipeEdge:React.FC<{edge:number}>=({edge})=>{
  const glow=PRO.sceneTransition.wipeGlowPx;
  return <AbsoluteFill style={{pointerEvents:"none",overflow:"hidden"}}>
    <div style={{position:"absolute",top:-120,bottom:-120,left:`${edge-10}%`,width:glow*4,
      rotate:"6.4deg",transformOrigin:"50% 0",
      background:`linear-gradient(90deg, transparent, rgba(255,214,140,.85), transparent)`,filter:`blur(${glow}px)`}}/>
  </AbsoluteFill>;
};

/** Cinematic finish over the lesson art: vignette and fine moving grain
 * (an SVG noise tile, re-offset every frame). */
export const FilmFinish:React.FC<{frame:number}>=({frame})=><AbsoluteFill style={{pointerEvents:"none"}}>
  <AbsoluteFill style={{background:`radial-gradient(ellipse 78% 62% at 50% 46%, transparent 55%, rgba(0,0,0,${PRO.finish.vignetteOpacity}) 100%)`}}/>
  <svg width="1080" height="1920" style={{position:"absolute",inset:0,mixBlendMode:"overlay",opacity:PRO.finish.grainOpacity}} aria-hidden="true">
    <defs>
      <filter id="pro-grain" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves={2} seed={3} stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
      <pattern id="pro-grain-tile" width="256" height="256" patternUnits="userSpaceOnUse"
        patternTransform={`translate(${(frame*97)%256} ${(frame*57)%256})`}>
        <rect width="256" height="256" filter="url(#pro-grain)"/>
      </pattern>
    </defs>
    <rect width="1080" height="1920" fill="url(#pro-grain-tile)"/>
  </svg>
</AbsoluteFill>;
