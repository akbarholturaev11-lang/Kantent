import {AbsoluteFill,Composition,useCurrentFrame} from "remotion";
import {selectVideoComponents} from "../../scripts/video-component-selector.mjs";
import {MotionDemoBackdrop,MotionStage,type MotionId} from "./MotionKit";

/**
 * Separate synthetic motion laboratory. It is NOT a lesson, customer account,
 * product screenshot, proof of functionality, or a published video.
 */
const DEMO_EPISODE={id:"motion-lab-demo",scenes:[
  {id:"hook",kind:"hook",narration:"Demo hook"},
  {id:"context",kind:"context",narration:"Demo context"},
  {id:"example",kind:"example",narration:"Demo example"},
  {id:"story",kind:"story",narration:"Demo story"},
  {id:"promo",kind:"promo",narration:"Demo promotion"},
]};
const PLAN=selectVideoComponents(DEMO_EPISODE,{contentType:"advertisement"});
const SCENE_FRAMES=48;
const FONT="'PingFang SC',system-ui,sans-serif";
export const MotionKitDemo:React.FC=()=>{
 const frame=useCurrentFrame(),i=Math.min(PLAN.sequence.length-1,Math.floor(frame/SCENE_FRAMES));
 const current=PLAN.scenes[i],local=frame-i*SCENE_FRAMES;
 return <AbsoluteFill><MotionDemoBackdrop>
   <div style={{position:"absolute",top:140,left:80,right:80,display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:FONT}}>
    <div style={{color:"#F6F2F0",fontSize:38,fontWeight:800}}>HSK <span style={{color:"#E04A40"}}>AI</span></div>
    <div style={{color:"#BABDC5",fontSize:24,letterSpacing:2}}>MOTION LAB</div>
   </div>
   <div style={{position:"absolute",top:470,left:90,right:90,height:850,display:"flex",alignItems:"center",justifyContent:"center"}}>
     <MotionStage id={current.componentId as MotionId} frame={local}/>
   </div>
   <div style={{position:"absolute",top:1395,left:80,right:80,fontFamily:FONT,fontSize:28,color:"#AEB1BC"}}>
     Selected component: {current.componentId} · {current.source}
   </div>
   <div style={{position:"absolute",top:1480,left:80,right:80,height:6,borderRadius:10,background:"rgba(255,255,255,.12)",overflow:"hidden"}}>
    <div style={{height:"100%",width:`${(frame+1)/(PLAN.sequence.length*SCENE_FRAMES)*100}%`,background:"#E04A40"}}/>
   </div>
   <div style={{position:"absolute",top:1545,left:80,right:80,color:"#AEB1BC",fontFamily:FONT,fontSize:25}}>
     TECHNICAL PREVIEW · NO REAL APP DATA · NO AUDIO
   </div>
 </MotionDemoBackdrop></AbsoluteFill>
};
export const MotionKitPilot=()=> <Composition id="MotionKitPilot" component={MotionKitDemo}
 durationInFrames={PLAN.sequence.length*SCENE_FRAMES} fps={30} width={1080} height={1920}/>;
