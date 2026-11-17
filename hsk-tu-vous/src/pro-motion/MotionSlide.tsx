import type {CSSProperties, ReactNode} from "react";
import {AbsoluteFill, Img} from "remotion";
import visual from "../../content/visual-system.json";
import type {ResolvedMotionBeat} from "../../scripts/motion-design-plan.mjs";
import {bell, formulaChips, springProgress} from "../../scripts/pro-motion-plan.mjs";
import type {VisualMode} from "../../scripts/pro-motion-plan.mjs";
import {art} from "../IllustratedLessonScene";
import lexiconJson from "../../content/meaning-visuals.json";
import {comparisonRole, sentenceMeaning, slideIcon} from "../../scripts/meaning-visual-plan.mjs";
import type {MeaningLexicon} from "../../scripts/meaning-visual-plan.mjs";
import {MeaningIcon} from "./MeaningIcons";
import {ArtCard, MeaningStage} from "./MeaningStages";
import {PRO, clamp01, easeInOut, easeOut} from "./SceneTransitions";

/**
 * Clean motion slide (owner reference shorts, 2026-11-17): one focus on a
 * themed background — a giant form, a pair/contrast of cards, a formula of
 * word chips that light up as they are spoken, or a stacked list. Elements
 * blur in one after another on the beat's spoken cue. Every slide also shows
 * what the Chinese means: an animated stage under a formula, an animated
 * icon on a word (content/meaning-visuals.json), or the beat's own art.
 */
const G=visual.referenceGlass, C=visual.colors, FPS=30;
const S=PRO.slide, MV=PRO.meaning;
const LEX=lexiconJson as MeaningLexicon;
const spring={naturalHz:PRO.card.entryNaturalHz,dampingRatio:PRO.card.entryDampingRatio};
type Copy={hanzi?:string;pinyin?:string;meaning?:string};
type Focus={hanzi:string;pinyin:string|null}|null;
const copyOf=(beat:ResolvedMotionBeat)=>(beat.visual??{}) as Copy;
const han=(text?:string)=>(String(text??"").match(/\p{Script=Han}/gu)??[]).join("");

/** Blur-in rise for one element `delay` frames after the slide content starts. */
const reveal=(age:number,delay:number,rise=36):CSSProperties=>{
  const p=springProgress(age-delay,FPS,spring);
  return {opacity:clamp01(p*1.6),translate:`0 ${(1-Math.min(1,p))*rise}px`,
    filter:p<.98?`blur(${(1-clamp01(p))*S.blurInPx}px)`:undefined};
};

const glassCard=(extra:CSSProperties={}):CSSProperties=>({position:"relative",borderRadius:44,
  background:"linear-gradient(150deg, rgba(255,255,255,.16), rgba(255,255,255,.05) 55%, rgba(255,255,255,.09))",
  border:"1.5px solid rgba(255,255,255,.26)",boxShadow:"0 30px 70px rgba(0,0,0,.35), inset 0 1.5px 0 rgba(255,255,255,.35)",
  backdropFilter:"blur(18px)",...extra});

export const SlideBackground:React.FC<{theme:string;frame:number;episodeId:string;image?:string}>=({theme,frame,episodeId,image})=>{
  const drift=Math.sin(frame/70)*6;
  const dots={background:"radial-gradient(circle, rgba(255,255,255,.075) 1.6px, transparent 1.8px) 0 0/38px 38px"};
  const bases:Record<string,string>={
    ink:`radial-gradient(70% 40% at ${50+drift}% 18%, ${C.brandRed}33 0%, transparent 70%), linear-gradient(180deg,#121317 0%,#0A0B0D 100%)`,
    ember:`radial-gradient(80% 45% at ${50+drift}% 28%, #8E211B 0%, #3F0C0B 48%, #110505 100%)`,
    sky:`radial-gradient(60% 30% at ${30+drift}% 20%, rgba(255,255,255,.35) 0%, transparent 70%), linear-gradient(180deg,#3B8BF0 0%,#1A5BC8 55%,#0C2C6E 100%)`,
    teal:`radial-gradient(70% 45% at ${50+drift}% 25%, ${C.brandTeal} 0%, #0B4A35 45%, #04140F 100%)`,
    glass:"linear-gradient(180deg, rgba(6,8,12,.55), rgba(6,8,12,.72))",
  };
  return <AbsoluteFill>
    {theme==="glass"&&image&&<Img src={art(episodeId,image)} style={{position:"absolute",inset:-80,width:1240,height:2080,
      objectFit:"cover",filter:"blur(38px) brightness(.62) saturate(1.15)",scale:`${1.04+.02*Math.sin(frame/90)}`}}/>}
    <AbsoluteFill style={{background:bases[theme]??bases.ink}}/>
    <AbsoluteFill style={{...dots,opacity:.9}}/>
  </AbsoluteFill>;
};

const Stamp:React.FC<{age:number;delay:number;size:number}>=({age,delay,size})=>{
  const p=springProgress(age-delay,FPS,{naturalHz:2.6,dampingRatio:.5});
  if(p<=0)return null;
  return <div style={{position:"absolute",right:-size*.25,top:-size*.25,width:size,height:size,borderRadius:"50%",
    background:"#D93025",border:"4px solid #FFD2CC",display:"grid",placeItems:"center",boxShadow:"0 10px 30px rgba(120,0,0,.5)",
    scale:`${2.1-1.1*Math.min(1.08,p)}`,opacity:clamp01(p*2),rotate:`${(1-clamp01(p))*-25}deg`}}>
    <svg width={size*.5} height={size*.5} viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" strokeWidth="3.6" strokeLinecap="round"/></svg>
  </div>;
};

const Hero:React.FC<{copy:Copy;age:number;focus:boolean;wrong:boolean;fallback?:string}>=({copy,age,focus,wrong,fallback})=>{
  const p=springProgress(age,FPS,{naturalHz:2.2,dampingRatio:.62});
  const icon=slideIcon(copy.hanzi,LEX);
  const visualTop=icon||fallback?420:0;
  const size=han(copy.hanzi).length>2?180:icon||fallback?230:300;
  return <>
  {icon&&<div style={{position:"absolute",left:(1080-MV.iconHeroPx)/2,top:visualTop,width:MV.iconHeroPx,height:MV.iconHeroPx,
    ...reveal(age,2,40)}}><MeaningIcon kind={icon} age={age-2} size={MV.iconHeroPx} tint={wrong?"#FFB4AE":undefined}/></div>}
  {!icon&&fallback&&<div style={{position:"absolute",inset:0,scale:".78",transformOrigin:"50% 420px"}}><ArtCard src={fallback} age={age} top={visualTop}/></div>}
  <div style={{position:"absolute",top:visualTop?visualTop+MV.iconHeroPx+40:S.contentTopPx,left:60,right:60,display:"flex",flexDirection:"column",alignItems:"center"}}>
    <div style={{position:"relative",fontFamily:G.hanziFontFamily,fontWeight:800,fontSize:size,lineHeight:1.05,
      color:wrong?"rgba(255,255,255,.72)":focus?C.brandGold:"#FFFFFF",opacity:clamp01(p*1.5),scale:`${1.3-.3*Math.min(1.04,p)}`,
      filter:p<.98?`blur(${(1-clamp01(p))*S.blurInPx*1.4}px)`:undefined,
      textShadow:focus&&!wrong?`0 0 ${30+30*bell(age-8,26)}px rgba(255,190,70,.55)`:"0 12px 40px rgba(0,0,0,.45)"}}>
      {copy.hanzi}
      {wrong&&<div style={{position:"absolute",left:"-6%",right:"-6%",top:"52%",height:12,borderRadius:8,background:"#FF4A3D",
        transformOrigin:"0 50%",scale:`${easeOut((age-6)/9)} 1`}}/>}
      {wrong&&<Stamp age={age} delay={10} size={150}/>}
    </div>
    {copy.pinyin&&<div style={{marginTop:26,padding:"10px 30px",borderRadius:999,background:"rgba(0,0,0,.32)",
      border:"1.5px solid rgba(255,255,255,.22)",fontSize:52,fontWeight:700,color:C.brandGold,...reveal(age,5,24)}}>{copy.pinyin}</div>}
    {copy.meaning&&<div style={{marginTop:30,fontSize:58,fontWeight:800,textAlign:"center",letterSpacing:"-.01em",lineHeight:1.12,
      textShadow:"0 4px 18px rgba(0,0,0,.45)",...reveal(age,9,28)}}>{copy.meaning}</div>}
  </div></>;
};

const Card:React.FC<{copy:Copy;age:number;delay:number;side:number;focus:boolean;wrong:boolean}>=({copy,age,delay,side,focus,wrong})=>{
  const p=springProgress(age-delay,FPS,{naturalHz:2,dampingRatio:.7});
  const icon=slideIcon(copy.hanzi,LEX);
  const size=han(copy.hanzi).length>2?110:icon?150:170;
  return <div style={{...glassCard({flex:1,height:icon?520:470,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
    border:`${focus&&!wrong?4:1.5}px solid ${wrong?"rgba(255,90,80,.75)":focus?C.brandGold:"rgba(255,255,255,.26)"}`,
    boxShadow:focus&&!wrong?`0 0 ${36+20*bell(age-delay-6,24)}px rgba(255,190,70,.38), 0 30px 70px rgba(0,0,0,.35)`:undefined}),
    opacity:clamp01(p*1.6),translate:`${(1-Math.min(1,p))*side*140}px ${(1-Math.min(1,p))*40}px`,
    rotate:`${(1-Math.min(1,p))*side*6}deg`,filter:p<.98?`blur(${(1-clamp01(p))*S.blurInPx}px)`:undefined}}>
    {icon&&<MeaningIcon kind={icon} age={age-delay-6} size={MV.iconCardPx} tint={wrong?"#FFB4AE":undefined}/>}
    <div style={{fontFamily:G.hanziFontFamily,fontWeight:800,fontSize:size,lineHeight:1.05,
      color:wrong?"rgba(255,255,255,.6)":focus?C.brandGold:"#FFFFFF",position:"relative"}}>
      {han(copy.hanzi)}
      {wrong&&<div style={{position:"absolute",left:"-8%",right:"-8%",top:"52%",height:10,borderRadius:6,background:"#FF4A3D",
        transformOrigin:"0 50%",scale:`${easeOut((age-delay-6)/9)} 1`}}/>}
    </div>
    {copy.pinyin&&<div style={{marginTop:14,fontSize:44,fontWeight:700,color:C.brandGold}}>{copy.pinyin}</div>}
    {copy.meaning&&<div style={{marginTop:12,padding:"0 22px",fontSize:34,fontWeight:650,textAlign:"center",color:"rgba(255,255,255,.9)"}}>{copy.meaning}</div>}
    {wrong&&<Stamp age={age} delay={delay+10} size={104}/>}
  </div>;
};

const split=(text:string|undefined,count:number)=>{
  const parts=String(text??"").split("·").map(part=>part.trim());
  return parts.length===count?parts:null;
};

const Formula:React.FC<{copy:Copy;age:number;highlight:string|null;highlightAge:number;focus:Focus;fallback?:string}>=({copy,age,highlight,highlightAge,focus,fallback})=>{
  const chips=formulaChips(copy);
  const meaning=sentenceMeaning(copy,LEX);
  const total=chips.reduce((sum,chip)=>sum+chip.hanzi.length,0);
  const charPx=Math.min(124,Math.floor((900-chips.length*56)/Math.max(1,total)));
  const lit=highlight?chips.findIndex(chip=>chip.hanzi===highlight):-1;
  const h=springProgress(highlightAge,FPS,{naturalHz:2.4,dampingRatio:.7});
  const allPinyin=chips.every(chip=>chip.pinyin);
  const staged=Boolean(meaning||fallback);
  return <><div style={{position:"absolute",top:staged?MV.formulaTopPx:S.contentTopPx+40,left:40,right:40,display:"flex",flexDirection:"column",alignItems:"center"}}>
    <div style={{display:"flex",gap:18,alignItems:"flex-end",justifyContent:"center"}}>
      {chips.map((chip,index)=>{
        const isFocus=Boolean(focus)&&chip.hanzi===focus?.hanzi;
        const active=index===lit, dim=lit>=0&&!active;
        const pop=active?Math.min(1.06,h):0;
        // The chip blurs in once; a spoken word then lifts and the others dim.
        return <div key={index} style={{display:"flex",flexDirection:"column",alignItems:"center",...reveal(age,index*S.chipStaggerFrames,60),
          scale:`${1+.12*pop}`}}>
          <div style={{...glassCard({padding:"18px 24px 22px",borderRadius:34,
            border:`${active?4:1.5}px solid ${active||isFocus?C.brandGold:"rgba(255,255,255,.26)"}`,
            boxShadow:active?`0 0 ${30+24*bell(highlightAge-4,24)}px rgba(255,190,70,.5), 0 24px 60px rgba(0,0,0,.35)`:undefined}),
            opacity:dim?1-.55*clamp01(h):1}}>
            <div style={{fontFamily:G.hanziFontFamily,fontWeight:800,fontSize:charPx,lineHeight:1.05,
              color:isFocus||active?C.brandGold:"#FFFFFF"}}>{chip.hanzi}</div>
          </div>
          {allPinyin&&<div style={{marginTop:14,fontSize:38,fontWeight:700,color:C.brandGold,opacity:dim?1-.5*clamp01(h):1}}>{chip.pinyin}</div>}
        </div>;
      })}
    </div>
    {!allPinyin&&copy.pinyin&&<div style={{marginTop:18,fontSize:42,fontWeight:700,color:C.brandGold,...reveal(age,chips.length*S.chipStaggerFrames,16)}}>{copy.pinyin}</div>}
    <svg width="860" height="46" viewBox="0 0 860 46" style={{marginTop:14,overflow:"visible"}}>
      <path d="M20 6 Q20 32 60 32 L800 32 Q840 32 840 6" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="4" strokeLinecap="round"
        pathLength={1} strokeDasharray={1} strokeDashoffset={1-easeInOut((age-chips.length*S.chipStaggerFrames)/14)}/>
    </svg>
    {copy.meaning&&<div style={{marginTop:staged?10:22,fontSize:staged?44:56,fontWeight:800,textAlign:"center",lineHeight:1.12,letterSpacing:"-.01em",
      textShadow:"0 4px 18px rgba(0,0,0,.45)",...reveal(age,chips.length*S.chipStaggerFrames+8,28)}}>{copy.meaning}</div>}
  </div>
  {meaning&&<MeaningStage meaning={meaning} age={age-chips.length*S.chipStaggerFrames} lit={highlight} litAge={highlightAge} top={MV.stageTopPx}
    role={meaning.pattern==="comparison"?comparisonRole(meaning,highlight):null} lexicon={LEX}/>}
  {!meaning&&fallback&&<ArtCard src={fallback} age={age-chips.length*S.chipStaggerFrames} top={MV.stageTopPx}/>}
  </>;
};

const Stack:React.FC<{rows:{copy:Copy;wrong:boolean;fresh:boolean}[];age:number}>=({rows,age})=>
  <div style={{position:"absolute",top:S.contentTopPx+20,left:70,right:70,display:"flex",flexDirection:"column",gap:30}}>
    {rows.map((row,index)=>{
      const p=row.fresh?springProgress(age-index*3,FPS,spring):1;
      return <div key={index} style={{...glassCard({display:"flex",alignItems:"center",gap:34,padding:"30px 40px"}),
        opacity:clamp01(p*1.6),translate:`0 ${(1-Math.min(1,p))*120}px`,filter:p<.98?`blur(${(1-clamp01(p))*S.blurInPx}px)`:undefined}}>
        {slideIcon(row.copy.hanzi,LEX)&&<MeaningIcon kind={slideIcon(row.copy.hanzi,LEX)!} age={age-index*3-4} size={86}/>}
        <div style={{fontFamily:G.hanziFontFamily,fontWeight:800,fontSize:96,whiteSpace:"nowrap"}}>{han(row.copy.hanzi)}</div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {row.copy.pinyin&&<div style={{fontSize:38,fontWeight:700,color:C.brandGold}}>{row.copy.pinyin}</div>}
          {row.copy.meaning&&<div style={{fontSize:34,fontWeight:650,color:"rgba(255,255,255,.9)"}}>{row.copy.meaning}</div>}
        </div>
      </div>;
    })}
  </div>;

/** The slide content of `mode` (theme background is drawn by the caller). */
export const SlideContent:React.FC<{episodeId:string;beats:ResolvedMotionBeat[];modes:VisualMode[];index:number;frame:number;focus:Focus}>=({episodeId,beats,modes,index,frame,focus})=>{
  const mode=modes[index];
  const artOf=(row:number)=>{const image=(beats[row]?.visual as {illustration?:{images?:string[]}}|undefined)?.illustration?.images?.[0];
    return image?art(episodeId,image):undefined;};
  // Content age: from the first beat that showed this exact content.
  let first=index;
  while(first>0&&modes[first-1].mode==="slide"&&modes[first-1].content===mode.content)first--;
  const lead=4;
  const age=frame-(beats[first].localFrame-lead);
  const highlightAge=frame-(beats[index].localFrame-2);
  const isFocus=(text?:string)=>Boolean(focus)&&han(text)===han(focus?.hanzi);
  const wrongAt=(row:number)=>modes[row]?.wrong===true;
  let body:ReactNode=null;
  if(mode.template==="formula")body=<Formula copy={copyOf(beats[mode.formulaBeat!])} age={age} highlight={mode.highlight??null}
    highlightAge={highlightAge} focus={focus} fallback={artOf(mode.formulaBeat!)}/>;
  else if(mode.template==="hero"){const row=mode.rows![0];
    body=<Hero copy={copyOf(beats[row])} age={age} focus={isFocus(copyOf(beats[row]).hanzi)} wrong={wrongAt(row)} fallback={artOf(row)}/>;}
  else if(mode.template==="stack")body=<Stack age={age} rows={mode.rows!.map(row=>({copy:copyOf(beats[row]),wrong:wrongAt(row),
    fresh:row===mode.rows![mode.rows!.length-1]}))}/>;
  else {
    const copies:Copy[]=[];const wrong:boolean[]=[];
    if(mode.template==="contrast"){
      const copy=copyOf(beats[mode.rows![0]]);
      const hanzi=split(copy.hanzi,2), pinyin=split(copy.pinyin,2);
      (hanzi??[copy.hanzi??""]).forEach((part,i)=>{copies.push({hanzi:part,pinyin:pinyin?.[i]});wrong.push(false);});
      body=<div style={{position:"absolute",top:S.contentTopPx,left:56,right:56,display:"flex",flexDirection:"column",alignItems:"center"}}>
        <div style={{display:"flex",gap:36,width:"100%"}}>
          {copies.map((item,i)=><Card key={i} copy={item} age={age} delay={i*4} side={i?1:-1} focus={isFocus(item.hanzi)} wrong={false}/>)}
        </div>
        {copy.meaning&&<div style={{marginTop:34,fontSize:56,fontWeight:800,textAlign:"center",textShadow:"0 4px 18px rgba(0,0,0,.45)",
          ...reveal(age,12,28)}}>{copy.meaning}</div>}
      </div>;
    } else {
      body=<div style={{position:"absolute",top:S.contentTopPx,left:56,right:56,display:"flex",gap:36}}>
        {mode.rows!.map((row,i)=>{
          const fresh=row===mode.rows![mode.rows!.length-1];
          return <Card key={row} copy={copyOf(beats[row])} age={fresh?age:99} delay={fresh?0:0} side={i?1:-1}
            focus={isFocus(copyOf(beats[row]).hanzi)} wrong={wrongAt(row)}/>;
        })}
      </div>;
    }
  }
  return <AbsoluteFill style={{color:"#FFFFFF",fontFamily:G.fontFamily}}>{body}</AbsoluteFill>;
};
