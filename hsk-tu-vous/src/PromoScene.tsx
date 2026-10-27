import {AbsoluteFill, Easing, Img, interpolate, staticFile} from 'remotion';
import visualSystem from '../content/visual-system.json';
import {GraphicScene} from './GraphicScene';
import type {GraphicScene as GraphicPlan} from '../scripts/graphic-scene.mjs';
export type PromoVisual={type:'illustration'|'product-capture';cueText:string;backgroundToken:string;
 graphic?:GraphicPlan;screenImage?:string;crop?:{x:number;y:number;width:number;height:number;sourceWidth:number;sourceHeight:number};
 focalSubject:string;action:string;continuityKey:string};
const ease={extrapolateLeft:'clamp',extrapolateRight:'clamp',easing:Easing.bezier(.18,.82,.2,1)} as const;
export const PromoScene:React.FC<{visual:PromoVisual;frame:number;cueFrame:number;durationFrames:number;first:boolean}>=({visual,frame,cueFrame,durationFrames,first})=>{
 const local=Math.max(0,frame-cueFrame);
 const opacity=first?1:interpolate(frame,[0,visualSystem.motion.sceneCrossfadeFrames],[0,1],ease);
 const bg=visualSystem.colors[visual.backgroundToken as keyof typeof visualSystem.colors];
 const crop=visual.crop;
 return <AbsoluteFill style={{background:typeof bg==='string'?bg:visualSystem.colors.background,opacity,color:visualSystem.colors.foreground}}>
  <div style={{position:'absolute',top:visualSystem.motion.brandTopInsetPx,left:0,width:'100%',display:'flex',justifyContent:'center',alignItems:'center',gap:14,fontSize:30,fontWeight:700}}>
   <Img src={staticFile('branding/hsk-ai-logo-1024.png')} style={{width:44,height:44,borderRadius:10}}/> HSK <span style={{color:visualSystem.colors.brandGold}}>AI</span>
  </div>
  <div style={{position:'absolute',left:110,right:110,top:450,height:780,display:'flex',alignItems:'center',justifyContent:'center'}}>
   {visual.type==='illustration'&&visual.graphic ? <GraphicScene plan={visual.graphic} frame={local} height={700}/> :
    crop&&visual.screenImage ? <div style={{width:700,height:700*crop.height/crop.width,maxHeight:880,overflow:'hidden',borderRadius:36,position:'relative',transform:`translateY(${interpolate(local,[0,24],[24,0],ease)}px) scale(${interpolate(local,[0,Math.max(30,durationFrames-cueFrame)],[.96,1.02],ease)})`,boxShadow:'0 24px 70px rgba(0,0,0,.25)'}}>
     <Img src={staticFile(visual.screenImage)} style={{position:'absolute',width:700*crop.sourceWidth/crop.width,maxWidth:'none',left:-700*crop.x/crop.width,top:-700*crop.y/crop.width}}/>
    </div>:null}
  </div>
 </AbsoluteFill>;
};
