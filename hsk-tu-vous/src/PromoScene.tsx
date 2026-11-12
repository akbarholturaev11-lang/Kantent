import {AbsoluteFill, Easing, Img, interpolate, staticFile} from 'remotion';
import visualSystem from '../content/visual-system.json';
import {GraphicScene} from './GraphicScene';
import {Cast, type CastMember} from './IllustratedLessonScene';
import type {GraphicScene as GraphicPlan} from '../scripts/graphic-scene.mjs';
type ScreenCrop={x:number;y:number;width:number;height:number;sourceWidth:number;sourceHeight:number};
type Capture={screenImage:string;crop:ScreenCrop};
/** Genuine product screens only: `entry` rises over the artwork that led into it; `swipe-focus` pushes the next real screen in, then zooms onto `focusCrop`. */
export type ScreenMotion={kind:'entry';leadInPath:string}|{kind:'swipe-focus';previous:Capture;focusCrop:ScreenCrop};
export type PromoVisual={type:'illustration'|'product-capture';cueText:string;backgroundToken:string;
 assetPath?:string;backdropPath?:string;cast?:CastMember[];screenMotion?:ScreenMotion;
 graphic?:GraphicPlan;screenImage?:string;crop?:ScreenCrop;
 focalSubject:string;action:string;continuityKey:string};
const ease={extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:Easing.bezier(.18,.82,.2,1)} as const;
const push_={extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:Easing.bezier(.32,.72,0,1)} as const;
const clamp=(value:number,low:number,high:number)=>Math.min(high,Math.max(low,value));
const asset=(path:string)=>staticFile(path.replace(/^public\//,''));
const DEVICE_TOP=430,DEVICE_MAX_H=1000,DEVICE_MAX_W=520,BEZEL=10;

/** One real screen, cropped to `crop`, filling a W x H stage (no re-drawing, no simulated UI). */
const ScreenLayer:React.FC<{capture:Capture;W:number;H:number;style?:React.CSSProperties}>=({capture,W,H,style})=>{
 const {crop}=capture;
 return <div style={{position:'absolute',left:0,top:0,width:W,height:H,overflow:'hidden',...style}}>
  <Img src={staticFile(capture.screenImage)} style={{position:'absolute',width:W*crop.sourceWidth/crop.width,maxWidth:'none',left:-W*crop.x/crop.width,top:-W*crop.y/crop.width}}/>
 </div>;
};

/** Phone-shaped window onto the genuine capture(s), driven by the saved spoken cue frame. */
const ScreenDevice:React.FC<{visual:PromoVisual;motion:ScreenMotion;frame:number;cueFrame:number}>=({visual,motion,frame,cueFrame})=>{
 const crop=visual.crop!;
 const W=Math.round(Math.min(DEVICE_MAX_W,DEVICE_MAX_H*crop.width/crop.height));
 const H=Math.round(W*crop.height/crop.width);
 const current:Capture={screenImage:visual.screenImage!,crop};
 let appear=1,swipe=1,zoom=0,transform='';
 if(motion.kind==='entry'){
  appear=interpolate(frame,[cueFrame-8,cueFrame+10],[0,1],ease);
 }else{
  const swipeStart=2,swipeEnd=Math.max(swipeStart+10,Math.min(swipeStart+18,cueFrame-1));
  const zoomStart=Math.max(swipeEnd+2,cueFrame-2);
  swipe=interpolate(frame,[swipeStart,swipeEnd],[0,1],push_);
  zoom=interpolate(frame,[zoomStart,zoomStart+26],[0,1],ease);
  const focus=motion.focusCrop,factor=Math.min(3,crop.width/focus.width);
  const fx=(focus.x+focus.width/2-crop.x)/crop.width*W,fy=(focus.y+focus.height/2-crop.y)/crop.height*H;
  const endX=clamp(W/2-fx*factor,W-W*factor,0),endY=clamp(H/2-fy*factor,H-H*factor,0);
  const hold=interpolate(frame,[zoomStart+26,zoomStart+110],[0,1],ease);
  const scale=interpolate(zoom,[0,1],[1,factor])*(1+.04*hold);
  transform=`translate(${interpolate(zoom,[0,1],[0,endX])}px,${interpolate(zoom,[0,1],[0,endY])}px) scale(${scale})`;
 }
 const outerW=W+2*BEZEL,outerH=H+2*BEZEL;
 return <div style={{position:'absolute',left:(1080-outerW)/2,top:DEVICE_TOP,width:outerW,height:outerH,boxSizing:'border-box',padding:BEZEL,borderRadius:58,background:'#0e0d0c',
  boxShadow:'0 30px 90px rgba(0,0,0,.45)',opacity:appear,transform:`translateY(${(1-appear)*70}px) scale(${.95+.05*appear})`}}>
  <div style={{position:'relative',width:W,height:H,overflow:'hidden',borderRadius:46,background:'#000'}}>
   <div style={{position:'absolute',left:0,top:0,width:W,height:H,transformOrigin:'0 0',transform:transform||undefined}}>
    {motion.kind==='swipe-focus'&&<ScreenLayer capture={motion.previous} W={W} H={H} style={{transform:`translateX(${-.3*W*swipe}px)`,filter:`brightness(${1-.3*swipe})`}}/>}
    <ScreenLayer capture={current} W={W} H={H} style={motion.kind==='swipe-focus'?{transform:`translateX(${(1-swipe)*W}px)`,boxShadow:'-18px 0 40px rgba(0,0,0,.28)'}:undefined}/>
   </div>
  </div>
 </div>;
};
export const PromoScene:React.FC<{visual:PromoVisual;frame:number;cueFrame:number;durationFrames:number;first:boolean}>=({visual,frame,cueFrame,durationFrames,first})=>{
 const local=Math.max(0,frame-cueFrame);
 const motion=visual.type==='product-capture'&&visual.crop&&visual.screenImage?visual.screenMotion:undefined;
 // A pushed screen starts as the previous scene's last frame: no crossfade, or the old screen would ghost through the swipe.
 const opacity=first||motion?.kind==='swipe-focus'?1:interpolate(frame,[0,visualSystem.motion.sceneCrossfadeFrames],[0,1],ease);
 const bg=visualSystem.colors[visual.backgroundToken as keyof typeof visualSystem.colors];
 const textColor=visual.backgroundToken==='foreground'?visualSystem.narratedActionPalette.foreground:visualSystem.colors.foreground;
 const crop=visual.crop;
 const illustrated=visual.type==='illustration'&&visual.assetPath;
 const background=illustrated||visual.backdropPath;
 const push=interpolate(local,[0,Math.max(24,durationFrames-cueFrame)],[1.015,1.055],ease);
 return <AbsoluteFill style={{background:typeof bg==='string'?bg:visualSystem.colors.background,opacity,color:textColor}}>
  {background&&<>
   <Img src={staticFile(background.replace(/^public\//,''))} style={{position:'absolute',width:'100%',height:'100%',objectFit:'cover',scale:illustrated?push:1.12,filter:illustrated?undefined:'blur(27px) brightness(.6)'}}/>
   <AbsoluteFill style={{background:'linear-gradient(180deg,rgba(16,20,24,.48) 0%,transparent 28%,transparent 61%,rgba(15,18,24,.58) 100%)'}}/>
  </>}
  {motion?.kind==='entry'&&<Img src={asset(motion.leadInPath)} style={{position:'absolute',width:'100%',height:'100%',objectFit:'cover',scale:1.055,opacity:1-interpolate(frame,[cueFrame-8,cueFrame+10],[0,1],ease)}}/>}
  {illustrated&&visual.cast?.length&&<Cast cast={visual.cast} width={1080} height={1920} frame={frame} local={local}/>}
  <div style={{position:'absolute',top:visualSystem.motion.brandTopInsetPx,left:0,width:'100%',display:'flex',justifyContent:'center',alignItems:'center',gap:14,fontSize:30,fontWeight:700,color:background?'#fff3d9':undefined,textShadow:background?'0 3px 15px rgba(0,0,0,.7)':undefined}}>
   <Img src={staticFile('branding/hsk-ai-logo-1024.png')} style={{width:44,height:44,borderRadius:10}}/> HSK <span style={{color:visualSystem.colors.brandGold}}>AI</span>
  </div>
  {motion&&<ScreenDevice visual={visual} motion={motion} frame={frame} cueFrame={cueFrame}/>}
  {!motion&&<div style={{position:'absolute',left:110,right:110,top:450,height:780,display:'flex',alignItems:'center',justifyContent:'center'}}>
   {!illustrated&&visual.type==='illustration'&&visual.graphic ? <GraphicScene plan={visual.graphic} frame={local} height={700}/> :
    crop&&visual.screenImage ? <div style={{width:700,height:700*crop.height/crop.width,maxHeight:880,overflow:'hidden',borderRadius:36,position:'relative',transform:`translateY(${interpolate(local,[0,24],[24,0],ease)}px) scale(${interpolate(local,[0,Math.max(30,durationFrames-cueFrame)],[.96,1.02],ease)})`,boxShadow:'0 24px 70px rgba(0,0,0,.25)'}}>
     <Img src={staticFile(visual.screenImage)} style={{position:'absolute',width:700*crop.sourceWidth/crop.width,maxWidth:'none',left:-700*crop.x/crop.width,top:-700*crop.y/crop.width}}/>
    </div>:null}
  </div>}
 </AbsoluteFill>;
};
