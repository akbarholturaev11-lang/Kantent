/**
 * Isolated REMOTION visual storyboard for owner inspection only.
 * Renders ORIGINAL calendar-authored graphic beats with no invented Gemini
 * word cues, no artificial subtitle timing and no audio or publication.
 * Production HSKAI-Episode remains unchanged and strictly word-gated.
 */
import {AbsoluteFill,Composition,interpolate,useCurrentFrame} from "remotion";
import ruEpisode from "../content/episodes/hui-vs-neng-pool-20261028.json";
import tgEpisode from "../content/locales/tg/episodes/hui-vs-neng-pool-20261028.json";
import visualSystem from "../content/visual-system.json";
import {GraphicScene} from "./GraphicScene";
import type {GraphicScene as GraphicPlan} from "../scripts/graphic-scene.mjs";

const FPS=30;
const C=visualSystem.colors;
const palette:Record<string,string>={
 foreground:C.foreground,secondary:C.muted,muted:C.muted,
 background:C.background,teal:C.brandTeal,red:C.brandRed,
 gold:C.brandGold,poolDeck:"#EAE0CC",poolWater:"#2FA06A",
 poolRipple:"#B5DCC9",none:"none",
};
type Episode=typeof ruEpisode;
const duration=(ep:Episode)=>ep.scenes.reduce((sum,s)=>sum+Math.ceil(s.durationSec*FPS),0);
type PreviewProps={language:"ru"|"tg"};
const VisualOnly:React.FC<PreviewProps>=({language})=>{
 const frame=useCurrentFrame();
 const episode:Episode=language==="ru"?ruEpisode:tgEpisode as unknown as Episode;
 let from=0;
 let scene=episode.scenes[0];
 let frameInScene=0;
 for(const current of episode.scenes){
  const length=Math.ceil(current.durationSec*FPS);
  if(frame<from+length){scene=current;frameInScene=frame-from;break;}
  from+=length;
 }
 const beats=scene.motionBeats;
 const sceneLength=Math.ceil(scene.durationSec*FPS);
 const beatIndex=Math.min(beats.length-1,Math.floor(frameInScene*beats.length/sceneLength));
 const beat=beats[beatIndex];
 const start=Math.ceil(beatIndex*sceneLength/beats.length);
 const end=Math.ceil((beatIndex+1)*sceneLength/beats.length);
 const local=Math.max(0,frameInScene-start);
 const beatOpacity=Math.min(
  interpolate(local,[0,8],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"}),
  interpolate(frameInScene,[Math.max(0,end-7),end],[1,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"})
 );
 const graphic=beat.visual?.graphic;
 if(!graphic) throw Error("Missing existing authored graphic scene, no generic replacement");
 const hanzi=String(beat.visual?.hanzi??"").trim();
 // Source Hanzi is planning metadata for design review; it is NOT a subtitle.
 const size=hanzi.length>9?64:hanzi.length>5?80:108;
 return <AbsoluteFill style={{backgroundColor:C.background,fontFamily:'"Noto Sans CJK SC", "Noto Sans CJK JP", "Noto Sans CJK TC", "PingFang SC", Arial, sans-serif',overflow:"hidden"}}>
  <div style={{position:"absolute",top:360,left:0,width:"100%",
   fontWeight:850,fontSize:38,letterSpacing:3,textAlign:"center",color:C.foreground}}>HSK AI</div>
  <div style={{position:"absolute",left:82,right:82,top:640,height:730,
   display:"flex",alignItems:"center",justifyContent:"center",
   opacity:beatOpacity,transform:`translateY(${(1-beatOpacity)*14}px)`}}>
   <GraphicScene plan={graphic as unknown as GraphicPlan} frame={local} height={650} fps={FPS} palette={palette}/>
  </div>
  <div style={{position:"absolute",top:1400,left:82,right:82,textAlign:"center",
   fontSize:size,fontWeight:820,lineHeight:1.12,color:C.foreground,opacity:beatOpacity}}>
   {hanzi}
  </div>
 </AbsoluteFill>;
};

export const HuiNengVisualReview:React.FC=()=> <><Composition
 id="HSKAI-HuiNeng-RU-Visual-Review" component={VisualOnly} width={1080} height={1920}
 fps={FPS} durationInFrames={duration(ruEpisode)} defaultProps={{language:"ru" as const}}/>
 <Composition id="HSKAI-HuiNeng-TG-Visual-Review" component={VisualOnly}
 width={1080} height={1920} fps={FPS} durationInFrames={duration(tgEpisode as unknown as Episode)}
 defaultProps={{language:"tg" as const}}/>
 </>;
