import {AbsoluteFill, Easing, Img, interpolate, staticFile} from "remotion";
import type {ActionModel} from "../scripts/action-design-plan.mjs";
import type {ResolvedMotionBeat} from "../scripts/motion-design-plan.mjs";
import visual from "../content/visual-system.json";

const C=visual.colors;
const L=visual.narratedMotionLayout;
const A=visual.narratedActionLayout;
const P=visual.narratedActionPalette;
const easing={extrapolateLeft:"clamp" as const,extrapolateRight:"clamp" as const,easing:Easing.bezier(.18,.82,.2,1)};
const enter=(frame:number,start=0)=>interpolate(frame,[start,start+L.actionFrames],[0,1],easing);

// The same object/count/group components serve arbitrary authored lessons.
const ObjectGlyph:React.FC<{object:string;frame:number}>=({object,frame})=>{
  if(object==="book")return <g><rect x="-62" y="-81" width="124" height="162" rx="12" fill={C.brandTeal}/><path d="M-43-76V76M-24-41H38M-24-16H22" stroke={P.foreground} strokeWidth="7" strokeLinecap="round"/></g>;
  if(object==="apple")return <g><path d="M0-46C-98-109-101 62-25 78Q0 65 25 78C101 62 98-109 0-46" fill={C.brandRed}/><path d="M0-41Q-3-75 14-90" stroke={P.foreground} strokeWidth="8"/><path d="M9-70Q61-105 59-61Q36-39 9-70" fill={C.brandTeal}/></g>;
  return <g>
    <ellipse cy="78" rx="104" ry="16" fill={P.foreground} opacity=".12"/>
    <path d="M-74-24H69L58 47Q52 77 0 78Q-50 77-59 47Z" fill={P.foreground}/>
    <path d="M67-14C131-26 129 61 60 51" stroke={P.foreground} strokeWidth="17" fill="none"/>
    <ellipse cy="-24" rx="71" ry="18" fill={C.brandGold}/>
    <ellipse cy="-26" rx="57" ry="10" fill="#826438"/>
    <path d="M-36 18Q-11 41 26 22" fill="none" stroke={C.brandTeal} strokeWidth="8" strokeLinecap="round"/>
    {[-28,12,40].map((x,i)=><path key={x} d={`M${x} -55q${Math.sin(frame/17+i)*12} -17 0 -34t0 -34`} stroke={P.foreground} strokeWidth="5" strokeLinecap="round" fill="none" opacity=".25"/>)}
  </g>;
};

export const QuantityStage:React.FC<{model:ActionModel;frame:number;compact?:boolean}>=({model,frame,compact=false})=>{
  const count=model.count??0;
  const step=count>3?135:210;
  const scale=count>3?.68:.95;
  const grouping=model.grouped?enter(frame):0;
  const groupHalfWidth=Math.min(355,count*82);
  return <svg width="100%" height={compact?A.comparisonObjectHeightPx:A.objectHeightPx} viewBox="0 0 820 320" aria-label={`${count} ${model.object}; ${model.grouped?"grouped":"separate"}`}>
    <ellipse cx="410" cy="274" rx={Math.min(355,count*100)} ry="21" fill={C.brandGold} opacity={.03+grouping*.12}/>
    {model.grouped&&<g opacity={grouping}><path d={`M${410-groupHalfWidth} 263v18h${groupHalfWidth*2}v-18`} fill="none" stroke={C.brandGold} strokeWidth="5" strokeLinecap="round"/><text x="410" y="319" textAnchor="middle" fill={C.brandGold} fontSize="33" fontWeight="850">{count}</text></g>}
    {Array.from({length:count},(_,i)=>{
      const p=enter(frame,i*visual.motion.heroCharacterStaggerFrames);
      const x=410+(i-(count-1)/2)*(step-grouping*26);
      return <g key={i} opacity={p} transform={`translate(${x} ${146+(1-p)*48}) scale(${scale*(.92+.08*p)})`}>
        <ObjectGlyph object={model.object??"tea-cup"} frame={frame+i*15}/>
        {!model.grouped&&<text x="0" y="128" textAnchor="middle" fill={P.muted} fontSize="29">{i+1}</text>}
      </g>;
    })}
  </svg>;
};

const NumberStage:React.FC<{model:ActionModel;frame:number;compact?:boolean}>=({model,frame,compact=false})=>{
  const value=model.value??0;
  const p=enter(frame);
  return <div style={{width:"100%",height:compact?A.comparisonObjectHeightPx:A.objectHeightPx,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:12}}>
    <div style={{fontSize:compact?A.comparisonNumberFontPx:A.numberFontPx,fontWeight:900,lineHeight:.9,color:C.brandGold,scale:.9+.1*p}}>{value}</div>
    <svg width={compact?310:600} height="74" viewBox="0 0 600 74" aria-label={`${value} counted dots`}>
      {Array.from({length:value},(_,i)=><circle key={i} cx={38+(i%10)*58} cy={18+Math.floor(i/10)*21} r="7" fill={i<10?C.brandGold:C.brandTeal} opacity={enter(frame,Math.floor(i/10)*6)}/>) }
    </svg>
  </div>;
};

const OrdinalStage:React.FC<{model:ActionModel;frame:number;compact?:boolean}>=({model,frame,compact=false})=><svg width="100%" height={compact?A.comparisonObjectHeightPx:A.objectHeightPx} viewBox="0 0 820 320" aria-label={`position ${model.value}`}>
  {Array.from({length:Math.max(3,model.value??2)},(_,i)=>{
    const selected=i+1===model.value;
    const count=Math.max(3,model.value??2);
    const radius=Math.min(78,280/count);
    return <g key={i} transform={`translate(${110+i*600/(count-1)} ${130-(selected?20*enter(frame):0)})`}>
      <circle r={radius} fill={selected?C.brandGold:P.secondary}/>
      <text y={radius*.35} textAnchor="middle" fontSize={radius*1.05} fontWeight="900" fill={selected?P.background:P.foreground}>{i+1}</text>
      {selected&&<path d="M0 114v36m-16-17 16 17 16-17" stroke={C.brandGold} strokeWidth="7" fill="none" strokeLinecap="round"/>}
    </g>;
  })}
</svg>;

const ModelStage:React.FC<{model:ActionModel;kind:string;frame:number;compact?:boolean}>=({model,kind,frame,compact=false})=><>
  {(kind==="quantity"||model.count)&&<QuantityStage model={model} frame={frame} compact={compact}/>}
  {kind==="numeral"&&<NumberStage model={model} frame={frame} compact={compact}/>}
  {kind==="ordinal"&&<OrdinalStage model={model} frame={frame} compact={compact}/>}
</>;

export const NarratedActionScene:React.FC<{frame:number;beats:ResolvedMotionBeat[]}>=({frame,beats})=>{
  const elapsed=beats.filter(b=>frame>=b.localFrame);
  const active=elapsed[elapsed.length-1]??beats[0];
  const model=active.visual;
  if(!model) throw Error("Narrated action is missing its authored visual payload.");
  // Reuse only an object/count explicitly authored in this scene, so phrase
  // explanations retain context without another text layer.
  const context=beats.map(beat=>beat.visual).find(entry=>entry?.object&&entry.count);
  const stageModel=model.object||active.kind!=="phrase"?model:context?{...context,...model,object:context.object,count:context.count}:model;
  const local=Math.max(0,frame-active.localFrame);
  return <AbsoluteFill style={{background:`radial-gradient(ellipse at 50% 49%, ${C.brandTeal}22, transparent 65%), ${P.background}`,color:P.foreground}}>
    <div style={{position:"absolute",top:visual.motion.brandTopInsetPx,left:0,right:0,display:"flex",alignItems:"center",justifyContent:"center",gap:14,fontSize:30,fontWeight:900}}><Img src={staticFile("branding/hsk-ai-logo-1024.png")} style={{width:42,height:42,borderRadius:12}}/>HSK <span style={{color:C.brandGold}}>AI</span></div>
    <div data-action-id={active.id} data-action-kind={active.kind} style={{position:"absolute",top:A.stageTopPx,left:80,right:80,height:A.graphicHeightPx,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:A.gapPx}}>
      {active.kind==="comparison"?<div style={{display:"flex",alignItems:"center",width:"100%",gap:A.comparisonGapPx}}>
        {model.models?.map((m,i)=><div key={i} style={{flex:1,minWidth:0,display:"flex",flexDirection:"column",alignItems:"center",gap:A.gapPx}}><ModelStage model={m} kind={m.kind??"phrase"} frame={local} compact/></div>)}
      </div>:active.kind==="choice"?<>
        {model.count?<QuantityStage model={model} frame={local}/>:context&&<svg width="100%" height={A.objectHeightPx} viewBox="0 0 820 320"><g transform="translate(410 160)"><ObjectGlyph object={context.object??"tea-cup"} frame={local}/></g></svg>}
        {model.selected&&<svg width="80" height="70" viewBox="0 0 80 70" aria-label="correct choice"><path d="M12 33 32 53 68 12" fill="none" stroke={C.brandGold} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" opacity={enter(local)}/></svg>}
      </>:<ModelStage model={stageModel} kind={active.kind} frame={local}/> }
    </div>
  </AbsoluteFill>;
};
