import {createElement, useMemo} from "react";
import {AbsoluteFill, Img, staticFile} from "remotion";
import visual from "../../content/visual-system.json";
import {activeNarratedBeat} from "../../scripts/narrated-beat-state.mjs";
import {ILLUSTRATED_LAYOUT as LAY} from "../../scripts/illustrated-layout.mjs";
import {graphicNodeState, validateGraphicScene} from "../../scripts/graphic-scene.mjs";
import type {GraphicNode, GraphicScene as GraphicPlan} from "../../scripts/graphic-scene.mjs";
import type {ResolvedMotionBeat} from "../../scripts/motion-design-plan.mjs";
import {bell, cameraAt, cardPhraseKey, cardTokens, diffGraphicNodes, distinctCardBeats, lerpGraphicAttrs,
  planShots, planVisualModes, springProgress} from "../../scripts/pro-motion-plan.mjs";
import type {CameraPose, Shot} from "../../scripts/pro-motion-plan.mjs";
import {LiquidGlass, LiquidGlassDefs, art, aspect, svgUri} from "../IllustratedLessonScene";
import type {CastMember, Illustration} from "../IllustratedLessonScene";
import {GraphicGlassDefs, paintGraphicAttrs} from "../GraphicScene";
import {BlurFilter, PRO, blurStyle, clamp01, easeInOut, easeOut} from "./SceneTransitions";
import type {ArtTransition} from "./SceneTransitions";
import {SlideBackground, SlideContent} from "./MotionSlide";

/**
 * Professional-motion version of the illustrated-glass lesson
 * (content/EDITING_SPEC.md#professional-motion-system): same art, cast, card
 * copy, safe zone and subtitle slots as IllustratedLessonScene, directed with
 * a spring camera, cue-timed shot moves, kinetic type, morphing graphics and
 * cast reactions. Every change starts on the beat's verified spoken cue.
 */
const G=visual.referenceGlass, C=visual.colors;
const W=1080, H=1920, FPS=30;
const cardSpring={naturalHz:PRO.card.entryNaturalHz,dampingRatio:PRO.card.entryDampingRatio};
type Focus={hanzi:string;pinyin:string|null}|null;
type CardCopy={hanzi?:string;pinyin?:string;meaning?:string};
const illOf=(beat?:ResolvedMotionBeat)=>(beat?.visual as {illustration?:Illustration}|undefined)?.illustration;
const graphicOf=(beat?:ResolvedMotionBeat)=>(beat?.visual as {graphic?:GraphicPlan}|undefined)?.graphic;
const copyOf=(beat:ResolvedMotionBeat)=>(beat.visual??{}) as CardCopy;
const lerp=(a:number,b:number,p:number)=>a+(b-a)*p;

/** Cast with an entrance, a reaction when the mood changes, and idle life. */
const ProCast:React.FC<{cast:CastMember[];previous?:CastMember[];frame:number;local:number;entryAge:number|null;
  width:number;height:number;card?:number}>=({cast,previous,frame,local,entryAge,width,height,card})=>{
  const visible=cast.slice(0,1).filter(member=>(member.card??undefined)===card);
  return <>{visible.map((member,i)=>{
    const h=member.h*height, w=h*aspect(member.id);
    const before=previous?.find(item=>item.id===member.id&&(item.card??undefined)===card);
    const reacting=Boolean(before&&before.mood!==member.mood);
    const enter=entryAge===null?1:springProgress(entryAge,FPS,{naturalHz:2.2,dampingRatio:.55});
    const hop=reacting?-PRO.cast.reactionHopPct*h*bell(local,PRO.cast.reactionFrames*.7):0;
    const wiggle=reacting?PRO.cast.reactionWiggleDeg*Math.sin(local*Math.PI/4)*Math.exp(-local/7):0;
    const land=reacting?bell(local-PRO.cast.reactionFrames*.6,8):0;
    const settle=entryAge===null?0:bell(entryAge-4,12);
    const breathe=Math.sin((frame+i*17)/14)*.012;
    const lift=(1-enter)*PRO.cast.entryRisePct*h+hop;
    return <div key={member.id+i} data-cast={member.id} style={{position:"absolute",left:member.x*width-w/2,top:member.y*height-h,
      width:w,height:h,opacity:clamp01(enter*2)}}>
      <div style={{position:"absolute",left:"10%",right:"10%",bottom:-h*.02,height:h*.07,borderRadius:"50%",
        background:"rgba(0,0,0,.28)",filter:"blur(8px)",scale:`${1+lift/h*.8}`,opacity:1+lift/h*1.5}}/>
      <div style={{position:"absolute",inset:0,transformOrigin:"50% 100%",translate:`0 ${lift}px`,
        rotate:`${PRO.cast.swayDeg*Math.sin(frame/45)+wiggle}deg`,
        scale:`${1+breathe*.6+.05*land+.04*settle} ${1-breathe-.07*land-.05*settle}`}}>
        <Img src={svgUri(member.id,member.mood??"idle")} style={{position:"relative",width:"100%",height:"100%",
          filter:"drop-shadow(0 10px 18px rgba(0,0,0,.35))"}}/>
      </div>
    </div>;
  })}</>;
};

const SceneArt:React.FC<{episodeId:string;sceneId:string;ill:Illustration;camera:CameraPose;frame:number;local:number;
  previousCast?:CastMember[];entryAge:number|null}>=({episodeId,sceneId,ill,camera,frame,local,previousCast,entryAge})=>{
  const id=`cam-${sceneId}`;
  return <>
    <Img src={art(episodeId,ill.images[0])} style={{position:"absolute",inset:-80,width:W+160,height:H+160,objectFit:"cover",
      filter:"blur(30px) brightness(.6)",translate:`${camera.tx*.35}px ${camera.ty*.35}px`}}/>
    <BlurFilter id={id} x={camera.blurX} y={camera.blurY}/>
    <div style={{position:"absolute",inset:0,...blurStyle(id,{x:camera.blurX,y:camera.blurY})}}>
      <div style={{position:"absolute",left:0,top:LAY.sceneImageTopPx,width:W,height:LAY.sceneImageHeightPx,
        transformOrigin:`${camera.cx*100}% ${camera.cy*100}%`,scale:camera.scale,translate:`${camera.tx}px ${camera.ty}px`}}>
        <Img src={art(episodeId,ill.images[0])} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover"}}/>
        {ill.cast&&<div style={{position:"absolute",inset:0,translate:`${camera.tx*.12}px 0`}}>
          <ProCast cast={ill.cast} previous={previousCast} frame={frame} local={local} entryAge={entryAge}
            width={W} height={LAY.sceneImageHeightPx}/>
        </div>}
      </div>
    </div>
  </>;
};

const focusIndexOf=(ill?:Illustration)=>ill?.focus==="left"?0:ill?.focus==="right"?1:-1;
const PairArt:React.FC<{episodeId:string;ill:Illustration;previousIll?:Illustration;shot:Shot;frame:number;local:number;
  entryAge:number;previousCast?:CastMember[]}>=({episodeId,ill,previousIll,shot,frame,local,entryAge,previousCast})=>{
  const focusIndex=focusIndexOf(ill);
  const swap=shot.transition==="focus-swap"?springProgress(local,FPS,{naturalHz:2,dampingRatio:.75}):1;
  const weight=(index:number,focus:number)=>focus<0?1:index===focus?1:0;
  const punch=shot.transition==="punch"?bell(local,PRO.camera.settleFrames):0;
  return <>
    <Img src={art(episodeId,ill.images[1]??ill.images[0])} style={{position:"absolute",inset:-80,width:W+160,height:H+160,
      objectFit:"cover",filter:"blur(34px) brightness(.55) saturate(1.2)",scale:`${1.02+.02*easeOut(frame/240)}`}}/>
    <div style={{position:"absolute",left:60,right:60,top:LAY.pairTopPx,height:LAY.pairHeightPx,display:"flex",gap:40,
      justifyContent:"center",perspective:1400}}>
      {ill.images.slice(0,2).map((name,index)=>{
        const enter=springProgress(entryAge-index*4-1,FPS,{naturalHz:2,dampingRatio:.68});
        const w=lerp(weight(index,focusIndexOf(previousIll??ill)),weight(index,focusIndex),swap);
        const focused=focusIndex>=0&&index===focusIndex;
        const accepted=ill.overlay==="both-accepted";
        const badge=springProgress(local-index*3,FPS,{naturalHz:2.6,dampingRatio:.45});
        return <div key={name} style={{position:"relative",flex:1,opacity:clamp01(enter*1.6)*(focusIndex<0?1:.6+.4*w),
          translate:`0 ${(1-Math.min(1,enter))*170}px`,
          rotate:`${(1-Math.min(1,enter))*(index?5:-5)}deg`,
          scale:`${(focusIndex<0?1:1+.045*w)*(1+(focused?.02:0)*punch)}`,
          transform:`rotateY(${focusIndex<0?0:(1-w)*(index?-7:7)}deg)`}}>
          <div style={{position:"absolute",inset:0,borderRadius:44,overflow:"hidden",
            border:`${2+3*(focusIndex<0?0:w)}px solid ${w>.5&&focusIndex>=0?C.brandGold:"rgba(255,255,255,.45)"}`,
            boxShadow:`0 ${24+14*w}px ${58+20*w}px rgba(0,0,0,.38)`}}>
            <Img src={art(episodeId,name)} style={{width:"100%",height:"100%",objectFit:"cover",
              scale:`${1+(.014+.03*w)*easeOut(entryAge/80)}`}}/>
            {ill.cast&&<ProCast cast={ill.cast} previous={previousCast} frame={frame} local={local}
              entryAge={entryAge<40?entryAge-6-index*4:null} width={460} height={LAY.pairHeightPx} card={index}/>}
          </div>
          {accepted&&<div style={{position:"absolute",right:19,top:19,width:60,height:60,borderRadius:"50%",
            display:"grid",placeItems:"center",background:"#075440",border:"2px solid #CFFFE7",boxShadow:"0 6px 20px #001A13AA",
            opacity:clamp01(badge*2),scale:`${Math.max(0,badge)}`}}>
            <svg width="31" height="31" viewBox="0 0 28 28" fill="none" aria-hidden="true">
              <path d="m5 14 6 6L23 8" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
                pathLength={1} strokeDasharray={1} strokeDashoffset={1-easeInOut((local-index*3-3)/10)}/>
            </svg></div>}
        </div>;
      })}
    </div>
  </>;
};

const BoardArt:React.FC<{episodeId:string;ill:Illustration;frame:number}>=({episodeId,ill,frame})=>{
  const push=1.025+Math.min(PRO.camera.holdMaxPush,PRO.camera.holdPushPerSec*frame/FPS);
  return <>
    <Img src={art(episodeId,ill.images[0])} style={{position:"absolute",inset:0,width:"100%",height:"100%",objectFit:"cover",
      scale:push,translate:`0 ${-Math.min(18,frame*.06)}px`}}/>
    <div style={{position:"absolute",inset:0,background:"linear-gradient(180deg, rgba(0,0,0,.45) 0%, rgba(0,0,0,.02) 42%, rgba(0,0,0,.08) 68%, rgba(0,0,0,.38) 100%)"}}/>
  </>;
};

/** Cue-timed graphic that keeps, morphs, draws on and retires nodes. */
const ProGraphic:React.FC<{plan:GraphicPlan;previous?:GraphicPlan;local:number;previousLocal:number}>=({plan,previous,local,previousLocal})=>{
  validateGraphicScene(plan);
  const {status,exiting}=diffGraphicNodes(previous,plan);
  const before=new Map((previous?.nodes??[]).map(node=>[node.id,node]));
  const elapsed=local*1000/FPS;
  const morph=springProgress(local,FPS,{naturalHz:2.4,dampingRatio:.85});
  const order=new Map(plan.nodes.filter(node=>node.type!=="g"&&status.get(node.id)==="enter").map((node,i)=>[node.id,i]));
  const draw=(node:GraphicNode):React.ReactNode=>{
    const kind=status.get(node.id)??"enter";
    let state=graphicNodeState(plan,node,elapsed);
    let attrs=node.attrs;
    const old=before.get(node.id);
    if(previous&&old&&kind!=="enter"&&(kind==="morph"||plan.tracks.some(track=>track.nodeId===node.id))){
      const from=graphicNodeState(previous,old,previousLocal*1000/FPS);
      state={x:lerp(from.x,state.x,morph),y:lerp(from.y,state.y,morph),rotate:lerp(from.rotate,state.rotate,morph),
        scale:Math.max(.05,lerp(from.scale,state.scale,morph)),opacity:clamp01(lerp(from.opacity,state.opacity,clamp01(morph)))};
      attrs=lerpGraphicAttrs(old.attrs,node.attrs,clamp01(morph));
    }
    let opacity=state.opacity, rise=0;
    const dash:Record<string,number>={};
    if(kind==="enter"&&node.type!=="g"){
      const t=local-(order.get(node.id)??0)*PRO.graphic.staggerFrames;
      const strokeOnly=(attrs.fill===undefined||attrs.fill==="none")&&attrs.stroke!==undefined&&attrs.stroke!=="none";
      if(strokeOnly){
        const drawn=easeInOut(t/PRO.graphic.drawFrames);
        Object.assign(dash,{pathLength:1,strokeDasharray:1,strokeDashoffset:1-drawn});
        if(drawn<.002)opacity=0;
      } else {
        const p=springProgress(t,FPS,cardSpring);
        opacity*=clamp01(p*1.5); rise=(1-Math.min(1,p))*PRO.graphic.risePx;
      }
    }
    return createElement("g",{key:node.id,"data-graphic-node":node.id,opacity,
      transform:`translate(${state.x} ${state.y+rise}) rotate(${state.rotate}) scale(${state.scale})`},
      createElement(node.type,{fill:"none",strokeLinecap:"round",strokeLinejoin:"round",...paintGraphicAttrs(attrs,true),...dash},
        ...plan.nodes.filter(child=>child.parentId===node.id).map(draw)));
  };
  const gone=new Set(exiting);
  const keep=(node:GraphicNode):boolean=>gone.has(node.id)||(node.type==="g"&&(previous?.nodes??[]).some(child=>child.parentId===node.id&&keep(child)));
  const drawGone=(node:GraphicNode):React.ReactNode=>{
    const state=graphicNodeState(previous!,node,previousLocal*1000/FPS);
    return createElement("g",{key:"x-"+node.id,opacity:state.opacity,
      transform:`translate(${state.x} ${state.y}) rotate(${state.rotate}) scale(${state.scale})`},
      createElement(node.type,{fill:"none",strokeLinecap:"round",strokeLinejoin:"round",...(gone.has(node.id)?paintGraphicAttrs(node.attrs,true):{})},
        ...(previous?.nodes??[]).filter(child=>child.parentId===node.id&&keep(child)).map(drawGone)));
  };
  const exit=clamp01(local/PRO.graphic.exitFrames);
  return <div style={{position:"absolute",left:LAY.graphicOverlaySideInsetPx,right:LAY.graphicOverlaySideInsetPx,
    top:LAY.graphicOverlayTopPx,height:LAY.graphicOverlayHeightPx,pointerEvents:"none"}}>
    <svg width="100%" height={LAY.graphicOverlayHeightPx} viewBox={`0 0 ${plan.width} ${plan.height}`} style={{overflow:"visible"}}>
      <GraphicGlassDefs plans={previous?[plan,previous]:[plan]}/>
      <g filter="url(#glass-depth)">
        {previous&&exit<1&&<g opacity={1-exit}>{previous.nodes.filter(node=>node.parentId===undefined&&keep(node)).map(drawGone)}</g>}
        {plan.nodes.filter(node=>node.parentId===undefined).map(draw)}
      </g>
    </svg>
  </div>;
};

/** One glass teaching card whose new form assembles on its spoken cue. */
const KineticCard:React.FC<{beats:ResolvedMotionBeat[];index:number;frame:number;focus:Focus}>=({beats,index,frame,focus})=>{
  const rows=distinctCardBeats(beats,index);
  if(!rows.length)return null;
  const lead=4;
  const startOf=(beat:ResolvedMotionBeat)=>Math.max(0,beat.localFrame-lead);
  const newest=rows[rows.length-1];
  const newestIndex=beats.indexOf(newest);
  const before=newestIndex>0?distinctCardBeats(beats,newestIndex-1):[];
  const age=frame-startOf(newest);
  const first=distinctCardBeats(beats,0)[0]??rows[0];
  const appear=springProgress(frame-startOf(first),FPS,cardSpring);
  const change=before.length?bell(age,14):0;
  const settle=Math.min(1,springProgress(age,FPS,cardSpring));
  const compact=rows.length>1;
  const sweep=-30+160*easeInOut(age/PRO.card.sweepFrames);
  return <div style={{position:"absolute",top:LAY.chipTopPx,left:48,right:48,display:"flex",justifyContent:"center",
    opacity:clamp01(appear*1.4),translate:`0 ${(1-Math.min(1,appear))*24}px`,
    scale:`${(.94+.06*Math.min(1.02,appear))*(1+.018*change)}`}}>
    <LiquidGlass radius={42} style={{padding:compact?"15px 28px":"17px 34px",maxWidth:960,width:"fit-content"}}>
      {age<PRO.card.sweepFrames&&<div style={{position:"absolute",inset:-90,pointerEvents:"none",
        background:`linear-gradient(105deg, transparent ${sweep-14}%, rgba(255,255,255,.2) ${sweep}%, transparent ${sweep+14}%)`}}/>}
      <div data-reference-chip data-card-rows={rows.length} style={{display:"flex",flexDirection:"column",alignItems:"center",
        justifyContent:"center",rowGap:compact?4:0,maxWidth:900}}>
        {rows.map((beat,rowIndex)=>{
          const copy=copyOf(beat), key=cardPhraseKey(copy.hanzi??"");
          const oldIndex=before.findIndex(item=>cardPhraseKey(copyOf(item).hanzi??"")===key);
          const isNew=beat===newest&&oldIndex<0;
          const wasCompact=oldIndex>=0?before.length>1:compact;
          const size=(full:number,small:number)=>lerp(wasCompact?small:full,compact?small:full,settle);
          const shift=oldIndex>=0&&oldIndex!==rowIndex?(oldIndex-rowIndex)*PRO.card.rowShiftPx*(1-settle):0;
          const tokens=cardTokens(copy,focus);
          let han=0;
          return <div key={key+rowIndex} style={{display:"flex",alignItems:"baseline",justifyContent:"center",flexWrap:"wrap",
            columnGap:compact?14:20,rowGap:0,translate:`0 ${shift}px`}}>
            {copy.hanzi&&<span style={{fontFamily:G.hanziFontFamily,fontSize:size(66,56),fontWeight:800,whiteSpace:"nowrap"}}>
              {tokens.chars.map((token,i)=>{
                const t=isNew?age-(token.han?han++:Math.max(0,han-1))*PRO.card.charStaggerFrames:99;
                const p=springProgress(t,FPS,cardSpring);
                const glow=token.focus?(.35+.65*(isNew?bell(t-6,20):0)):0;
                return <span key={i} style={{display:"inline-block",whiteSpace:"pre",opacity:clamp01(p*1.6),
                  translate:`0 ${(1-Math.min(1,p))*PRO.card.charRisePx}px`,scale:`${.85+.15*Math.min(1.05,p)}`,
                  filter:p<.98?`blur(${(1-clamp01(p))*PRO.card.charBlurPx}px)`:undefined,
                  color:token.focus?C.brandGold:undefined,
                  textShadow:token.focus?`0 0 ${PRO.card.focusGlowPx*glow}px rgba(255,190,70,${.35+.45*glow})`:undefined}}>{token.ch}</span>;
              })}
            </span>}
            {copy.pinyin&&<span style={{fontSize:size(36,30),fontWeight:700,color:C.brandGold,whiteSpace:"nowrap"}}>
              {tokens.words.map((word,i)=>{
                const p=isNew?springProgress(age-PRO.card.pinyinDelayFrames-i*2,FPS,cardSpring):1;
                return <span key={i} style={{display:"inline-block",marginRight:i<tokens.words.length-1?".28em":0,
                  opacity:clamp01(p*1.6),translate:`0 ${(1-Math.min(1,p))*12}px`,
                  color:word.focus?"#FFE7A3":undefined,textShadow:word.focus?"0 0 12px rgba(255,200,80,.55)":undefined}}>{word.word}</span>;
              })}
            </span>}
            {copy.meaning&&(()=>{
              const p=isNew?easeOut((age-PRO.card.meaningDelayFrames)/12):1;
              return <span style={{fontSize:size(34,29),fontWeight:600,color:"rgba(255,255,255,.9)",opacity:clamp01(p*1.4),
                clipPath:`inset(-20% ${(1-p)*100}% -20% 0)`}}>{copy.meaning}</span>;
            })()}
          </div>;
        })}
      </div>
    </LiquidGlass>
  </div>;
};

export const ProIllustratedLessonScene:React.FC<{episodeId:string;sceneId:string;frame:number;beats:ResolvedMotionBeat[];
  focus:Focus;theme?:string;showText?:boolean;artMotion?:ArtTransition|null}>=({episodeId,sceneId,frame,beats,focus,theme="ink",showText=true,artMotion})=>{
  const shots=useMemo(()=>planShots(beats,PRO),[beats]);
  const modes=useMemo(()=>planVisualModes(beats,focus),[beats,focus]);
  const active=activeNarratedBeat(beats,frame)??beats[0];
  if(!active?.visual)return <AbsoluteFill style={{background:"#08090B"}}/>;
  const ill=illOf(active);
  if(!ill)throw Error(active.id+": illustrated lesson beat needs an illustration.");
  const index=Math.max(0,beats.indexOf(active));
  const shot=shots[index];
  const previousBeat=index>0?beats[index-1]:undefined;
  const previousIll=illOf(previousBeat);
  const local=Math.max(0,frame-active.localFrame);
  const previousLocal=previousBeat?active.localFrame-previousBeat.localFrame:0;
  // Shot language: art alternates with clean motion slides (planVisualModes).
  const mode=modes[index], previousMode=index>0?modes[index-1]:undefined;
  const isSlide=mode.mode==="slide", wasSlide=previousMode?.mode==="slide";
  const switching=Boolean(previousMode)&&isSlide!==wasSlide&&local<PRO.slide.dissolveFrames;
  const dissolve=switching?easeInOut(local/PRO.slide.dissolveFrames):1;
  const slideOpacity=isSlide?dissolve:switching?1-dissolve:0;
  const swapping=isSlide&&wasSlide&&previousMode!.content!==mode.content&&local<PRO.slide.exitFrames;
  const crossFrames=PRO.beatTransition.crossZoomFrames;
  const crossing=shot.transition==="cross-zoom"&&Boolean(previousIll)&&!wasSlide&&local<crossFrames;
  const cross=crossing?easeInOut(local/crossFrames):1;
  // Entrance age of the current run of beats on the same art (scene start or cross-zoom).
  let runStart=index;
  while(runStart>0&&!["enter","cross-zoom"].includes(shots[runStart].transition))runStart--;
  const entryAge=frame-(runStart===0?0:beats[runStart].localFrame);
  const sameStage=Boolean(previousIll)&&shot.transition!=="cross-zoom"&&!wasSlide;
  const renderArt=(beat:ResolvedMotionBeat,beatIndex:number,at:number)=>{
    const art=illOf(beat)!;
    const beatLocal=Math.max(0,at-beat.localFrame);
    const castBefore=beatIndex>0&&shots[beatIndex].transition!=="cross-zoom"?illOf(beats[beatIndex-1])?.cast:undefined;
    if(art.layout==="scene")return <SceneArt episodeId={episodeId} sceneId={sceneId+"-"+beatIndex} ill={art}
      camera={cameraAt({beats,shots,frame:at,config:PRO})} frame={at} local={beatLocal} previousCast={castBefore}
      entryAge={entryAge<40?entryAge:null}/>;
    if(art.layout==="pair")return <PairArt episodeId={episodeId} ill={art}
      previousIll={beatIndex>0?illOf(beats[beatIndex-1]):undefined} shot={shots[beatIndex]} frame={at} local={beatLocal}
      entryAge={entryAge} previousCast={castBefore}/>;
    return <BoardArt episodeId={episodeId} ill={art} frame={at}/>;
  };
  const graphic=graphicOf(active);
  // The art under a slide is drawn only while it dissolves in or out.
  const artBeatIndex=isSlide?(switching?index-1:-1):index;
  const artBeat=artBeatIndex>=0?beats[artBeatIndex]:undefined;
  const transitionId=`st-${sceneId}`;
  const exit=swapping?easeInOut(local/PRO.slide.exitFrames):1;
  const slideIndex=isSlide?index:index-1;
  // Transparent root: during a scene transition the outgoing scene shows
  // through wherever the incoming art has not arrived yet.
  return <AbsoluteFill style={{color:"#FFFFFF",fontFamily:G.fontFamily,overflow:"hidden"}}>
    <LiquidGlassDefs/>
    {artMotion?.blur&&<BlurFilter id={transitionId} x={artMotion.blur.x} y={artMotion.blur.y}/>}
    <div style={{position:"absolute",inset:0,...artMotion?.style,...blurStyle(transitionId,artMotion?.blur)}}>
      <div style={{position:"absolute",inset:0,background:"#08090B"}}/>
      {artBeat&&artBeatIndex===index&&crossing&&previousBeat&&previousIll&&<div style={{position:"absolute",inset:0,
        scale:`${1+PRO.beatTransition.crossZoomScale*cross}`,filter:`blur(${PRO.beatTransition.crossZoomBlurPx*cross}px)`}}>
        {renderArt(previousBeat,index-1,active.localFrame-1)}
        {graphicOf(previousBeat)&&previousIll.layout!=="pair"&&<ProGraphic plan={graphicOf(previousBeat)!} local={previousLocal} previousLocal={0}/>}
      </div>}
      {artBeat&&<div style={{position:"absolute",inset:0,opacity:artBeatIndex===index?cross:1,
        ...(crossing&&artBeatIndex===index?{scale:`${1+PRO.beatTransition.crossZoomScale*(1-cross)}`,filter:`blur(${PRO.beatTransition.crossZoomBlurPx*(1-cross)}px)`}:{})}}>
        {renderArt(artBeat,artBeatIndex,frame)}
        {artBeatIndex===index&&graphic&&ill.layout!=="pair"&&<ProGraphic plan={graphic} local={local} previousLocal={previousLocal}
          previous={sameStage?graphicOf(previousBeat):undefined}/>}
      </div>}
      {slideOpacity>0&&slideIndex>=0&&<div data-motion-slide={modes[slideIndex].template} style={{position:"absolute",inset:0,opacity:slideOpacity,
        scale:`${isSlide?1.035-.035*dissolve:1+.06*(1-slideOpacity)}`,
        filter:slideOpacity<.99?`blur(${(1-slideOpacity)*PRO.slide.dissolveBlurPx}px)`:undefined}}>
        <SlideBackground theme={theme} frame={frame} episodeId={episodeId} image={illOf(beats[slideIndex])?.images[0]}/>
        {swapping&&<div style={{position:"absolute",inset:0,opacity:1-exit,translate:`0 ${-PRO.slide.exitRisePx*exit}px`,
          filter:`blur(${14*exit}px)`}}>
          <SlideContent episodeId={episodeId} beats={beats} modes={modes} index={index-1} frame={frame} focus={focus}/>
        </div>}
        <SlideContent episodeId={episodeId} beats={beats} modes={modes} index={slideIndex} frame={frame} focus={focus}/>
      </div>}
    </div>
    <div style={{position:"absolute",left:0,right:0,top:0,height:900,background:"linear-gradient(180deg, rgba(6,8,12,.5) 0%, rgba(6,8,12,.38) 40%, transparent 100%)",
      opacity:1-slideOpacity*.7}}/>
    <div style={{position:"absolute",left:0,right:0,bottom:0,height:620,background:"linear-gradient(0deg, rgba(6,8,12,.72) 0%, rgba(6,8,12,.38) 44%, transparent 100%)"}}/>
    {showText&&<>
      <div style={{position:"absolute",top:LAY.brandTopPx,left:0,right:0,display:"flex",justifyContent:"center",
        color:"#FFFFFF",fontSize:30,fontWeight:900,letterSpacing:".04em",textShadow:"0 3px 12px rgba(0,0,0,.65)"}}>
        <LiquidGlass radius={32} style={{padding:"9px 17px"}}>
          <div style={{display:"flex",alignItems:"center",gap:11}}>
            <Img src={staticFile("branding/hsk-ai-logo-1024.png")} style={{width:39,height:39,borderRadius:11}}/>
            <span>HSK <span style={{color:C.brandGold}}>AI</span></span>
          </div>
        </LiquidGlass>
      </div>
      {slideOpacity<1&&<div style={{position:"absolute",inset:0,opacity:1-slideOpacity}}>
        <KineticCard beats={beats} index={isSlide?Math.max(0,index-1):index} frame={frame} focus={focus}/>
      </div>}
    </>}
  </AbsoluteFill>;
};
