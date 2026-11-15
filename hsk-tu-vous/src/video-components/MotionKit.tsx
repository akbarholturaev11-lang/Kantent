import type {CSSProperties,ReactNode} from "react";
import {Easing,interpolate} from "remotion";
import visual from "../../content/visual-system.json";

/** Original, deterministic Remotion adapters; visually informed by the vetted catalog. */
const COLORS=visual.colors;
const clamp={extrapolateLeft:"clamp" as const,extrapolateRight:"clamp" as const,easing:Easing.bezier(.2,.8,.2,1)};
const ease=(frame:number,start=0,duration=12)=>interpolate(frame,[start,start+duration],[0,1],clamp);
const sans="'PingFang SC','Hiragino Sans GB','Noto Sans CJK SC',system-ui,sans-serif";
const textStyle:CSSProperties={fontFamily:sans,fontWeight:850,color:"#F5F6F7",letterSpacing:"-.035em",lineHeight:1.14};
const glass:CSSProperties={
  border:"1.5px solid rgba(255,255,255,.25)",borderRadius:42,
  background:"linear-gradient(145deg,rgba(255,255,255,.14),rgba(255,255,255,.05) 50%,rgba(255,255,255,.1))",
  boxShadow:"0 25px 70px rgba(0,0,0,.29),inset 0 1px 0 rgba(255,255,255,.18)",
  backdropFilter:"blur(22px)",WebkitBackdropFilter:"blur(22px)",overflow:"hidden"
};
type Frame={frame:number};
export const TypeReveal=({frame,text,subtitle}:{frame:number;text:string;subtitle?:string})=>{
  const a=ease(frame,0,14);
  return <div style={{padding:"35px 0",opacity:a,translate:`0 ${Math.round((1-a)*32)}px`}}>
    <div style={{...textStyle,fontSize:text.length>18?75:106,maxWidth:880,overflowWrap:"anywhere"}}>{text}</div>
    {subtitle&&<div style={{fontFamily:sans,color:"#E8E1D8",fontWeight:550,fontSize:36,marginTop:25,opacity:ease(frame,11,12)}}>{subtitle}</div>}
  </div>;
};
export const CardReveal=({frame,title,detail}:{frame:number;title:string;detail:string})=>{
  const a=ease(frame,0,15);
  return <div style={{...glass,padding:48,maxWidth:900,opacity:a,scale:.96+.04*a,translate:`0 ${Math.round(38*(1-a))}px`}}>
    <div style={{fontFamily:sans,color:COLORS.brandGold,fontSize:23,fontWeight:800,letterSpacing:1}}>HSK AI</div>
    <div style={{...textStyle,fontSize:78,marginTop:30}}>{title}</div>
    <div style={{fontFamily:sans,color:"#ECECEC",fontSize:34,marginTop:24}}>{detail}</div>
  </div>;
};
export const GlassInfo=({frame,title,detail}:{frame:number;title:string;detail:string})=>{
  const a=ease(frame,2,13);
  return <div style={{...glass,padding:48,width:870,opacity:a,translate:`0 ${Math.round(26*(1-a))}px`}}>
    <div style={{height:8,width:88,background:COLORS.brandRed,borderRadius:8,marginBottom:33}}/>
    <div style={{...textStyle,fontSize:76}}>{title}</div>
    <div style={{fontFamily:sans,fontWeight:600,color:"#ECECEC",fontSize:35,marginTop:18}}>{detail}</div>
  </div>;
};
export const StateTransition=({frame,before,after}:{frame:number;before:string;after:string})=>{
  const a=ease(frame,16,15);
  const common:CSSProperties={...glass,padding:44,width:820,fontFamily:sans,fontSize:46,fontWeight:760,textAlign:"center"};
  return <div style={{position:"relative",height:235,width:870}}>
    <div style={{...common,position:"absolute",top:0,left:0,opacity:1-a,translate:`${Math.round(-28*a)}px 0`}}>{before}</div>
    <div style={{...common,position:"absolute",top:0,left:0,opacity:a,translate:`${Math.round(28*(1-a))}px 0`,borderColor:"rgba(47,160,106,.7)"}}>{after}</div>
  </div>;
};
export const ProgressTrace=({frame,steps}:{frame:number;steps:readonly string[]})=>{
  if(steps.length<2||steps.length>4)throw Error("ProgressTrace demo requires 2–4 explicit steps");
  const a=ease(frame,0,14);
  const progress=interpolate(frame,[0,33],[0,1],clamp);
  return <div style={{...glass,width:875,padding:50,opacity:a}}>
    <div style={{display:"flex",gap:14,marginBottom:42}}>
      {steps.map((step,i)=><div key={step} style={{flex:1}}>
        <div style={{height:10,background:"rgba(255,255,255,.16)",borderRadius:8,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${Math.max(0,Math.min(1,progress*steps.length-i))*100}%`,background:COLORS.brandTeal}}/>
        </div>
      </div>)}
    </div>
    <div style={{...textStyle,fontSize:58}}>{steps[Math.min(steps.length-1,Math.floor(progress*steps.length))]}</div>
  </div>;
};

/** Artwork-only motion adapters for active illustrated-glass lessons.
 * They wrap existing approved lesson art; no new text, cards, characters or copy. */
export const ArtDissolve=({frame,children}:{frame:number;children:ReactNode})=>{
  const amount=ease(frame,0,12);
  return <div style={{position:"relative",width:"100%",height:"100%",opacity:amount}}>
    {children}
  </div>;
};
export const ArtDrift=({frame,children}:{frame:number;children:ReactNode})=>{
  const position=interpolate(frame,[0,90],[0,1],clamp);
  return <div style={{position:"relative",width:"100%",height:"100%",overflow:"hidden"}}>
    <div style={{width:"100%",height:"100%",scale:1.015+.012*position,translate:`${Math.round(-5*position)}px ${Math.round(-7*position)}px`}}>
      {children}
    </div>
  </div>;
};
/** Read-only typed registry. It never imports the upstream web packages into Remotion. */
export type MotionId="art-dissolve"|"art-drift"|"type-reveal"|"card-reveal"|"glass-info"|"state-transition"|"progress-trace";
export const MotionStage=({id,frame}:{id:MotionId}&Frame)=>{
  switch(id){
    case "art-dissolve":return <ArtDissolve frame={frame}><div style={{width:700,height:650,background:"linear-gradient(120deg,rgba(224,74,64,.30),rgba(47,160,106,.3))",borderRadius:45}}/></ArtDissolve>;
    case "art-drift":return <ArtDrift frame={frame}><div style={{width:700,height:650,background:"linear-gradient(120deg,rgba(47,160,106,.3),rgba(224,74,64,.30))",borderRadius:45}}/></ArtDrift>;
    case "type-reveal":return <TypeReveal frame={frame} text="学中文" subtitle="Xué Zhōngwén · Хитой тилини ўрганиш"/>;
    case "card-reveal":return <CardReveal frame={frame} title="HSK AI" detail="UI motion component · technical demo"/>;
    case "glass-info":return <GlassInfo frame={frame} title="你好" detail="nǐ hǎo · салом"/>;
    case "state-transition":return <StateTransition frame={frame} before="Old state · demo" after="New state · demo"/>;
    case "progress-trace":return <ProgressTrace frame={frame} steps={["Step 1","Step 2","Step 3"]}/>;
  }
};
export const MotionDemoBackdrop=({children}:{children:ReactNode})=><div style={{position:"absolute",inset:0,
  background:"radial-gradient(circle at 76% 22%,rgba(224,74,64,.2),transparent 45%),radial-gradient(circle at 12% 80%,rgba(47,160,106,.11),transparent 42%),#13151A",overflow:"hidden"}}>
  {children}
</div>;
