import type {CSSProperties, ReactNode} from "react";
import {Img} from "remotion";
import visual from "../../content/visual-system.json";
import {bell, springProgress} from "../../scripts/pro-motion-plan.mjs";
import type {ComparisonSide, SentenceMeaning} from "../../scripts/meaning-visual-plan.mjs";
import {aspect, svgUri} from "../IllustratedLessonScene";
import {GOLD, ICE, WARM, MeaningIcon} from "./MeaningIcons";
import {PRO, clamp01, easeInOut, easeOut} from "./SceneTransitions";

/**
 * Animated meaning stages under a formula slide (content/EDITING_SPEC.md#professional-motion-system):
 * one stage per sentence pattern found by scripts/meaning-visual-plan.mjs#sentenceMeaning.
 * Every motion starts from the formula's spoken cue (`age`); the element the
 * narration names (`lit`) glows on its own cue. People are always HSK AI cast.
 */
const G=visual.referenceGlass, FPS=30;
const M=PRO.meaning;
const W=940, H=M.stageHeightPx, BASE=H-118;
const han=(text?:string|null)=>(String(text??"").match(/\p{Script=Han}/gu)??[]).join("");
const spring=(t:number,hz=2.2,d=.62)=>Math.max(0,springProgress(t,FPS,{naturalHz:hz,dampingRatio:d}));
const fmt=(value:number)=>String(Math.round(value));

type Lit={lit:string|null;litAge:number};
const glowOf=({lit,litAge}:Lit,hanzi?:string|null)=>lit&&hanzi&&han(lit)===han(hanzi)?bell(litAge,22):0;

const chipStyle=(active:boolean):CSSProperties=>({display:"flex",alignItems:"baseline",gap:10,padding:"6px 20px",borderRadius:999,
  background:"linear-gradient(150deg, rgba(255,255,255,.18), rgba(255,255,255,.06))",whiteSpace:"nowrap",
  border:`${active?3:1.5}px solid ${active?GOLD:"rgba(255,255,255,.3)"}`,
  boxShadow:active?"0 0 26px rgba(255,190,70,.45)":"0 10px 30px rgba(0,0,0,.3)",backdropFilter:"blur(14px)"});

/** Hanzi label chip centred on x (stage px). */
const Chip:React.FC<{x:number;y:number;hanzi:string;pinyin?:string|null;age:number;delay:number;glow?:number;size?:number;tone?:string}>=
  ({x,y,hanzi,pinyin,age,delay,glow=0,size=50,tone})=>{
  const p=spring(age-delay);
  return <div style={{position:"absolute",left:x-240,width:480,top:y,display:"flex",justifyContent:"center",opacity:clamp01(p*1.6),
    translate:`0 ${(1-Math.min(1,p))*20}px`,scale:`${(.9+.1*Math.min(1.04,p))*(1+.1*glow)}`}}>
    <div style={chipStyle(glow>.05)}>
      <span style={{fontFamily:G.hanziFontFamily,fontSize:size,fontWeight:800,color:tone??(glow>.05?GOLD:"#FFFFFF")}}>{hanzi}</span>
      {pinyin&&<span style={{fontSize:Math.round(size*.56),fontWeight:700,color:GOLD}}>{pinyin}</span>}
    </div>
  </div>;
};

/** An HSK AI cast member standing on a baseline (bottom-centre at x, y). */
const Figure:React.FC<{id:string;x:number;y:number;h:number;age:number;delay:number;mood?:string;glow?:number}>=
  ({id,x,y,h,age,delay,mood="idle",glow=0})=>{
  const p=spring(age-delay,2.2,.55), w=h*aspect(id);
  const breathe=Math.sin((age+x)/14)*.012;
  return <Img src={svgUri(id,mood)} style={{position:"absolute",left:x-w/2,top:y-h,width:w,height:h,opacity:clamp01(p*1.8),
    transformOrigin:"50% 100%",scale:`${(.7+.3*Math.min(1.05,p))*(1+.05*glow)*(1+breathe*.6)} ${(.7+.3*Math.min(1.05,p))*(1+.05*glow)*(1-breathe)}`,
    filter:`drop-shadow(0 10px 18px rgba(0,0,0,.35))${glow>.05?` drop-shadow(0 0 ${20*glow}px rgba(255,200,90,.9))`:""}`}}/>;
};

/** A lexicon icon at (x, y) top-left with a pop entrance; a glass word block when no icon exists. */
const Thing:React.FC<{icon:string|null;hanzi:string;x:number;y:number;size:number;age:number;delay:number;glow?:number;dim?:number}>=
  ({icon,hanzi,x,y,size,age,delay,glow=0,dim=1})=>{
  const p=spring(age-delay,2.4,.55);
  const style:CSSProperties={position:"absolute",left:x,top:y,width:size,height:size,opacity:clamp01(p*1.8)*dim,
    transformOrigin:"50% 100%",scale:`${(.6+.4*Math.min(1.06,p))*(1+.08*glow)}`,
    filter:glow>.05?`drop-shadow(0 0 ${22*glow}px rgba(255,200,90,.85))`:"drop-shadow(0 12px 22px rgba(0,0,0,.35))"};
  const drawn=icon?<MeaningIcon kind={icon} age={age-delay} size={size}/>:null;
  return <div style={style}>{drawn??<div style={{...chipStyle(glow>.05),borderRadius:28,width:"100%",height:"100%",justifyContent:"center",
    alignItems:"center",fontFamily:G.hanziFontFamily,fontSize:size*.42,fontWeight:800}}>{hanzi}</div>}</div>;
};

const Glass:React.FC<{x:number;y:number;w:number;h:number;age:number;delay:number;glow?:number;children?:ReactNode;round?:boolean}>=
  ({x,y,w,h,age,delay,glow=0,children,round})=>{
  const p=spring(age-delay,2,.7);
  return <div style={{position:"absolute",left:x,top:y,width:w,height:h,borderRadius:round?"50%":40,opacity:clamp01(p*1.6),
    translate:`0 ${(1-Math.min(1,p))*40}px`,background:"linear-gradient(150deg, rgba(255,255,255,.16), rgba(255,255,255,.05) 55%, rgba(255,255,255,.09))",
    border:`${glow>.05?4:1.5}px solid ${glow>.05?GOLD:"rgba(255,255,255,.26)"}`,backdropFilter:"blur(16px)",
    boxShadow:glow>.05?`0 0 ${30*glow+10}px rgba(255,190,70,.45)`:"0 26px 60px rgba(0,0,0,.32), inset 0 1.5px 0 rgba(255,255,255,.3)"}}>{children}</div>;
};

/* ---------- 比: two sides measured on one baseline ---------- */
const ComparisonStage:React.FC<{m:Extract<SentenceMeaning,{pattern:"comparison"}>;age:number;role:string|null;roleAge:number}>=({m,age,role,roleAge})=>{
  const cx=[250,690];
  const sides:ComparisonSide[]=[m.a,m.b];
  const grow=easeOut((age-M.growStartFrames)/M.growFrames);
  const gap=easeInOut((age-M.growStartFrames-M.growFrames+2)/12);
  const badge=spring(age-M.badgeFrames,2.6,.5);
  const pulse=(which:string)=>role===which?bell(roleAge,22):0;
  const enter=(i:number)=>spring(age-4-i*5);
  const thermo=m.component==="thermometer", count=m.component==="count";
  // 比: A wins; 没有: B wins (A is less ADJ); 一样: both stand level.
  const equal=m.relation==="equal", winner=m.relation==="less"?1:0;
  const maxValue=Math.max(...sides.map(side=>Math.abs(side.value)),1), maxBar=BASE-120;
  const thermoY=(t:number)=>BASE-46-clamp01((t-M.thermoMin)/(M.thermoMax-M.thermoMin))*(BASE-110);
  const topAt=(side:ComparisonSide,p:number)=>thermo?thermoY(M.thermoMin+(side.value-M.thermoMin)*p):BASE-maxBar*Math.abs(side.value)/maxValue*p;
  const tops=sides.map(side=>topAt(side,grow)), full=sides.map(side=>topAt(side,1));
  const withCast=(side:ComparisonSide)=>Boolean(side.cast)&&m.component==="height";
  const barX=(i:number)=>withCast(sides[i])?cx[i]+70:cx[i];
  const coldWinner=thermo&&sides[winner].value<sides[1-winner].value;
  let columns:ReactNode[];
  if(thermo)columns=sides.map((side,i)=>{
    const x=cx[i], e=enter(i), mercury=side.value<10?ICE:WARM, glow=pulse(i?"b":"a");
    return <g key={i} opacity={clamp01(e*1.6)} transform={`translate(0 ${(1-Math.min(1,e))*40})`}>
      <rect x={x-24} y={34} width={48} height={BASE-70} rx={24} fill="rgba(255,255,255,.12)" stroke={glow>.05?GOLD:"rgba(255,255,255,.55)"} strokeWidth={3+3*glow}/>
      <circle cx={x} cy={BASE-30} r={40} fill="rgba(255,255,255,.12)" stroke="rgba(255,255,255,.55)" strokeWidth={3}/>
      {Array.from({length:6},(_,k)=><line key={k} x1={x-44} x2={x-30} y1={thermoY(M.thermoMin+k*10)} y2={thermoY(M.thermoMin+k*10)}
        stroke="rgba(255,255,255,.45)" strokeWidth={3} strokeLinecap="round"/>)}
      <circle cx={x} cy={BASE-30} r={30} fill={mercury}/>
      <rect x={x-12} y={tops[i]} width={24} height={Math.max(0,BASE-30-tops[i])} rx={12} fill={mercury}/>
    </g>;
  });
  else if(count)columns=sides.map((side,i)=><g key={i}>{Array.from({length:Math.round(Math.abs(side.value))},(_,k)=>{
    const p=spring(age-M.growStartFrames-k*3-i*2,2.8,.55);
    return <circle key={k} cx={cx[i]-70+(k%3)*70} cy={BASE-40-Math.floor(k/3)*70} r={26*Math.min(1.1,p)} fill={i===0?GOLD:"rgba(255,255,255,.75)"} opacity={clamp01(p*2)}/>;
  })}</g>);
  else columns=sides.map((side,i)=>{
    const e=enter(i), x=barX(i), w=withCast(side)?66:120, h=Math.max(0,BASE-tops[i]), glow=pulse(i?"b":"a");
    return <g key={i} opacity={clamp01(e*1.6)}>
      <defs><linearGradient id={`mv-bar-${i}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={i===0?"#FFD27A":"rgba(255,255,255,.75)"}/><stop offset="1" stopColor={i===0?"#E0891E":"rgba(255,255,255,.25)"}/>
      </linearGradient></defs>
      <rect x={x-w/2} y={tops[i]} width={w} height={h} rx={Math.min(18,w/3)} fill={`url(#mv-bar-${i})`} stroke={glow>.05?GOLD:"none"} strokeWidth={4*glow}/>
      {Array.from({length:Math.floor(h/32)},(_,k)=><line key={k} x1={x+w/2-16} x2={x+w/2-4} y1={BASE-16-k*32} y2={BASE-16-k*32}
        stroke="rgba(0,0,0,.28)" strokeWidth={3} strokeLinecap="round"/>)}
    </g>;
  });
  const gx=(cx[0]+cx[1])/2, signGlow=pulse("sign");
  const edge=(i:number)=>thermo?cx[i]+(i?-30:30):barX(i)+(i?-1:1)*(withCast(sides[i])?33:60);
  return <>
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{position:"absolute",inset:0,overflow:"visible"}}>
      <line x1={40} x2={W-40} y1={BASE} y2={BASE} stroke="rgba(255,255,255,.6)" strokeWidth={4} strokeLinecap="round"
        pathLength={1} strokeDasharray={1} strokeDashoffset={1-easeInOut(age/10)}/>
      {columns}
      {!count&&!equal&&gap>0&&<g opacity={gap}>
        {full.map((y,i)=><line key={i} x1={edge(i)} x2={gx} y1={y} y2={y} stroke="rgba(255,255,255,.55)" strokeWidth={3} strokeDasharray="10 10"/>)}
        <line x1={gx} x2={gx} y1={full[1]} y2={full[1]+(full[0]-full[1])*gap} stroke={GOLD} strokeWidth={5+3*signGlow} strokeLinecap="round"/>
        <path d={`M ${gx-12} ${full[0]+(full[0]<full[1]?14:-14)} L ${gx} ${full[0]} L ${gx+12} ${full[0]+(full[0]<full[1]?14:-14)}`}
          fill="none" stroke={GOLD} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" opacity={gap>=1?1:0}/>
      </g>}
      {!count&&equal&&gap>0&&<g opacity={gap}>
        <line x1={edge(0)-40} x2={edge(1)+40} y1={full[0]} y2={full[0]} stroke={GOLD} strokeWidth={5} strokeDasharray="14 10"
          pathLength={1} strokeDashoffset={0}/>
        <g transform={`translate(${gx} ${full[0]-40}) scale(${Math.min(1.1,gap)})`}>
          <line x1={-18} x2={18} y1={-7} y2={-7} stroke={GOLD} strokeWidth={7} strokeLinecap="round"/>
          <line x1={-18} x2={18} y1={7} y2={7} stroke={GOLD} strokeWidth={7} strokeLinecap="round"/></g>
      </g>}
    </svg>
    {m.component==="height"&&sides.map((side,i)=>side.cast&&<Figure key={i} id={side.cast} x={cx[i]-50} y={BASE}
      h={maxBar*Math.abs(side.value)/maxValue*.98} age={age} delay={4+i*5} mood={badge>0&&(equal||i===winner)?"proud":"idle"} glow={pulse(i?"b":"a")}/>)}
    {!count&&sides.map((side,i)=><div key={i} style={{position:"absolute",left:thermo?cx[i]+40:barX(i)-120+(equal?(i?60:-60):0),width:thermo?200:240,
      top:tops[i]-(thermo?24:66),textAlign:thermo?"left":"center",fontSize:42,fontWeight:850,fontVariantNumeric:"tabular-nums",
      opacity:clamp01((age-M.growStartFrames)/4),color:i===0?GOLD:"#FFFFFF",textShadow:"0 3px 12px rgba(0,0,0,.5)"}}>
      {fmt(side.value*grow)}{m.unit?(thermo?m.unit:" "+m.unit):""}</div>)}
    {count&&sides.map((side,i)=><div key={i} style={{position:"absolute",left:cx[i]-120,width:240,top:20,textAlign:"center",fontSize:52,
      fontWeight:850,color:i===0?GOLD:"#FFFFFF",opacity:clamp01((age-M.growStartFrames)/4)}}>
      {Math.min(Math.round(Math.abs(side.value)),Math.max(0,Math.floor((age-M.growStartFrames)/3)+1))}</div>)}
    {thermo&&!equal&&grow>.6&&Array.from({length:M.particles},(_,k)=>{
      const seed=(k*73)%100/100, speed=1.6+seed*1.4, fade=clamp01((grow-.6)/.4);
      const y=(age*speed+k*41)%(BASE-40), x=cx[winner]-110+((k*137)%220)+Math.sin((age+k*9)/9)*10;
      return coldWinner
        ?<div key={k} style={{position:"absolute",left:x,top:y,width:18+seed*12,height:18+seed*12,opacity:.85*fade,rotate:`${age*3+k*30}deg`}}>
          <svg viewBox="-10 -10 20 20" width="100%" height="100%"><g stroke="#DDF3FF" strokeWidth={1.8} strokeLinecap="round">
            <line x1={-8} y1={0} x2={8} y2={0}/><line x1={-4} y1={-7} x2={4} y2={7}/><line x1={-4} y1={7} x2={4} y2={-7}/></g></svg></div>
        :<div key={k} style={{position:"absolute",left:x,top:BASE-40-y,width:10,height:44,borderRadius:8,opacity:.5*fade,
          background:"linear-gradient(0deg, transparent, rgba(255,170,90,.9), transparent)"}}/>;
    })}
    {badge>0&&<div style={{position:"absolute",left:gx-200,width:400,top:-6,
      display:"flex",justifyContent:"center",opacity:clamp01(badge*2),scale:`${Math.min(1.08,badge)*(1+.16*pulse("adj"))}`}}>
      <div style={chipStyle(role==="adj")}>
        <span style={{fontFamily:G.hanziFontFamily,fontSize:60,fontWeight:800,color:GOLD}}>{m.adjective.hanzi}</span>
        {m.adjective.pinyin&&<span style={{fontSize:30,fontWeight:700,color:"#FFE7A3"}}>{m.adjective.pinyin}</span>}
      </div></div>}
    {sides.map((side,i)=><Chip key={i} x={cx[i]} y={BASE+20} hanzi={side.hanzi} pinyin={side.pinyin} age={age} delay={4+i*5} glow={pulse(i?"b":"a")}/>)}
    {signGlow>.05&&<div style={{position:"absolute",left:gx-130,width:260,top:(equal?full[0]-150:(full[0]+full[1])/2-40),textAlign:"center",
      fontFamily:G.hanziFontFamily,fontSize:64,fontWeight:800,color:GOLD,opacity:signGlow,textShadow:"0 0 24px rgba(255,190,70,.8)"}}>{m.marker}</div>}
  </>;
};

/* ---------- 上有 / 在…上: an object lands on, under, in or beside another ---------- */
const LocationStage:React.FC<{m:Extract<SentenceMeaning,{pattern:"location"}>;age:number}&Lit>=({m,age,...lit})=>{
  // Sized so the pin and the position chip stay inside the stage, below the formula's meaning line.
  const box=400, cTop=BASE-box*.9, cx=W/2;
  const item=170;
  const spot:Record<string,[number,number,number]>={on:[cx+20,cTop+box*.4-item*.86,1],under:[cx,BASE-item*.86,.9],in:[cx,cTop+box*.45,.8],
    beside:[cx+300,BASE-item*.88,1],front:[cx,BASE-item*.7,1.1],behind:[cx-60,cTop+box*.2,.7]};
  const [ix,iy,scale]=spot[m.position]??spot.on;
  const placed=m.form==="placed";
  const fall=spring(age-14,2,.42);
  const dropY=placed?0:(1-Math.min(1,fall))*-(iy+item+60);
  const land=placed?0:bell(age-24,10);
  const pin=spring(age-20,2.2,.45);
  const posGlow=glowOf(lit,m.positionHanzi);
  return <>
    <Thing icon={m.container.icon} hanzi={m.container.hanzi} x={cx-box/2} y={cTop} size={box} age={age} delay={2} glow={glowOf(lit,m.container.hanzi)}/>
    {m.item?<div style={{position:"absolute",left:ix-item*scale/2,top:iy+dropY,width:item*scale,height:item*scale,transformOrigin:"50% 100%",
      scale:`${1+.12*land} ${1-.14*land}`,opacity:placed?clamp01((age-6)/6):clamp01((age-14)*.5)}}>
      <Thing icon={m.item.icon} hanzi={m.item.hanzi} x={0} y={0} size={item*scale} age={age} delay={placed?6:14} glow={glowOf(lit,m.item.hanzi)}/>
    </div>
    // A bare place phrase: the spot itself pulses where something would stand.
    :<svg width={W} height={H} style={{position:"absolute",inset:0,overflow:"visible"}}>
      {[0,1,2].map(k=>{const t=((age-12+k*14)%42)/42;return age>12&&<ellipse key={k} cx={ix} cy={iy+item*scale*.86} rx={30+120*t} ry={10+34*t}
        fill="none" stroke={GOLD} strokeWidth={5*(1-t)} opacity={(1-t)*clamp01((age-12)/8)}/>;})}
      <ellipse cx={ix} cy={iy+item*scale*.86} rx={34} ry={12} fill={GOLD} opacity={clamp01((age-10)/8)*(.6+.3*Math.sin(age/5))}/>
    </svg>}
    {(placed||!m.item)&&pin>0&&<div style={{position:"absolute",left:ix-45,top:(m.item?iy-100:iy+item*scale*.86-92)+(1-Math.min(1,pin))*-80,width:90,height:90,opacity:clamp01(pin*2)}}>
      <MeaningIcon kind="pin" age={age-20} size={90}/></div>}
    <svg width={W} height={H} style={{position:"absolute",inset:0,overflow:"visible"}}>
      <path d={`M ${ix+item*scale/2+90} ${iy-30} Q ${ix+item*scale/2+40} ${iy-40} ${ix+item*scale/2+8} ${iy+10}`} fill="none" stroke={GOLD}
        strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1-easeInOut((age-34)/10)}/>
    </svg>
    <Chip x={ix+item*scale/2+170} y={iy-90} hanzi={m.positionHanzi} age={age} delay={34} glow={posGlow} size={58}/>
    {m.count!==null&&<Chip x={ix-item*scale/2-150} y={iy-60} hanzi={`${m.count}${m.measure??""}`} age={age} delay={30} glow={glowOf(lit,m.measure)} size={44}/>}
    <Chip x={cx} y={BASE+20} hanzi={m.container.hanzi} age={age} delay={6} glow={glowOf(lit,m.container.hanzi)}/>
  </>;
};

/* ---------- 还是 / 或者: two options weighed ---------- */
const ChoiceStage:React.FC<{m:Extract<SentenceMeaning,{pattern:"choice"}>;age:number}&Lit>=({m,age,...lit})=>{
  if(m.kind==="pair")return <PairStage m={m} age={age} {...lit}/>;
  const cx=[220,720], card=290, top=10;
  const question=m.kind==="question";
  const t=Math.max(0,age-34), sway=.5-.5*Math.cos(Math.PI*t/22);
  const ringX=cx[0]+(cx[1]-cx[0])*sway;
  return <>
    {m.options.map((option,i)=><Glass key={i} x={cx[i]-card/2} y={top} w={card} h={card} age={age} delay={4+i*6} glow={glowOf(lit,option.hanzi)}>
      <Thing icon={option.icon} hanzi={option.hanzi} x={45} y={30} size={200} age={age} delay={8+i*6}/>
    </Glass>)}
    {question&&age>30&&<div style={{position:"absolute",left:ringX-card/2-10,top:top-10,width:card+20,height:card+20,borderRadius:46,
      border:`5px solid ${GOLD}`,boxShadow:"0 0 30px rgba(255,190,70,.55)",opacity:clamp01((age-30)/6)}}/>}
    {!question&&m.options.map((_,i)=>{const p=spring(age-30-i*8,2.6,.5);return <div key={i} style={{position:"absolute",left:cx[i]+card/2-70,top:top-20,
      width:90,height:90,scale:`${Math.min(1.1,p)}`,opacity:clamp01(p*2)}}><MeaningIcon kind="can" age={age-30-i*8} size={90}/></div>;})}
    <div style={{position:"absolute",left:W/2-70,top:top+70,width:140,height:140}}>
      <MeaningIcon kind={question?"question":"and"} age={age-18} size={140}/></div>
    {m.marker&&<Chip x={W/2} y={top+220} hanzi={m.marker} age={age} delay={16} glow={glowOf(lit,m.marker)} size={54}/>}
    {m.options.map((option,i)=><Chip key={i} x={cx[i]} y={BASE+20} hanzi={option.hanzi} age={age} delay={8+i*6} glow={glowOf(lit,option.hanzi)}/>)}
  </>;
};

/* ---------- 茶 / 咖啡: the options shown side by side, each bobbing in turn ---------- */
const PairStage:React.FC<{m:Extract<SentenceMeaning,{pattern:"choice"}>;age:number}&Lit>=({m,age,...lit})=>{
  const n=m.options.length, card=n>2?250:300, step=n>2?300:470, x0=W/2-step*(n-1)/2, top=40;
  const turn=Math.floor(Math.max(0,age-30)/24)%n;
  return <>
    {m.options.map((option,i)=>{const active=age>30&&turn===i, lift=active?-14*bell((age-30)%24,8):0;
      return <div key={i} style={{position:"absolute",left:0,top:lift,width:W,height:H}}>
        <Glass x={x0+i*step-card/2} y={top} w={card} h={card} age={age} delay={4+i*7} glow={Math.max(glowOf(lit,option.hanzi),active?.4:0)}>
          <Thing icon={option.icon} hanzi={option.hanzi} x={(card-card*.7)/2} y={card*.12} size={card*.7} age={age} delay={8+i*7}/>
        </Glass></div>;})}
    <svg width={W} height={H} style={{position:"absolute",inset:0,overflow:"visible"}}>
      {m.options.slice(1).map((_,i)=>{const x=x0+(i+.5)*step;return <line key={i} x1={x+22} y1={top+60} x2={x-22} y2={top+card-60} stroke={GOLD}
        strokeWidth={8} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1-easeInOut((age-18-i*6)/10)}/>;})}
    </svg>
    {m.options.map((option,i)=><Chip key={i} x={x0+i*step} y={BASE+20} hanzi={option.hanzi} age={age} delay={8+i*7} glow={glowOf(lit,option.hanzi)}/>)}
  </>;
};

/* ---------- 会 / 能 / 不能: a skill or permission checked or refused ---------- */
const ModalStage:React.FC<{m:Extract<SentenceMeaning,{pattern:"modal"}>;age:number}&Lit>=({m,age,...lit})=>{
  const cast=m.subject?.cast[0]??"panda";
  const refused=m.modal==="cannot"||m.modal==="noskill";
  const action={x:690,y:150,r:150};
  return <>
    <Figure id={cast} x={240} y={BASE} h={300} age={age} delay={2} mood={refused?"wrong":"correct"} glow={glowOf(lit,m.subject?.hanzi)}/>
    <svg width={W} height={H} style={{position:"absolute",inset:0,overflow:"visible"}}>
      <path d={`M 340 ${BASE-200} Q 440 ${BASE-300} ${action.x-action.r-10} ${action.y}`} fill="none" stroke="rgba(255,255,255,.6)" strokeWidth={4}
        strokeDasharray="12 12" pathLength={1} strokeDashoffset={0} opacity={clamp01((age-10)/8)}/>
    </svg>
    <Glass x={action.x-action.r} y={action.y-action.r} w={action.r*2} h={action.r*2} age={age} delay={6} round glow={glowOf(lit,m.action.hanzi)}>
      <Thing icon={m.action.icon} hanzi={m.action.hanzi} x={action.r-100} y={action.r-100} size={200} age={age} delay={10} dim={refused?1-.5*clamp01((age-28)/8):1}/>
      {refused&&<div style={{position:"absolute",inset:20}}><MeaningIcon kind="no" age={age-28} size={action.r*2-40}/></div>}
    </Glass>
    {!refused&&<div style={{position:"absolute",left:action.x+action.r-90,top:action.y-action.r-30,width:120,height:120,
      scale:`${Math.min(1.1,spring(age-28,2.6,.5))}`}}><MeaningIcon kind={m.modal==="skill"?"skill":"can"} age={age-28} size={120}/></div>}
    {m.time&&<div style={{position:"absolute",left:40,top:0,width:110,height:110}}><MeaningIcon kind="day" age={age-4} size={110}/></div>}
    {m.time&&<Chip x={210} y={30} hanzi={m.time} age={age} delay={6} glow={glowOf(lit,m.time)} size={44}/>}
    <Chip x={240} y={BASE+20} hanzi={m.subject?.hanzi??""} age={age} delay={4} glow={glowOf(lit,m.subject?.hanzi)}/>
    <Chip x={action.x} y={BASE+20} hanzi={`${m.modalHanzi} ${m.action.hanzi}`} age={age} delay={30} glow={Math.max(glowOf(lit,m.modalHanzi),glowOf(lit,m.action.hanzi))}
      tone={refused?"#FF8A80":undefined}/>
  </>;
};

/* ---------- 也 / 都 / 是: who shares the predicate ---------- */
const InclusionStage:React.FC<{m:Extract<SentenceMeaning,{pattern:"inclusion"}>;age:number}&Lit>=({m,age,...lit})=>{
  const subjectCast=m.subject.cast;
  const badge=(x:number,y:number,delay:number,glow:number)=>{const p=spring(age-delay,2.6,.5);
    return <div key={`b${x}`} style={{position:"absolute",left:x-55,top:y-110,width:110,height:110,opacity:clamp01(p*2),scale:`${Math.min(1.1,p)*(1+.1*glow)}`}}>
      <MeaningIcon kind={m.predicate.icon??"check"} age={age-delay} size={110}/></div>;};
  const predicateGlow=glowOf(lit,m.predicate.hanzi);
  if(m.kind==="all"){
    const xs=[200,470,740], h=230;
    return <>
      {xs.map((x,i)=><Figure key={i} id={subjectCast[i%subjectCast.length]} x={x} y={BASE} h={h} age={age} delay={2+i*4} mood="correct" glow={glowOf(lit,m.subject.hanzi)}/>)}
      {xs.map((x,i)=>badge(x,BASE-h-6,16+i*7,predicateGlow))}
      <svg width={W} height={H} style={{position:"absolute",inset:0,overflow:"visible"}}>
        <path d={`M 110 ${BASE-h-110} V ${BASE-h-150} H ${W-110} V ${BASE-h-110}`} fill="none" stroke={GOLD} strokeWidth={6} strokeLinecap="round"
          pathLength={1} strokeDasharray={1} strokeDashoffset={1-easeInOut((age-40)/14)}/>
      </svg>
      <Chip x={W/2} y={BASE-h-200} hanzi={m.marker} age={age} delay={46} glow={glowOf(lit,m.marker)} size={54}/>
      <Chip x={W/2} y={BASE+20} hanzi={`${m.subject.hanzi} · ${m.predicate.hanzi}`} age={age} delay={8} glow={Math.max(predicateGlow,glowOf(lit,m.subject.hanzi))}/>
    </>;
  }
  if(m.kind==="also"){
    const other=["crane","panda","monkey","rabbit","dragon"].find(id=>id!==subjectCast[0])!;
    const h=270, xs=[250,690];
    const arc=easeInOut((age-26)/14);
    return <>
      <Figure id={other} x={xs[0]} y={BASE} h={h} age={age} delay={2} mood="idle"/>
      {badge(xs[0],BASE-h,8,0)}
      <Figure id={subjectCast[0]} x={xs[1]} y={BASE} h={h} age={age} delay={12} mood="correct" glow={glowOf(lit,m.subject.hanzi)}/>
      <svg width={W} height={H} style={{position:"absolute",inset:0,overflow:"visible"}}>
        <path d={`M ${xs[0]+60} ${BASE-h-80} Q ${W/2} ${BASE-h-200} ${xs[1]-60} ${BASE-h-80}`} fill="none" stroke={GOLD} strokeWidth={5}
          strokeLinecap="round" strokeDasharray="14 12" opacity={arc} pathLength={1}/>
      </svg>
      {badge(xs[1],BASE-h,38,predicateGlow)}
      <Chip x={W/2} y={BASE-h-200} hanzi={m.marker} age={age} delay={30} glow={glowOf(lit,m.marker)} size={58}/>
      <Chip x={xs[1]} y={BASE+20} hanzi={m.subject.hanzi} age={age} delay={14} glow={glowOf(lit,m.subject.hanzi)}/>
      <Chip x={xs[0]} y={BASE+20} hanzi={m.predicate.hanzi} age={age} delay={8} glow={predicateGlow}/>
    </>;
  }
  return <>
    <Figure id={subjectCast[0]} x={260} y={BASE} h={300} age={age} delay={2} mood="talk" glow={glowOf(lit,m.subject.hanzi)}/>
    <div style={{position:"absolute",left:W/2-60,top:BASE-220,width:120,textAlign:"center",fontSize:110,fontWeight:900,color:GOLD,
      opacity:clamp01((age-14)/6)}}>=</div>
    <Glass x={560} y={BASE-330} w={300} h={300} age={age} delay={18} glow={predicateGlow}>
      <Thing icon={m.predicate.icon} hanzi={m.predicate.hanzi} x={50} y={50} size={200} age={age} delay={22}/>
    </Glass>
    <Chip x={260} y={BASE+20} hanzi={m.subject.hanzi} age={age} delay={4} glow={glowOf(lit,m.subject.hanzi)}/>
    <Chip x={710} y={BASE+20} hanzi={m.predicate.hanzi} age={age} delay={20} glow={predicateGlow}/>
  </>;
};

/* ---------- 有点儿 / 一点儿 / 很: how much of a quality ---------- */
const DegreeStage:React.FC<{m:Extract<SentenceMeaning,{pattern:"degree"}>;age:number;lexicon:{comparisons?:Record<string,{unit?:string;more:number;less:number}>}}&Lit>=({m,age,lexicon,...lit})=>{
  const spec=lexicon.comparisons?.[m.adjective.hanzi];
  const glowD=glowOf(lit,m.degreeHanzi), glowA=glowOf(lit,m.adjective.hanzi);
  if(m.after&&spec){
    const from=spec.less, to=spec.less+(spec.more-spec.less)*m.degree;
    const p=easeInOut((age-24)/24), value=from+(to-from)*p;
    return <>
      <Thing icon={m.adjective.icon??"price"} hanzi={m.adjective.hanzi} x={60} y={30} size={260} age={age} delay={2} glow={glowA}/>
      <div style={{position:"absolute",left:380,top:60,display:"flex",alignItems:"center",gap:30,fontWeight:900,fontVariantNumeric:"tabular-nums"}}>
        <div style={{position:"relative",fontSize:84,color:"rgba(255,255,255,.55)",opacity:clamp01((age-8)/6)}}>{spec.unit}{fmt(from)}
          <div style={{position:"absolute",left:-6,right:-6,top:"52%",height:8,borderRadius:4,background:"#FF4A3D",transformOrigin:"0 50%",
            scale:`${easeOut((age-20)/8)} 1`}}/></div>
        <svg width={90} height={60} style={{opacity:clamp01((age-20)/6)}}><path d="M6 30 H78 M58 12 L80 30 L58 48" fill="none" stroke={GOLD} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round"/></svg>
        <div style={{fontSize:110,color:GOLD,opacity:clamp01((age-22)/4),textShadow:"0 0 24px rgba(255,190,70,.45)"}}>{spec.unit}{fmt(value)}</div>
      </div>
      <Chip x={600} y={BASE-110} hanzi={`${m.adjective.hanzi}${m.degreeHanzi}`} age={age} delay={30} glow={Math.max(glowD,glowA)} size={58}/>
    </>;
  }
  const level=clamp01(m.degree)*(spring(age-10,1.6,.6)), angle=-180+180*level;
  const R=230, cx=W/2, cy=BASE-20;
  const arc=(from:number,to:number)=>{const a=(v:number)=>Math.PI*(1+v);
    return `M ${cx+R*Math.cos(a(from))} ${cy+R*Math.sin(a(from))} A ${R} ${R} 0 0 1 ${cx+R*Math.cos(a(to))} ${cy+R*Math.sin(a(to))}`;};
  return <>
    <svg width={W} height={H} style={{position:"absolute",inset:0,overflow:"visible"}}>
      <path d={arc(0,1)} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth={34} strokeLinecap="round"/>
      {[["#3DDC97",0,.4],[GOLD,.4,.75],["#FF4A3D",.75,1]].map(([color,a,b],k)=><path key={k} d={arc(a as number,b as number)} fill="none"
        stroke={color as string} strokeWidth={34} opacity={clamp01((age-2-k*4)/8)*.85}/>)}
      {Array.from({length:11},(_,k)=>{const a=Math.PI*(1+k/10);return <line key={k} x1={cx+(R-40)*Math.cos(a)} y1={cy+(R-40)*Math.sin(a)}
        x2={cx+(R-56)*Math.cos(a)} y2={cy+(R-56)*Math.sin(a)} stroke="rgba(255,255,255,.6)" strokeWidth={4} strokeLinecap="round"/>;})}
      <g transform={`rotate(${angle} ${cx} ${cy})`}><line x1={cx} y1={cy} x2={cx+R-60} y2={cy} stroke="#FFFFFF" strokeWidth={10} strokeLinecap="round"/></g>
      <circle cx={cx} cy={cy} r={20} fill="#FFFFFF"/>
    </svg>
    {m.adjective.icon&&<div style={{position:"absolute",left:cx-70,top:cy-190,width:140,height:140}}>
      <MeaningIcon kind={m.adjective.icon} age={age-6} size={140}/></div>}
    <Chip x={cx} y={BASE+20} hanzi={`${m.degreeHanzi}${m.adjective.hanzi}`} age={age} delay={20} glow={Math.max(glowD,glowA)} size={54}/>
  </>;
};

/* ---------- 几 / 多少 / 一本书: counting things or a price ---------- */
const QuantityStage:React.FC<{m:Extract<SentenceMeaning,{pattern:"quantity"}>;age:number}&Lit>=({m,age,...lit})=>{
  const rolling=age<44;
  const [lo,hi]=m.range??[m.count??1,m.count??1];
  const roll=lo+((Math.floor(age/2)*7919)%(hi-lo+1));
  const shown=m.question?(rolling?String(roll):"?"):fmt((m.count??0)*clamp01((age-12)/(4*(m.count??1))));
  const glowQ=glowOf(lit,m.question), glowI=glowOf(lit,m.item?.hanzi);
  if(m.price){
    const coins=6;
    return <>
      {m.priced?<>
        <Thing icon={m.priced.icon} hanzi={m.priced.hanzi} x={40} y={40} size={280} age={age} delay={2} glow={glowOf(lit,m.priced.hanzi)}/>
        <div style={{position:"absolute",left:230,top:0,width:130,height:130,rotate:`${8*Math.sin(age/9)*Math.exp(-Math.max(0,age-10)/60)}deg`,
          transformOrigin:"20% 10%",opacity:clamp01((age-10)/6)}}><MeaningIcon kind="price" age={age-10} size={130}/></div></>
        :<Thing icon="price" hanzi="¥" x={40} y={20} size={300} age={age} delay={2} glow={glowI}/>}
      <div style={{position:"absolute",left:380,top:40,fontSize:150,fontWeight:900,color:GOLD,fontVariantNumeric:"tabular-nums",
        textShadow:"0 0 30px rgba(255,190,70,.45)",scale:`${1+.08*glowQ}`}}>¥{shown}</div>
      {Array.from({length:coins},(_,k)=>{const p=spring(age-10-k*5,2.4,.45);
        return <div key={k} style={{position:"absolute",left:700,top:BASE-60-k*26+(1-Math.min(1,p))*-260,width:120,height:60,opacity:clamp01(p*2)}}>
          <svg viewBox="0 0 120 60" width={120} height={60}><ellipse cx={60} cy={34} rx={56} ry={20} fill="#B07A10"/><ellipse cx={60} cy={26} rx={56} ry={20} fill={GOLD}/></svg></div>;})}
      {m.priced&&<Chip x={180} y={BASE+20} hanzi={m.priced.hanzi} age={age} delay={6} glow={glowOf(lit,m.priced.hanzi)}/>}
      <Chip x={540} y={BASE+20} hanzi={m.question?`${m.question}钱`:m.count!==null?`${m.count}${m.measure??"块"}`:m.item?.hanzi??"钱"} age={age} delay={20} glow={glowQ}/>
    </>;
  }
  const total=m.question?6:Math.min(9,m.count??1);
  const known=m.question?3:total;
  const size=130;
  return <>
    {Array.from({length:total},(_,k)=>{const col=k%3,row=Math.floor(k/3);
      const x=60+col*(size+20), y=BASE-size-row*(size*.75);
      const ghost=k>=known;
      return ghost?<div key={k} style={{position:"absolute",left:x,top:y,width:size,height:size,borderRadius:26,
        border:"4px dashed rgba(255,255,255,.45)",opacity:clamp01((age-20-k*4)/6)}}/>
        :<Thing key={k} icon={m.item?.icon??null} hanzi={m.item?.hanzi??""} x={x} y={y} size={size} age={age} delay={8+k*4} glow={glowI}/>;
    })}
    <div style={{position:"absolute",left:560,top:20,width:340,height:260,borderRadius:40,display:"grid",placeItems:"center",
      background:"linear-gradient(150deg, rgba(255,255,255,.16), rgba(255,255,255,.05))",border:`${glowQ>.05?4:1.5}px solid ${glowQ>.05?GOLD:"rgba(255,255,255,.26)"}`,
      fontSize:170,fontWeight:900,color:GOLD,fontVariantNumeric:"tabular-nums",opacity:clamp01((age-6)/6)}}>{shown}</div>
    <Chip x={730} y={BASE+20} hanzi={`${m.question??(m.count??"")}${m.measure??""}${m.item&&m.item.hanzi!==m.measure?m.item.hanzi:""}`} age={age} delay={14}
      glow={Math.max(glowQ,glowI)}/>
  </>;
};

/* ---------- 想 / 要 / 喜欢: a wish or a liking ---------- */
const WantStage:React.FC<{m:Extract<SentenceMeaning,{pattern:"want"}>;age:number}&Lit>=({m,age,...lit})=>{
  const like=m.kind==="like";
  const bob=6*Math.sin(age/10);
  return <>
    <Figure id={m.subject.cast[0]} x={240} y={BASE} h={300} age={age} delay={2} mood={like?"one-heart":"talk"} glow={glowOf(lit,m.subject.hanzi)}/>
    {!like&&[[360,BASE-300,16],[420,BASE-350,24]].map(([x,y,r],k)=>{const p=spring(age-8-k*4,2.6,.5);
      return <div key={k} style={{position:"absolute",left:x-r,top:y-r,width:r*2,height:r*2,borderRadius:"50%",scale:`${Math.min(1.1,p)}`,
        background:"rgba(255,255,255,.2)",border:"2px solid rgba(255,255,255,.5)"}}/>;})}
    {like&&Array.from({length:6},(_,k)=>{const t=((age+k*11)%50)/50;return <div key={k} style={{position:"absolute",left:300+k*30+Math.sin(age/8+k)*16,
      top:BASE-260-t*180,width:56,height:56,opacity:Math.sin(Math.PI*t)*clamp01((age-10)/8)}}><MeaningIcon kind="heart" age={99} size={56}/></div>;})}
    <Glass x={520} y={20+bob} w={340} h={300} age={age} delay={16} glow={glowOf(lit,m.object.hanzi)}>
      <Thing icon={m.object.icon} hanzi={m.object.hanzi} x={70} y={50} size={200} age={age} delay={20}/>
    </Glass>
    <Chip x={240} y={BASE+20} hanzi={`${m.subject.hanzi}${m.verbHanzi}`} age={age} delay={6} glow={Math.max(glowOf(lit,m.verbHanzi),glowOf(lit,m.subject.hanzi))}/>
    <Chip x={690} y={BASE+20} hanzi={m.object.hanzi} age={age} delay={20} glow={glowOf(lit,m.object.hanzi)}/>
  </>;
};

/* ---------- plain action / question: who does it, when, together, refused (不/没) or completed (了/过) ---------- */
type ActionExtras={time?:string|null;timeIcon?:string|null;negated?:boolean;done?:boolean;together?:{hanzi:string;cast:string[]}|null};
const ActionStage:React.FC<{subject:{hanzi:string;cast:string[]}|null;thing:{hanzi:string;icon:string|null}|null;question?:string|null;age:number}&Lit&ActionExtras>=
  ({subject,thing,question,age,time=null,timeIcon=null,negated=false,done=false,together=null,...lit})=>{
  const partner=together?(together.cast.find(id=>id!==subject?.cast[0])??(subject?.cast[0]==="rabbit"?"monkey":"rabbit")):null;
  const mark=spring(age-30,2.6,.45);
  return <>
  {subject&&<Figure id={subject.cast[0]} x={partner?170:240} y={BASE} h={300} age={age} delay={2} mood={question?"talk":negated?"idle":"correct"} glow={glowOf(lit,subject.hanzi)}/>}
  {partner&&<Figure id={partner} x={350} y={BASE} h={270} age={age} delay={8} mood="correct" glow={glowOf(lit,together?.hanzi)}/>}
  {question&&<div style={{position:"absolute",left:subject?380:120,top:0,width:200,height:200}}><MeaningIcon kind={question==="几点"?"clock":"question"} age={age-10} size={200}/></div>}
  {time&&<><div style={{position:"absolute",left:subject?40:120,top:-10,width:130,height:130,opacity:clamp01((age-6)/6)}}>
    <MeaningIcon kind={timeIcon??"day"} age={age-6} size={130}/></div>
    <Chip x={(subject?40:120)+250} y={30} hanzi={time} age={age} delay={8} glow={glowOf(lit,time)} size={50}/></>}
  {thing&&<Glass x={560} y={20} w={320} h={300} age={age} delay={12} glow={glowOf(lit,thing.hanzi)}>
    <Thing icon={thing.icon} hanzi={thing.hanzi} x={60} y={50} size={200} age={age} delay={16} dim={negated?1-.45*clamp01(mark):1}/></Glass>}
  {thing&&negated&&mark>0&&<div style={{position:"absolute",left:600,top:40,width:240,height:240,scale:`${1.6-.6*Math.min(1.05,mark)}`,opacity:clamp01(mark*2)}}>
    <MeaningIcon kind="no" age={age-30} size={240}/></div>}
  {thing&&done&&!negated&&mark>0&&<div style={{position:"absolute",left:800,top:-10,width:120,height:120,borderRadius:"50%",background:"rgba(20,60,40,.85)",
    border:"3px solid #3DDC97",scale:`${Math.min(1.1,mark)}`,opacity:clamp01(mark*2)}}><MeaningIcon kind="check" age={age-30} size={120}/></div>}
  {subject&&<Chip x={partner?260:240} y={BASE+20} hanzi={together?`${subject.hanzi}和${together.hanzi}`:subject.hanzi} age={age} delay={4} glow={Math.max(glowOf(lit,subject.hanzi),glowOf(lit,together?.hanzi))}/>}
  {thing&&<Chip x={720} y={BASE+20} hanzi={thing.hanzi} age={age} delay={16} glow={glowOf(lit,thing.hanzi)}/>}
  {question&&<Chip x={subject?480:220} y={210} hanzi={question} age={age} delay={14} glow={glowOf(lit,question)} size={54}/>}
</>;};

/** The beat's own lesson art, framed and slowly pushed in: a safety net only — the render gate requires every slide's own meaning visual. */
export const ArtCard:React.FC<{src:string;age:number;top:number}>=({src,age,top})=>{
  const p=spring(age,1.8,.75), sweep=-30+160*easeInOut((age-6)/24);
  return <div style={{position:"absolute",left:(1080-820)/2,top,width:820,height:H-30,borderRadius:44,overflow:"hidden",opacity:clamp01(p*1.6),
    translate:`0 ${(1-Math.min(1,p))*40}px`,border:"2px solid rgba(255,255,255,.35)",boxShadow:"0 30px 70px rgba(0,0,0,.4)"}}>
    <Img src={src} style={{width:"100%",height:"100%",objectFit:"cover",scale:`${1.04+.06*easeOut(age/150)}`}}/>
    {age<34&&<div style={{position:"absolute",inset:-60,background:`linear-gradient(105deg, transparent ${sweep-12}%, rgba(255,255,255,.22) ${sweep}%, transparent ${sweep+12}%)`}}/>}
  </div>;
};

/** Dispatch one sentence meaning to its stage, positioned at `top` (frame px). */
export const MeaningStage:React.FC<{meaning:SentenceMeaning;age:number;lit:string|null;litAge:number;top:number;role?:string|null;
  lexicon:{comparisons?:Record<string,{unit?:string;more:number;less:number}>;times?:Record<string,string>}}>=({meaning,age,lit,litAge,top,role=null,lexicon})=>{
  const props={age,lit,litAge};
  let body:ReactNode=null;
  switch(meaning.pattern){
    case "comparison":body=<ComparisonStage m={meaning} age={age} role={role} roleAge={litAge}/>;break;
    case "location":body=<LocationStage m={meaning} {...props}/>;break;
    case "choice":body=<ChoiceStage m={meaning} {...props}/>;break;
    case "modal":body=<ModalStage m={meaning} {...props}/>;break;
    case "inclusion":body=<InclusionStage m={meaning} {...props}/>;break;
    case "degree":body=<DegreeStage m={meaning} lexicon={lexicon} {...props}/>;break;
    case "quantity":body=<QuantityStage m={meaning} {...props}/>;break;
    case "want":body=<WantStage m={meaning} {...props}/>;break;
    case "question":body=<ActionStage subject={meaning.subject} thing={meaning.object} question={meaning.word} {...props}/>;break;
    case "action":body=<ActionStage subject={meaning.subject} thing={meaning.action} time={meaning.time}
      timeIcon={meaning.time?lexicon.times?.[meaning.time]??null:null} negated={meaning.negated} done={meaning.done} together={meaning.together} {...props}/>;break;
  }
  return <div data-meaning-stage={meaning.pattern} style={{position:"absolute",left:(1080-W)/2,top,width:W,height:H}}>{body}</div>;
};
