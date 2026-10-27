import {AbsoluteFill, Easing, Img, interpolate, staticFile} from "remotion";
import visual from "../content/visual-system.json";

export type NarratedMotionBeat = {id:string;kind:string;cueText:string;cueOccurrence?:number;localFrame:number};
const C=visual.colors;
const L=visual.narratedMotionLayout;
const cream="#FFF5DF";
const ease={extrapolateLeft:"clamp" as const,extrapolateRight:"clamp" as const,easing:Easing.bezier(.18,.82,.2,1)};
const progress=(frame:number,start:number,duration=visual.motion.settleFrames)=>
  interpolate(frame,[start,start+duration],[0,1],ease);

const Book:React.FC<{x:number;y:number;scale?:number;rotate?:number;checked?:boolean}>=({x,y,scale=1,rotate=0,checked=false})=><g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
  <rect x="-56" y="-72" width="112" height="144" rx="12" fill={C.brandTeal}/>
  <path d="M-39 -70V69M-34 54H47" stroke="#E8F0D7" strokeWidth="6"/>
  <path d="M-18 -33H31M-18 -16H19" stroke={cream} strokeWidth="7" strokeLinecap="round"/>
  <path d="M-48 73H49" stroke="#B8C5AA" strokeWidth="8" strokeLinecap="round"/>
  {checked&&<g transform="translate(49 -64)"><circle r="31" fill={C.brandGold}/><path d="m-15 0 10 11 22-25" fill="none" stroke="#23352C" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/></g>}
</g>;

const Person:React.FC<{x:number;frame:number;seller?:boolean;retreat?:number;armX?:number;stop?:number}>=({x,frame,seller=false,retreat=0,armX,stop=0})=>{
  const bob=Math.sin(frame/30)*L.actorBobPx;
  const blink=frame%135<4;
  const jacket=seller?"#DAB993":C.brandRed;
  const headTurn=retreat*10;
  return <g transform={`translate(${x-retreat*80} ${bob})`}>
    <path d="M-57 272-47 345M38 272 54 345" stroke="#655769" strokeWidth="27" strokeLinecap="round"/>
    <path d="M-73 152Q-60 125-28 120H28Q61 129 74 153L64 287H-65Z" fill={jacket}/>
    {seller&&<path d="M-30 124V176H30V124M-48 178H48V278H-48Z" fill="#6B5260"/>}
    <path d={`M${seller?-62:62} 163Q${seller?-85:85} 201 ${(armX??(seller?-98:98))+(seller?0:-retreat*20)} ${stop>0?187:220}`} fill="none" stroke={jacket} strokeWidth="24" strokeLinecap="round"/>
    <circle cx={(armX??(seller?-98:98))+(seller?0:-retreat*20)} cy={stop>0?187:220} r="14" fill="#E9B08B"/>
    {stop>0&&<path d={`M${(armX??98)-13} 181v-27m10 25v-36m10 37v-32m9 33v-22`} stroke="#E9B08B" strokeWidth="8" strokeLinecap="round" opacity={stop}/>}
    <path d="M-63 162Q-97 198-81 237" fill="none" stroke={jacket} strokeWidth="24" strokeLinecap="round"/>
    <path d="M-17 127V100M17 127V100" stroke="#D89D7D" strokeWidth="18"/>
    <g transform={`translate(${-headTurn} 0) rotate(${-retreat*7} 0 72)`}>
      <ellipse cy="67" rx="45" ry="54" fill="#E9B08B"/>
      <path d="M-45 61Q-55 5 2 9Q53 11 45 57Q14 35-45 61Z" fill="#30232C"/>
      {blink?<path d="M-23 69h12m21 0h12" stroke="#35232C" strokeWidth="4" strokeLinecap="round"/>:<><circle cx="-16" cy="68" r="3.7" fill="#35232C"/><circle cx="17" cy="68" r="3.7" fill="#35232C"/></>}
      <path d={retreat>.4?"M-10 94h18":"M-11 92Q0 101 12 92"} fill="none" stroke="#895B50" strokeWidth="3.6" strokeLinecap="round"/>
    </g>
  </g>;
};

const ShopAction:React.FC<{frame:number;purchase:number;refusal:number;stop:number;completed?:boolean}>=({frame,purchase,refusal,stop,completed=false})=>{
  const bx=620-265*purchase;
  const buyerArm=98+purchase*34-stop*20;
  return <svg viewBox="0 0 880 380" width="100%" height="100%" aria-label={refusal>0?"Покупатель передумал покупать":purchase>0?"Покупатель получает книгу":"Покупатель и книга у продавца"}>
    <path d="M42 352H838" stroke={cream} strokeOpacity=".17" strokeWidth="3"/>
    <path d="M530 252H822M562 252V348M794 252V348" stroke="#AA8069" strokeWidth="17" strokeLinecap="round"/>
    <Person x={235} frame={frame} retreat={refusal} armX={buyerArm} stop={stop}/>
    <Person x={736} frame={frame+36} seller armX={-110+purchase*35}/>
    <Book x={bx} y={208-Math.sin(purchase*Math.PI)*23} rotate={-7+purchase*10} checked={completed}/>
    {refusal>0&&<g opacity={refusal} transform="translate(500 110)"><path d="M-44 1h75m-17-17L31 1 14 18" stroke={C.brandGold} strokeWidth="7" strokeLinecap="round" fill="none"/><path d="m-43-26 82 53" stroke={C.brandRed} strokeWidth="8" strokeLinecap="round"/></g>}
  </svg>;
};

const Check:React.FC<{scale?:number}>=({scale=1})=><g transform={`scale(${scale})`}><circle r="56" fill={C.brandTeal}/><path d="m-25 1 17 18 36-39" fill="none" stroke={cream} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round"/></g>;

const Glyphs:React.FC<{text:string;size:number;frame:number;entry:number;focus?:"particle"|"verb";focusProgress?:number}>=({text,size,frame,entry,focus,focusProgress=0})=><div style={{fontSize:size,fontWeight:900,lineHeight:1.18,whiteSpace:"nowrap",fontFamily:"'PingFang SC','Hiragino Sans GB',sans-serif"}}>
  {Array.from(text).map((character,index)=>{
    const p=progress(frame,entry+index*visual.motion.heroCharacterStaggerFrames);
    const target=focus==="verb"?character==="买":character==="了";
    return <span key={index} style={{display:"inline-block",color:character==="了"?C.brandGold:cream,
      opacity:.6+.4*p,translate:`0 ${(1-p)*visual.motion.slideDistancePx-(target?focusProgress*14:0)}px`,
      textShadow:target?`0 0 ${20*focusProgress}px ${C.brandGold}55`:undefined,
      borderBottom:target?`5px solid rgba(233,169,22,${focusProgress})`:"5px solid transparent"}}>{character}</span>;
  })}
</div>;

const phrases={
  completed:{hanzi:"我买了一本书。",pinyin:"Wǒ mǎi le yì běn shū.",meaning:"Я купил книгу."},
  change:{hanzi:"我不买了。",pinyin:"Wǒ bù mǎi le.",meaning:"Я передумал покупать."},
};

export const NarratedMotionScene:React.FC<{
  sceneId:string;frame:number;beats:NarratedMotionBeat[];
}>=({sceneId,frame,beats})=>{
  const elapsed=beats.filter(beat=>frame>=beat.localFrame);
  const active=elapsed[elapsed.length-1];
  const kind=active?.kind??(sceneId==="hook"?"question":sceneId==="change"?"intention":sceneId==="contrast"?"completed-reminder":"example");
  const start=active?.localFrame??0;
  const enter=progress(frame,start);
  const event=(name:string)=>beats.find(beat=>beat.kind===name);
  const p=(name:string,duration=visual.motion.settleFrames)=>{
    const beat=event(name);return beat?progress(frame,beat.localFrame,duration):0;
  };
  const pair=["takeaway","positions","meaning"].includes(kind);
  const recall=["recall","reconsider"].includes(kind)&&sceneId==="contrast";
  const finalAnswer=kind==="end-answer";
  const example=sceneId==="completed"||kind==="completed-reminder"||kind==="particle"&&sceneId==="contrast"?phrases.completed:phrases.change;
  const field=sceneId==="completed"?"#651C30":sceneId==="change"?"#10493E":sceneId==="contrast"?"#1C2032":"#191321";
  const particle=p("particle");
  const verb=p("verb-focus");
  const end=p("end-position");
  const headline=sceneId==="hook"?"了 — ЭТО ПРОШЕДШЕЕ ВРЕМЯ?":
    kind==="purchase"?"Я КУПИЛ КНИГУ":kind==="verb-focus"?"了 СТОИТ ПОСЛЕ ГЛАГОЛА":
    ["reconsider","changed-state","stop"].includes(kind)?"Я ПЕРЕДУМАЛ ПОКУПАТЬ":
    kind==="end-position"||finalAnswer?"了 — В КОНЦЕ ПРЕДЛОЖЕНИЯ":
    kind==="not-past"?"НЕ ТОЛЬКО ПРОШЕДШЕЕ":recall?"ПРОВЕРЬ СЕБЯ":
    pair?"ПОЗИЦИЯ + СМЫСЛ":sceneId==="completed"||kind==="completed-reminder"?"ДЕЙСТВИЕ ЗАВЕРШЕНО":"РЕШЕНИЕ ИЗМЕНИЛОСЬ";
  const purchase=sceneId==="completed"?p("purchase",L.actionFrames):kind==="completed-reminder"||kind==="particle"&&sceneId==="contrast"?1:0;
  const refusal=sceneId==="change"?p("reconsider",L.actionFrames):kind==="reconsider"?p("reconsider",L.actionFrames):finalAnswer?1:kind==="changed-reminder"?enter:0;
  const stopped=sceneId==="change"?p("stop"):refusal;
  const focus=kind==="verb-focus"?"verb":"particle";
  const focusProgress=sceneId==="completed"?Math.max(particle,verb):sceneId==="change"?end:finalAnswer?enter:kind==="particle"?enter:0;
  return <AbsoluteFill style={{overflow:"hidden",background:field,color:cream,
    fontFamily:"'Arial','PingFang SC',sans-serif"}}>
    <AbsoluteFill style={{background:`radial-gradient(ellipse at 50% 40%,${C.brandGold}0c,transparent 60%),linear-gradient(160deg,${field},#17131D)`,
      scale:interpolate(frame,[0,1500],[1,1.035],ease)}}/>
    <div style={{position:"absolute",inset:0,opacity:.055,backgroundImage:"linear-gradient(90deg,rgba(255,245,223,.35) 1px,transparent 1px)",backgroundSize:"120px 100%",translate:`${Math.sin(frame/90)*3}px 0`}}/>
    <div style={{position:"absolute",top:visual.motion.brandTopInsetPx,left:0,right:0,display:"flex",justifyContent:"center",alignItems:"center",gap:14,fontSize:30,fontWeight:900,letterSpacing:".04em"}}>
      <Img src={staticFile("branding/hsk-ai-logo-1024.png")} style={{width:42,height:42,borderRadius:12}}/>HSK <span style={{color:C.brandGold,marginLeft:-7}}>AI</span>
    </div>
    <div style={{position:"absolute",top:L.titleTopPx,left:90,right:90,fontSize:L.headlineFontPx,fontWeight:900,lineHeight:1.12,textAlign:"center",textWrap:"balance"}}>{headline}</div>
    {sceneId==="hook"?<>
      <div style={{position:"absolute",top:620,left:0,right:0,textAlign:"center",translate:`0 ${-p("two-meanings")*28}px`,scale:1-p("two-meanings")*.13}}>
        <Glyphs text="了" size={L.hookFontPx} frame={frame} entry={0} focus="particle" focusProgress={p("two-meanings")}/>
        <div style={{fontSize:56,color:C.brandGold,fontWeight:750}}>le</div>
      </div>
      <div style={{position:"absolute",top:1120,left:70,right:70,textAlign:"center",fontWeight:900,fontSize:54,
        opacity:.55+.45*p("two-meanings"),translate:`0 ${(1-p("two-meanings"))*18}px`}}>
        {kind==="question"?"ПРОШЕДШЕЕ ВРЕМЯ?":"НЕ ВСЕГДА"}
      </div>
      {kind!=="question"&&<div style={{position:"absolute",top:1210,left:85,right:85,display:"flex",justifyContent:"center",gap:35,fontSize:34,fontWeight:750,color:cream}}>
        <span>ДЕЙСТВИЕ ЗАВЕРШЕНО</span><span style={{color:C.brandGold}}>ИЛИ</span><span>СИТУАЦИЯ ИЗМЕНИЛАСЬ</span>
      </div>}
    </>:pair?<>
      <div style={{position:"absolute",top:655,left:110,right:110,display:"flex",justifyContent:"space-around",alignItems:"center",opacity:.75+.25*enter}}>
        <svg width="140" height="150" viewBox="0 0 180 180"><Book x={85} y={88} scale={.92} checked/></svg>
        <span style={{fontSize:60,color:C.brandGold}}>↔</span>
        <svg width="140" height="150" viewBox="0 0 180 180"><Book x={85} y={88} scale={.75}/><path d="m35 35 105 110" stroke={C.brandRed} strokeWidth="12" strokeLinecap="round"/></svg>
      </div>
      <div style={{position:"absolute",top:855,left:90,right:90,display:"flex",flexDirection:"column",gap:50,textAlign:"center"}}>
        {[{hanzi:"买了书",pinyin:"mǎi le shū",meaning:"КУПИЛ"},{hanzi:"不买了",pinyin:"bù mǎi le",meaning:"ПЕРЕДУМАЛ ПОКУПАТЬ"}].map((line,index)=><div key={line.hanzi} style={{opacity:.75+.25*progress(frame,start+index*6)}}>
          <Glyphs text={line.hanzi} size={105} frame={frame} entry={start+index*6} focus="particle" focusProgress={kind==="positions"?enter:1}/>
          <div style={{fontSize:42,color:C.brandGold,marginTop:4}}>{line.pinyin}</div>
          <div style={{fontSize:36,fontWeight:750,marginTop:6,opacity:kind==="meaning"?1:.8}}>{line.meaning}</div>
        </div>)}
      </div>
    </>:kind==="not-past"?<>
      <div style={{position:"absolute",top:670,left:180,right:180,textAlign:"center",scale:.95+.05*enter}}>
        <div style={{fontSize:230,fontWeight:950,color:C.brandGold}}>了</div>
        <div style={{fontSize:72,fontWeight:900}}>≠ ВСЕГДА</div>
        <div style={{fontSize:64,fontWeight:800,marginTop:35}}>ПРОШЕДШЕЕ ВРЕМЯ</div>
        <div style={{fontSize:42,marginTop:38,color:"#E7CDA9"}}>СМОТРИ НА КОНТЕКСТ</div>
      </div>
    </>:<>
      <div style={{position:"absolute",top:L.storyTopPx,left:90,right:90,height:L.storyHeightPx,
        translate:`${Math.sin(frame/65)*L.cameraDriftPx}px 0`}}>
        <ShopAction frame={frame} purchase={purchase} refusal={refusal} stop={stopped} completed={kind==="completed"||kind==="completed-reminder"}/>
        {kind==="completed"&&<svg width="96" height="96" viewBox="-70 -70 140 140" style={{position:"absolute",right:30,top:0,scale:enter}}><Check/></svg>}
      </div>
      <div style={{position:"absolute",top:L.heroTopPx,left:80,right:80,textAlign:"center"}}>
        {recall?<>
          <div style={{fontSize:49,fontWeight:800,marginBottom:26}}>«Я передумал покупать»</div>
          <Glyphs text="我不买□" size={L.phraseFontPx} frame={frame} entry={start}/>
          <div style={{fontSize:42,color:C.brandGold,marginTop:26}}>ГДЕ СТОИТ 了?</div>
        </>:<>
          <Glyphs text={example.hanzi} size={L.phraseFontPx} frame={frame} entry={active?.kind==="example"?start:0}
            focus={focus} focusProgress={focusProgress}/>
          <div style={{fontSize:L.pinyinFontPx,color:C.brandGold,fontWeight:750,marginTop:20}}>{example.pinyin}</div>
          <div style={{fontSize:L.meaningFontPx,fontWeight:700,marginTop:16}}>{example.meaning}</div>
          {kind==="verb-focus"&&<div style={{fontSize:36,fontWeight:800,color:C.brandGold,marginTop:24,opacity:enter}}>买 — ГЛАГОЛ · 了 — ПОСЛЕ НЕГО</div>}
          {(kind==="end-position"||finalAnswer)&&<div style={{fontSize:36,fontWeight:800,color:C.brandGold,marginTop:24,opacity:enter}}>了 В КОНЦЕ → РЕШЕНИЕ ИЗМЕНИЛОСЬ</div>}
        </>}
      </div>
    </>}
  </AbsoluteFill>;
};
