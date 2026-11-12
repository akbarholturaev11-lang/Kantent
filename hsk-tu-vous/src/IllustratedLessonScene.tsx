import {AbsoluteFill, Easing, Img, interpolate, staticFile} from "remotion";
import type {ResolvedMotionBeat} from "../scripts/motion-design-plan.mjs";
import visual from "../content/visual-system.json";
import {activeNarratedBeat} from "../scripts/narrated-beat-state.mjs";
import {ILLUSTRATED_LAYOUT as LAY, cameraFor} from "../scripts/illustrated-layout.mjs";
import characters from "../content/characters/hsk-ai-characters.json";

/** One stable liquid-glass teaching card, one timed subtitle, and relevant art. */
type Box={x:number;y:number;w:number;h:number};
export type Illustration={
  layout:"scene"|"pair"|"board";
  images:string[];
  icons?:(string|null)[];
  anchors?:Record<string,Box>;
  focus?:string;
  overlay?:"rise"|"marks"|"link"|"cross"|"drop"|"compare"|"adjective"|"stamp";
  label?:string;
  focusLabel?:string;
  parts?:string[];
  cast?:CastMember[];
};
export type CastMember={id:string;mood?:string;x:number;y:number;h:number;card?:number};

type CardCopy={hanzi?:string;pinyin?:string;meaning?:string;illustration?:Illustration};
type Camera={scale:number;cx:number;cy:number};
const G=visual.referenceGlass;
const C=visual.colors;
const W=1080, H=1920;
const ease={extrapolateLeft:"clamp" as const,extrapolateRight:"clamp" as const,easing:Easing.bezier(.2,.8,.2,1)};
const pop=(local:number,start=0,frames=10)=>interpolate(local,[start,start+frames],[0,1],ease);

export const LiquidGlassDefs:React.FC=()=><svg width="0" height="0" style={{position:"absolute"}}>
  <filter id="liquid-glass" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.006 0.009" numOctaves="2" seed="7" result="noise"/>
    <feGaussianBlur in="noise" stdDeviation="2.5" result="soft"/>
    <feDisplacementMap in="SourceGraphic" in2="soft" scale="46" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
</svg>;

export const LiquidGlass:React.FC<{children:React.ReactNode;style?:React.CSSProperties;radius?:number;tint?:string}>=({children,style,radius=40,tint="rgba(14,16,22,.42)"})=>
  <div style={{position:"relative",borderRadius:radius,overflow:"hidden",background:tint,
    backdropFilter:"url(#liquid-glass) blur(16px) saturate(1.7)",WebkitBackdropFilter:"blur(16px) saturate(1.7)",
    border:"1.5px solid rgba(255,255,255,.38)",
    boxShadow:"0 24px 60px rgba(0,0,0,.32), inset 0 1.5px 0 rgba(255,255,255,.65), inset 0 -1px 0 rgba(255,255,255,.18)",...style}}>
    <div style={{position:"absolute",inset:0,borderRadius:radius,pointerEvents:"none",
      background:"linear-gradient(140deg, rgba(255,255,255,.42) 0%, rgba(255,255,255,.06) 32%, transparent 55%, rgba(255,255,255,.10) 100%)"}}/>
    <div style={{position:"relative"}}>{children}</div>
  </div>;

const art=(episodeId:string,name:string)=>staticFile(`lesson-art/${episodeId}/${name}.jpg`);
const svgUri=(id:string,mood:string)=>{
  const entry=characters.characters.find(c=>c.id===id);
  if(!entry) throw Error(`Unknown HSK AI character "${id}"`);
  const svg=(entry.svg as Record<string,string>)[mood]??entry.svg.idle;
  return "data:image/svg+xml;charset=utf-8,"+encodeURIComponent(svg);
};
const aspect=(id:string)=>{
  const entry=characters.characters.find(c=>c.id===id);
  const box=(entry?.svg.idle.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)??[])as string[];
  return box.length?Number(box[1])/Number(box[2]):1;
};
export const Cast:React.FC<{cast:CastMember[];frame:number;local:number;width:number;height:number;card?:number}>=({cast,frame,local,width,height,card})=>{
  const visible=cast.slice(0,1).filter(m=>(m.card??undefined)===card);
  return <>{visible.map((m,i)=>{
    const h=m.h*height, w=h*aspect(m.id);
    const hop=interpolate(local,[0,5,11],[0,-.06,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp"});
    const breathe=Math.sin((frame+i*17)/14)*.012;
    return <div key={m.id+i} style={{position:"absolute",left:m.x*width-w/2,top:m.y*height-h,width:w,height:h,transformOrigin:"50% 100%",
      scale:`${1+breathe*.6} ${1-breathe+hop*.4}`,translate:`0 ${hop*h}px`}}>
      <div style={{position:"absolute",left:"10%",right:"10%",bottom:-h*.02,height:h*.07,borderRadius:"50%",background:"rgba(0,0,0,.28)",filter:"blur(8px)"}}/>
      <Img src={svgUri(m.id,m.mood??"idle")} style={{position:"relative",width:"100%",height:"100%",filter:"drop-shadow(0 10px 18px rgba(0,0,0,.35))"}}/>
    </div>;
  })}</>;
};

const SceneLayer:React.FC<{episodeId:string;ill:Illustration;beat:ResolvedMotionBeat;local:number;camera:Camera;frameAbs:number}>=({episodeId,ill,beat,local,camera,frameAbs})=>
  <>
    <Img src={art(episodeId,ill.images[0])} style={{position:"absolute",inset:-60,width:W+120,height:H+120,objectFit:"cover",filter:"blur(30px) brightness(.6)"}}/>
    <div style={{position:"absolute",left:0,top:LAY.sceneImageTopPx,width:W,height:LAY.sceneImageHeightPx,transformOrigin:`${camera.cx*100}% ${camera.cy*100}%`,scale:camera.scale}}>
      <Img src={art(episodeId,ill.images[0])} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",borderRadius:0}}/>
      {ill.cast&&<Cast cast={ill.cast} frame={frameAbs} local={local} width={W} height={LAY.sceneImageHeightPx}/>}
      <span data-beat={beat.id} style={{display:"none"}}/>
    </div>
  </>;

const PairLayer:React.FC<{episodeId:string;ill:Illustration;local:number;frameAbs:number}>=({episodeId,ill,local,frameAbs})=>{
  const focusIndex=ill.focus==="left"?0:ill.focus==="right"?1:-1;
  return <>
    <Img src={art(episodeId,ill.images[1]??ill.images[0])} style={{position:"absolute",inset:-60,width:W+120,height:H+120,objectFit:"cover",filter:"blur(34px) brightness(.55) saturate(1.2)"}}/>
    <div style={{position:"absolute",left:60,right:60,top:LAY.pairTopPx,height:LAY.pairHeightPx,display:"flex",gap:40,justifyContent:"center"}}>
      {ill.images.slice(0,2).map((name,index)=>{
        const focused=index===focusIndex, dimmed=focusIndex>=0&&!focused;
        return <div key={name} style={{position:"relative",flex:1,opacity:dimmed?.55:1,scale:focused?1.04:1,
          translate:`0 ${(1-pop(local,index*3,12))*24}px`}}>
          <div style={{position:"absolute",inset:0,borderRadius:44,overflow:"hidden",
            border:`${focused?5:2}px solid ${focused?C.brandGold:"rgba(255,255,255,.45)"}`,
            boxShadow:"0 24px 58px rgba(0,0,0,.38)"}}>
            <Img src={art(episodeId,name)} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            {ill.cast&&<Cast cast={ill.cast} frame={frameAbs} local={local} width={460} height={LAY.pairHeightPx} card={index}/>}
          </div>
        </div>;
      })}
    </div>
  </>;
};

const BoardLayer:React.FC<{episodeId:string;ill:Illustration;local:number}>=({episodeId,ill,local})=>
  <>
    <Img src={art(episodeId,ill.images[0])} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",scale:1.025+.008*pop(local,0,60)}}/>
    <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,.02) 42%, rgba(0,0,0,.08) 68%, rgba(0,0,0,.38) 100%)"}}/>
  </>;

const cardPhraseKey=(text:string)=>text.normalize("NFKC").trim().replace(/^这个/u,"").split(/[，,]/u,1)[0].replace(/[。！？?!…]+$/u,"").replace(/\s+/gu,"");
const cardCopy=(beat:ResolvedMotionBeat):CardCopy=>(beat.visual??{}) as CardCopy;
function distinctCardBeats(beats:ResolvedMotionBeat[],activeIndex:number){
  const seen=new Set<string>(), result:ResolvedMotionBeat[]=[];
  for(const beat of beats.slice(0,activeIndex+1)){
    const key=cardPhraseKey(cardCopy(beat).hanzi??"");
    if(!key||seen.has(key)) continue;
    seen.add(key); result.push(beat);
  }
  return (result.length?result:[beats[0]]).slice(-2);
}

export const IllustratedLessonScene:React.FC<{episodeId:string;frame:number;beats:ResolvedMotionBeat[]}>=({episodeId,frame,beats})=>{
  const active=activeNarratedBeat(beats,frame)??beats[0];
  if(!active?.visual) return <AbsoluteFill style={{background:"#08090B"}}/>;
  const ill=(active.visual as {illustration?:Illustration}).illustration;
  if(!ill) throw Error(active.id+": illustrated lesson beat needs an illustration.");
  const index=Math.max(0,beats.indexOf(active));
  const previousBeat=index>0?beats[index-1]:undefined;
  const previousIll=(previousBeat?.visual as {illustration?:Illustration}|undefined)?.illustration;
  const local=Math.max(0,frame-active.localFrame);
  const from=previousIll?.layout===ill.layout?cameraFor(previousIll):cameraFor(ill);
  const to=cameraFor(ill);
  const cameraProgress=pop(local,0,16);
  const drift=1+Math.min(local,240)*.00018;
  const camera={scale:(from.scale+(to.scale-from.scale)*cameraProgress)*drift,cx:from.cx+(to.cx-from.cx)*cameraProgress,cy:from.cy+(to.cy-from.cy)*cameraProgress};
  const transition=previousIll?pop(local,0,visual.motion.beatCrossfadeFrames):1;
  const cardBeats=distinctCardBeats(beats,index);
  const latestCardBeat=cardBeats[cardBeats.length-1]??active;
  const cardLocal=Math.max(0,frame-latestCardBeat.localFrame);
  const cardOpacity=.9+.1*pop(cardLocal,0,8);

  return <AbsoluteFill style={{background:"#08090B",color:"#FFFFFF",fontFamily:G.fontFamily,overflow:"hidden"}}>
    <LiquidGlassDefs/>
    {previousIll&&previousBeat&&<div style={{position:"absolute",inset:0,opacity:1-transition}}>
      {previousIll.layout==="scene"&&<SceneLayer episodeId={episodeId} ill={{...previousIll,cast:undefined}} beat={previousBeat} local={0} camera={from} frameAbs={frame}/>}
      {previousIll.layout==="pair"&&<PairLayer episodeId={episodeId} ill={{...previousIll,cast:undefined}} local={0} frameAbs={frame}/>}
      {previousIll.layout==="board"&&<BoardLayer episodeId={episodeId} ill={previousIll} local={0}/>}
    </div>}
    <div style={{position:"absolute",inset:0,opacity:transition}}>
      {ill.layout==="scene"&&<SceneLayer episodeId={episodeId} ill={ill} beat={active} local={local} camera={camera} frameAbs={frame}/>}
      {ill.layout==="pair"&&<PairLayer episodeId={episodeId} ill={ill} local={local} frameAbs={frame}/>}
      {ill.layout==="board"&&<BoardLayer episodeId={episodeId} ill={ill} local={local}/>}
    </div>
    <div style={{position:"absolute",left:0,right:0,top:0,height:900,background:"linear-gradient(180deg, rgba(6,8,12,.5) 0%, rgba(6,8,12,.38) 40%, transparent 100%)"}}/>
    <div style={{position:"absolute",left:0,right:0,bottom:0,height:620,background:"linear-gradient(0deg, rgba(6,8,12,.72) 0%, rgba(6,8,12,.38) 44%, transparent 100%)"}}/>
    <div style={{position:"absolute",top:LAY.brandTopPx-24,left:0,right:0,display:"flex",justifyContent:"center",alignItems:"center",gap:12,
      color:"#FFFFFF",fontSize:30,fontWeight:900,letterSpacing:".04em",textShadow:"0 3px 12px rgba(0,0,0,.65)"}}>
      <Img src={staticFile("branding/hsk-ai-logo-1024.png")} style={{width:42,height:42,borderRadius:12,filter:"drop-shadow(0 5px 14px rgba(0,0,0,.38))"}}/>
      <span>HSK <span style={{color:C.brandGold,marginLeft:-6}}>AI</span></span>
    </div>
    <div style={{position:"absolute",top:LAY.chipTopPx,left:48,right:48,display:"flex",justifyContent:"center",opacity:cardOpacity}}>
      <LiquidGlass radius={42} style={{padding:cardBeats.length>1?"15px 28px":"17px 34px",maxWidth:960,width:"fit-content"}}>
        <div data-reference-chip data-card-rows={cardBeats.length} style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",rowGap:cardBeats.length>1?4:0,maxWidth:900}}>
          {cardBeats.map((beat,index)=>{
            const copy=cardCopy(beat);
            const compact=cardBeats.length>1;
            return <div key={cardPhraseKey(copy.hanzi??"")+index} style={{display:"flex",alignItems:"baseline",justifyContent:"center",flexWrap:"wrap",columnGap:compact?14:20,rowGap:0}}>
              {copy.hanzi&&<span style={{fontFamily:G.hanziFontFamily,fontSize:compact?56:66,fontWeight:800,whiteSpace:"nowrap"}}>{copy.hanzi}</span>}
              {copy.pinyin&&<span style={{fontSize:compact?30:36,fontWeight:700,color:C.brandGold,whiteSpace:"nowrap"}}>{copy.pinyin}</span>}
              {copy.meaning&&<span style={{fontSize:compact?29:34,fontWeight:600,color:"rgba(255,255,255,.9)"}}>{copy.meaning}</span>}
            </div>;
          })}
        </div>
      </LiquidGlass>
    </div>
  </AbsoluteFill>;
};
