import {AbsoluteFill, Easing, Img, interpolate, staticFile} from "remotion";
import type {ResolvedMotionBeat} from "../scripts/motion-design-plan.mjs";
import visual from "../content/visual-system.json";
import {activeNarratedBeat} from "../scripts/narrated-beat-state.mjs";

/**
 * Illustrated-glass lesson frame (owner decision 2026-11-09, modelled on the
 * owner's reference reels): generated illustrations as the real scene, a
 * camera that pushes to the spoken subject, liquid-glass cards and chips,
 * dotted connectors, measured marks and stamps. Every change is triggered by
 * the beat's exact spoken cue; nothing moves on a timer.
 */
type Box={x:number;y:number;w:number;h:number};
export type Illustration={
  layout:"scene"|"pair"|"board";
  images:string[];
  icons?:(string|null)[];
  anchors?:Record<string,Box>;
  focus?:string;
  overlay?:"rise"|"marks"|"link"|"cross"|"drop"|"compare"|"adjective";
  parts?:string[];
};

const G=visual.referenceGlass;
const C=visual.colors;
const W=1080, H=1920;
const ease={extrapolateLeft:"clamp" as const,extrapolateRight:"clamp" as const,easing:Easing.bezier(.2,.8,.2,1)};
const pop=(local:number,start=0,frames=10)=>interpolate(local,[start,start+frames],[0,1],ease);

// Liquid glass: refracted, blurred backdrop + specular rim (Chromium renders
// SVG reference filters in backdrop-filter, which the Remotion renderer uses).
export const LiquidGlassDefs:React.FC=()=><svg width="0" height="0" style={{position:"absolute"}}>
  <filter id="liquid-glass" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="2" seed="7" result="noise"/>
    <feGaussianBlur in="noise" stdDeviation="2.5" result="soft"/>
    <feDisplacementMap in="SourceGraphic" in2="soft" scale="46" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>;

export const LiquidGlass:React.FC<{children:React.ReactNode;style?:React.CSSProperties;radius?:number;tint?:string}>=({children,style,radius=40,tint="rgba(255,255,255,.14)"})=>
  <div style={{position:"relative",borderRadius:radius,overflow:"hidden",background:tint,
    backdropFilter:"url(#liquid-glass) blur(16px) saturate(1.7)",WebkitBackdropFilter:"blur(16px) saturate(1.7)",
    border:"1.5px solid rgba(255,255,255,.38)",
    boxShadow:"0 24px 60px rgba(0,0,0,.32), inset 0 1.5px 0 rgba(255,255,255,.65), inset 0 -1px 0 rgba(255,255,255,.18)",...style}}>
    <div style={{position:"absolute",inset:0,borderRadius:radius,pointerEvents:"none",
      background:"linear-gradient(140deg, rgba(255,255,255,.42) 0%, rgba(255,255,255,.06) 32%, transparent 55%, rgba(255,255,255,.10) 100%)"}}/>
    <div style={{position:"relative"}}>{children}</div>
  </div>;

const art=(episodeId:string,name:string)=>staticFile(`lesson-art/${episodeId}/${name}.png`);
type Camera={scale:number;cx:number;cy:number};
const cameraFor=(ill:Illustration|undefined):Camera=>{
  const box=ill?.focus&&ill.anchors?.[ill.focus];
  if(ill?.layout==="scene"&&box) return {scale:1.32,cx:box.x+box.w/2,cy:box.y+box.h*.42};
  return {scale:1.04,cx:.5,cy:.62};
};
const pct=(value:number)=>`${value*100}%`;

const Marks:React.FC<{a:Box;b:Box;local:number;rise:boolean}>=({a,b,local,rise})=>{
  const p=pop(local,0,12);
  const left=Math.min(a.x,b.x)-.03, right=Math.max(a.x+a.w,b.x+b.w)+.03;
  return <svg viewBox="0 0 1 1" preserveAspectRatio="none" style={{position:"absolute",inset:0,width:"100%",height:"100%",overflow:"visible"}}>
    {[a.y,b.y].map((y,i)=><line key={i} x1={left} x2={left+(right-left)*p} y1={y} y2={y} stroke={i?"rgba(255,255,255,.75)":C.brandGold}
      strokeWidth={i?2.5:3.5} strokeDasharray="10 9" vectorEffect="non-scaling-stroke" strokeLinecap="round"/>)}
    {rise&&<g opacity={pop(local,6,10)}>
      <line x1={right-.02} x2={right-.02} y1={b.y} y2={b.y-(b.y-a.y)*pop(local,6,14)} stroke={C.brandGold} strokeWidth="9" vectorEffect="non-scaling-stroke" strokeLinecap="round"/>
    </g>}
  </svg>;
};

const Link:React.FC<{from:Box;to:Box;local:number;label:string}>=({from,to,local,label})=>{
  const p=pop(local,0,16);
  const x1=from.x+from.w*.5, y1=from.y+.02, x2=to.x+to.w*.5, y2=to.y+.02;
  const mx=(x1+x2)/2, my=Math.min(y1,y2)-.08;
  const d=`M${x1} ${y1} Q${mx} ${my} ${x2} ${y2}`;
  return <>
    <svg viewBox="0 0 1 1" preserveAspectRatio="none" style={{position:"absolute",inset:0,width:"100%",height:"100%",overflow:"visible"}}>
      <path d={d} fill="none" stroke="#FFFFFF" strokeWidth="4" strokeDasharray="2 14" strokeLinecap="round" vectorEffect="non-scaling-stroke"
        pathLength={1} strokeDashoffset={0} opacity={p} style={{clipPath:`inset(0 ${(1-p)*100}% 0 0)`}}/>
    </svg>
    <div style={{position:"absolute",left:pct(mx),top:pct(my+.015),translate:"-50% -50%",scale:.6+.4*pop(local,8,10),opacity:pop(local,8,8)}}>
      <LiquidGlass radius={999} tint="rgba(233,169,22,.35)" style={{padding:"10px 26px"}}>
        <span style={{fontFamily:G.hanziFontFamily,fontSize:58,fontWeight:800,color:"#FFFFFF"}}>{label}</span>
      </LiquidGlass>
    </div>
  </>;
};

const FocusTag:React.FC<{box:Box;local:number;label:string}>=({box,local,label})=><>
  <div style={{position:"absolute",left:pct(box.x-.015),top:pct(box.y-.012),width:pct(box.w+.03),height:pct(box.h+.02),
    borderRadius:36,border:`5px solid ${C.brandGold}`,boxShadow:`0 0 40px ${C.brandGold}88, inset 0 0 30px ${C.brandGold}44`,
    opacity:pop(local,2,10),scale:1.06-.06*pop(local,2,12)}}/>
  <div style={{position:"absolute",left:pct(box.x+box.w/2),top:pct(box.y-.035),translate:"-50% -100%",opacity:pop(local,6,8),scale:.7+.3*pop(local,6,10)}}>
    <LiquidGlass radius={999} style={{padding:"8px 26px"}}>
      <span style={{fontFamily:G.hanziFontFamily,fontSize:52,fontWeight:800,color:"#FFFFFF"}}>{label}</span>
    </LiquidGlass>
  </div>
</>;

const Stamp:React.FC<{local:number}>=({local})=><div style={{position:"absolute",right:"7%",top:"30%",rotate:`${-12+6*(1-pop(local,0,8))}deg`,
  scale:1.6-.6*pop(local,0,8),opacity:pop(local,0,5)}}>
  <div style={{width:150,height:150,borderRadius:999,background:C.brandRed,display:"flex",alignItems:"center",justifyContent:"center",
    boxShadow:"0 18px 40px rgba(0,0,0,.4), inset 0 2px 0 rgba(255,255,255,.4)",border:"5px solid #FFFFFF"}}>
    <svg width="74" height="74" viewBox="0 0 10 10"><path d="M2 2L8 8M8 2L2 8" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round"/></svg>
  </div>
</div>;

const SceneLayer:React.FC<{episodeId:string;ill:Illustration;beat:ResolvedMotionBeat;local:number;camera:Camera}>=({episodeId,ill,beat,local,camera})=>{
  const a=ill.anchors?.a, b=ill.anchors?.b;
  // Cover-fit a 9:16 illustration; the overlays share the camera transform.
  return <div style={{position:"absolute",left:0,top:0,width:W,height:H,transformOrigin:`${camera.cx*100}% ${camera.cy*100}%`,scale:camera.scale}}>
    <Img src={art(episodeId,ill.images[0])} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
    {a&&b&&(ill.overlay==="marks"||ill.overlay==="rise"||ill.overlay==="cross")&&<Marks a={a} b={b} local={local} rise={ill.overlay!=="marks"}/>}
    {a&&b&&ill.overlay==="link"&&<Link from={a} to={b} local={local} label="比"/>}
    {ill.focus&&ill.anchors?.[ill.focus]&&<FocusTag box={ill.anchors[ill.focus]} local={local} label={ill.focus==="a"?"A":"B"}/>}
    {ill.overlay==="cross"&&<Stamp local={local}/>}
    <span data-beat={beat.id} style={{display:"none"}}/>
  </div>;
};

const PairLayer:React.FC<{episodeId:string;ill:Illustration;local:number}>=({episodeId,ill,local})=>{
  const focusIndex=ill.focus==="left"?0:ill.focus==="right"?1:-1;
  return <>
    <Img src={art(episodeId,ill.images[1]??ill.images[0])} style={{position:"absolute",inset:-60,width:W+120,height:H+120,objectFit:"cover",filter:"blur(34px) brightness(.55) saturate(1.2)"}}/>
    <div style={{position:"absolute",left:60,right:60,top:700,height:640,display:"flex",gap:40,justifyContent:"center"}}>
      {ill.images.slice(0,2).map((name,index)=>{
        const focused=index===focusIndex, dimmed=focusIndex>=0&&!focused;
        const icon=ill.icons?.[index];
        return <div key={name} style={{position:"relative",flex:1,opacity:dimmed?.55:1,scale:focused?1.06:1,transition:"none",
          translate:`0 ${(1-pop(local,index*3,12))*40}px`}}>
          <div style={{position:"absolute",inset:0,borderRadius:44,overflow:"hidden",
            border:`${focused?6:2}px solid ${focused?C.brandGold:"rgba(255,255,255,.5)"}`,
            boxShadow:focused?`0 0 60px ${C.brandGold}77, 0 30px 70px rgba(0,0,0,.45)`:"0 30px 70px rgba(0,0,0,.45)"}}>
            <Img src={art(episodeId,name)} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          </div>
          {icon&&(ill.overlay==="drop"||ill.overlay==="compare"||focusIndex>=0)&&<div style={{position:"absolute",right:-16,top:-30,width:150,height:150,
            borderRadius:40,overflow:"hidden",background:"#FFFFFF",border:"3px solid rgba(255,255,255,.9)",
            boxShadow:"0 18px 40px rgba(0,0,0,.35)",scale:.6+.4*pop(local,4+index*3,10),opacity:pop(local,4+index*3,8)}}>
            <Img src={art(episodeId,icon)} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
          </div>}
          {focused&&<div style={{position:"absolute",left:"50%",bottom:-36,translate:"-50% 0",opacity:pop(local,4,8)}}>
            <LiquidGlass radius={999} style={{padding:"8px 30px"}}><span style={{fontSize:52,fontWeight:800,color:"#FFFFFF"}}>{index?"A":"B"}</span></LiquidGlass>
          </div>}
        </div>;
      })}
    </div>
    {ill.overlay==="compare"&&<div style={{position:"absolute",left:"50%",top:1020,translate:"-50% -50%",scale:.6+.4*pop(local,6,10),opacity:pop(local,6,8)}}>
      <LiquidGlass radius={999} tint="rgba(233,169,22,.4)" style={{padding:"12px 30px"}}><span style={{fontFamily:G.hanziFontFamily,fontSize:60,fontWeight:800,color:"#FFFFFF"}}>比</span></LiquidGlass>
    </div>}
    {ill.overlay==="drop"&&<svg width={W} height={H} style={{position:"absolute",inset:0}}>
      <path d={`M 800 640 L 800 ${640+90*pop(local,6,12)}`} stroke="#9FD4FF" strokeWidth="12" strokeLinecap="round"/>
      <path d={`M 772 ${700+30*pop(local,6,12)} L 800 ${730+30*pop(local,6,12)} L 828 ${700+30*pop(local,6,12)}`} fill="none" stroke="#9FD4FF" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" opacity={pop(local,10,6)}/>
    </svg>}
  </>;
};

const BoardLayer:React.FC<{episodeId:string;ill:Illustration;local:number}>=({episodeId,ill,local})=><>
  <Img src={art(episodeId,ill.images[0])} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",scale:1.05+.02*pop(local,0,60)}}/>
  <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.05) 38%, rgba(0,0,0,.05) 70%, rgba(0,0,0,.45) 100%)"}}/>
  <div style={{position:"absolute",left:110,right:110,top:880,display:"flex",flexWrap:"wrap",gap:22,justifyContent:"center",alignItems:"center"}}>
    {(ill.parts??[]).map((part,index)=>{
      const p=pop(local,index*4,10);
      const hanzi=/\p{Script=Han}/u.test(part);
      return <div key={index} style={{opacity:p,scale:.6+.4*p,translate:`0 ${(1-p)*30}px`}}>
        <div style={{padding:"18px 30px",borderRadius:28,background:hanzi?C.brandGold:"#211D17",color:"#FFFFFF",
          fontFamily:hanzi?G.hanziFontFamily:G.fontFamily,fontSize:hanzi?76:60,fontWeight:800,
          boxShadow:"0 16px 34px rgba(0,0,0,.28), inset 0 2px 0 rgba(255,255,255,.3)"}}>{part}</div>
      </div>;
    })}
  </div>
</>;

export const IllustratedLessonScene:React.FC<{episodeId:string;frame:number;beats:ResolvedMotionBeat[]}>=({episodeId,frame,beats})=>{
  const active=activeNarratedBeat(beats,frame);
  if(!active?.visual) return <AbsoluteFill style={{background:"#08090B"}}/>;
  const ill=(active.visual as {illustration?:Illustration}).illustration;
  if(!ill) throw Error(active.id+": illustrated lesson beat needs an illustration.");
  const index=beats.indexOf(active);
  const previous=index>0?(beats[index-1].visual as {illustration?:Illustration}).illustration:undefined;
  const local=Math.max(0,frame-active.localFrame);
  // Camera pushes from the previous beat's framing to this one's subject.
  const from=previous?.layout===ill.layout?cameraFor(previous):cameraFor(ill);
  const to=cameraFor(ill);
  const t=pop(local,0,16);
  const drift=1+Math.min(local,240)*.00018;
  const camera={scale:(from.scale+(to.scale-from.scale)*t)*drift,cx:from.cx+(to.cx-from.cx)*t,cy:from.cy+(to.cy-from.cy)*t};
  const layoutChanged=previous?.layout!==ill.layout;
  const enter=layoutChanged?pop(local,0,9):1;
  const model=active.visual;
  const words=(model.title??"").split(/\s+/).filter(Boolean);
  return <AbsoluteFill style={{background:"#08090B",color:"#FFFFFF",fontFamily:G.fontFamily,overflow:"hidden"}}>
    <LiquidGlassDefs/>
    <div style={{position:"absolute",inset:0,opacity:enter,filter:`blur(${(1-enter)*14}px)`}}>
      {ill.layout==="scene"&&<SceneLayer episodeId={episodeId} ill={ill} beat={active} local={local} camera={camera}/>}
      {ill.layout==="pair"&&<PairLayer episodeId={episodeId} ill={ill} local={local}/>}
      {ill.layout==="board"&&<BoardLayer episodeId={episodeId} ill={ill} local={local}/>}
    </div>
    <div style={{position:"absolute",left:0,right:0,top:0,height:760,background:"linear-gradient(180deg, rgba(6,8,12,.78) 0%, rgba(6,8,12,.45) 55%, transparent 100%)"}}/>
    <div style={{position:"absolute",left:0,right:0,bottom:0,height:620,background:"linear-gradient(0deg, rgba(6,8,12,.82) 0%, rgba(6,8,12,.5) 45%, transparent 100%)"}}/>
    <div style={{position:"absolute",top:110,left:0,right:0,display:"flex",justifyContent:"center"}}>
      <LiquidGlass radius={999} style={{padding:"10px 24px 10px 12px"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,fontSize:28,fontWeight:700}}>
          <Img src={staticFile("branding/hsk-ai-logo-1024.png")} style={{width:40,height:40,borderRadius:12}}/>HSK <span style={{color:C.brandGold}}>AI</span>
        </div>
      </LiquidGlass>
    </div>
    <div data-reference-headline style={{position:"absolute",top:215,left:80,right:80,textAlign:"center",fontSize:72,fontWeight:800,
      lineHeight:1.06,letterSpacing:-.8,textShadow:"0 6px 30px rgba(0,0,0,.45)"}}>
      {words.map((word,i)=>{
        const p=interpolate(local,[i*G.wordStaggerFrames,i*G.wordStaggerFrames+G.wordEntryFrames],[0,1],ease);
        return <span key={i} style={{display:"inline-block",marginRight:18,opacity:p,filter:`blur(${(1-p)*10}px)`,translate:`0 ${(1-p)*16}px`,
          fontFamily:/\p{Script=Han}/u.test(word)?G.hanziFontFamily:undefined,color:/\p{Script=Han}/u.test(word)?C.brandGold:undefined}}>{word}</span>;
      })}
    </div>
    <div style={{position:"absolute",top:470,left:0,right:0,display:"flex",justifyContent:"center",
      opacity:pop(local,3,8),scale:.88+.12*pop(local,3,12)}}>
      <LiquidGlass radius={44} style={{padding:"14px 34px"}}>
        <div data-reference-chip style={{display:"flex",alignItems:"baseline",justifyContent:"center",flexWrap:"wrap",columnGap:20,maxWidth:900}}>
          <span style={{fontFamily:G.hanziFontFamily,fontSize:66,fontWeight:800}}>{model.hanzi}</span>
          <span style={{fontSize:36,fontWeight:700,color:C.brandGold}}>{model.pinyin}</span>
          <span style={{fontSize:34,fontWeight:600,color:"rgba(255,255,255,.88)"}}>{model.meaning}</span>
        </div>
      </LiquidGlass>
    </div>
  </AbsoluteFill>;
};
