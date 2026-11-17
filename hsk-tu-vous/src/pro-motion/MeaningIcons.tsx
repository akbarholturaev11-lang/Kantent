import type {ReactNode} from "react";
import visual from "../../content/visual-system.json";
import {bell, springProgress} from "../../scripts/pro-motion-plan.mjs";
import {MEANING_ICON_KINDS} from "../../scripts/meaning-visual-plan.mjs";
import {clamp01, easeInOut, easeOut} from "./SceneTransitions";

/**
 * Animated meaning icons (content/meaning-visuals.json → `icons`/`objects`):
 * original line drawings on a 100×100 grid, each with its own small motion
 * (steam rises, wheels turn, a book opens, a needle sweeps). Driven only by
 * `age`, the frames since the icon appeared.
 */
const C=visual.colors, FPS=30;
export const GOLD=C.brandGold, ICE="#6CC8FF", WARM="#FF8A4C", GREEN="#3DDC97", RED="#FF4A3D";
const S={fill:"none",strokeWidth:4.5,strokeLinecap:"round" as const,strokeLinejoin:"round" as const};

/** Icons this library can draw; the lexicon may only name these (tested). */
export const ICON_KINDS=MEANING_ICON_KINDS;
type IconKind=(typeof MEANING_ICON_KINDS)[number];

export const MeaningIcon:React.FC<{kind:string;age:number;size:number;tint?:string}>=({kind,age,size,tint})=>{
  const ink=tint??"#FFFFFF";
  const line={...S,stroke:ink};
  const gold={...S,stroke:GOLD};
  const draw=(delay:number,frames=14)=>({pathLength:1,strokeDasharray:1,strokeDashoffset:1-easeInOut((age-delay)/frames)});
  const pop=(delay:number,hz=2.6,damping=.55)=>Math.max(0,springProgress(age-delay,FPS,{naturalHz:hz,dampingRatio:damping}));
  const grow=easeOut((age-2)/22);
  const loop=(period:number,offset=0)=>((age+offset)%period)/period;
  const steam=(x:number,y:number,n=3)=>Array.from({length:n},(_,k)=>{
    const t=loop(36,k*12);
    return <path key={"st"+k} d={`M${x+k*10} ${y} q-5 -6 0 -12 q5 -6 0 -12`} {...line} strokeWidth={3}
      opacity={Math.sin(Math.PI*t)*.8} transform={`translate(0 ${-t*10})`}/>;});
  const icons:Record<IconKind,()=>ReactNode>={
    compare:()=>{const a=62*grow,b=36*grow,gap=easeInOut((age-22)/10);return <>
      <line x1={10} x2={90} y1={88} y2={88} {...line} {...draw(0,8)}/>
      <rect x={20} y={86-a} width={22} height={a} rx={5} fill={GOLD}/>
      <rect x={58} y={86-b} width={22} height={b} rx={5} fill="rgba(255,255,255,.75)"/>
      <g opacity={gap}><line x1={50} x2={50} y1={50} y2={50-26*gap} stroke={GOLD} strokeWidth={4} strokeLinecap="round"/>
        <path d="M45 30 L50 24 L55 30" {...gold} opacity={gap>=1?1:0}/></g></>;},
    intensity:()=>{const p=easeOut((age-4)/24),angle=-90+153*p+3*Math.sin(age/5)*p;return <>
      <path d="M14 74 A36 36 0 0 1 86 74" {...line} stroke="rgba(255,255,255,.3)" strokeWidth={9}/>
      <path d="M14 74 A36 36 0 0 1 86 74" {...S} stroke={tint??GOLD} strokeWidth={9} pathLength={1} strokeDasharray={1} strokeDashoffset={1-.85*p}/>
      <g transform={`rotate(${angle} 50 74)`}><line x1={50} y1={74} x2={50} y2={44} {...line} strokeWidth={5}/></g>
      <circle cx={50} cy={74} r={6} fill={ink}/></>;},
    height:()=>{const h=64*grow,hop=-4*bell(age-26,12);return <>
      <line x1={22} x2={22} y1={90} y2={18} {...line} {...draw(0,12)}/>
      {[0,1,2,3,4,5].map(k=><line key={k} x1={22} x2={k%2?30:34} y1={88-k*13} y2={88-k*13} {...line} strokeWidth={3} opacity={clamp01((age-k*2)/6)}/>)}
      <rect x={46} y={90-h} width={30} height={h} rx={6} fill={GOLD}/>
      <path d={`M51 ${80-h+hop} L61 ${70-h+hop} L71 ${80-h+hop}`} {...line} opacity={clamp01((age-24)/6)}/></>;},
    cold:()=>thermometer(true),
    hot:()=>thermometer(false),
    day:()=>{const flip=easeInOut((age-8)/14);return <>
      <rect x={18} y={20} width={64} height={66} rx={10} {...line}/>
      <rect x={18} y={20} width={64} height={16} rx={8} fill={C.brandRed}/>
      <line x1={34} x2={34} y1={12} y2={26} {...line}/><line x1={66} x2={66} y1={12} y2={26} {...line}/>
      {[0,1,2].map(r=>[0,1,2,3].map(c=><rect key={r+"-"+c} x={26+c*13} y={44+r*13} width={8} height={8} rx={2}
        fill={r===1&&c===2?GOLD:"rgba(255,255,255,.55)"} opacity={clamp01((age-r*3-c)/6)}/>))}
      <rect x={18} y={36} width={64} height={50*(1-flip)} rx={6} fill="rgba(255,255,255,.22)"/></>;},
    count:()=><>{Array.from({length:9},(_,k)=>{const p=pop(k*3,2.8);
      return <circle key={k} cx={26+(k%3)*24} cy={26+Math.floor(k/3)*24} r={9*Math.min(1.1,p)} fill={k<6?GOLD:"rgba(255,255,255,.7)"}/>;})}</>,
    size:()=>{const p=pop(2,2,.6);return <><circle cx={36} cy={58} r={26*p} fill={GOLD}/><circle cx={80} cy={72} r={12*p} fill="rgba(255,255,255,.75)"/></>;},
    speed:()=><>{[0,1,2].map(k=><line key={k} x1={8+((age*3+k*10)%20)} x2={40+((age*3+k*10)%20)} y1={36+k*14} y2={36+k*14} {...line} strokeWidth={4} opacity={.35+.25*k}/>)}
      <path d="M54 30 L86 50 L54 70 Z" fill={GOLD}/></>,
    choice:()=>{const swing=Math.sin(age/9);return <>
      <path d="M50 92 L50 56" {...line} {...draw(0,8)}/>
      <path d="M50 56 Q50 40 26 30" {...line} {...draw(6,10)}/><path d="M50 56 Q50 40 74 30" {...line} {...draw(6,10)}/>
      <path d="M18 34 L26 30 L24 39" {...line} opacity={clamp01((age-14)/4)}/><path d="M82 34 L74 30 L76 39" {...line} opacity={clamp01((age-14)/4)}/>
      <circle cx={50+swing*22} cy={44-Math.abs(swing)*8} r={7} fill={GOLD} opacity={clamp01((age-16)/6)}/></>;},
    also:()=>{const p=pop(10);return <>
      <circle cx={30} cy={56} r={18} {...line}/><circle cx={70} cy={56} r={18} {...line} opacity={clamp01((age-4)/6)}/>
      <path d="M30 28 v-12 M24 22 h12" {...gold}/>
      <g transform={`translate(70 22) scale(${Math.min(1.1,p)})`}><path d="M0 6 v-12 M-6 0 h12" {...gold}/></g>
      <path d="M38 22 Q50 10 60 20" {...line} strokeWidth={3} strokeDasharray="4 6" opacity={clamp01((age-6)/6)}/></>;},
    all:()=><>{[0,1,2].map(k=>{const p=pop(k*4);return <circle key={k} cx={22+k*28} cy={66} r={12*Math.min(1.1,p)} fill={k===1?GOLD:"rgba(255,255,255,.8)"}/>;})}
      <path d="M10 44 V34 H90 V44" {...gold} {...draw(12,14)}/></>,
    and:()=>{const p=easeOut((age-2)/16);return <><circle cx={50-18*p} cy={50} r={20} {...line}/><circle cx={50+18*p} cy={50} r={20} {...gold}/></>;},
    no:()=><><circle cx={50} cy={50} r={34} {...S} stroke={RED} strokeWidth={8} {...draw(0,14)}/>
      <line x1={27} y1={27} x2={73} y2={73} {...S} stroke={RED} strokeWidth={8} {...draw(12,8)}/></>,
    skill:()=>{const p=pop(2);return <>
      <g transform={`translate(50 40) scale(${Math.min(1.08,p)}) translate(-50 -40)`}>
        <path d="M14 38 L50 22 L86 38 L50 54 Z" fill={GOLD}/><path d="M28 46 V62 Q50 74 72 62 V46" {...line}/></g>
      <path d="M58 80 L66 88 L84 70" {...S} stroke={GREEN} strokeWidth={6} {...draw(16,10)}/></>;},
    can:()=><><circle cx={50} cy={50} r={34} {...S} stroke={GREEN} strokeWidth={6} {...draw(0,12)}/>
      <path d="M34 51 L46 63 L68 39" {...S} stroke={GREEN} strokeWidth={7} {...draw(10,10)}/></>,
    question:()=>{const b=-6*Math.abs(Math.sin(age/8));return <g transform={`translate(0 ${b})`}>
      <path d="M34 34 Q34 16 50 16 Q68 16 68 32 Q68 44 52 50 L50 62" {...S} stroke={GOLD} strokeWidth={9} {...draw(0,16)}/>
      <circle cx={50} cy={80} r={6} fill={GOLD} opacity={clamp01((age-14)/4)}/></g>;},
    where:()=>{const d=pop(0,2.2,.5);return <>
      <g transform={`translate(0 ${(1-Math.min(1,d))*-30})`}><path d="M50 86 C32 62 24 52 24 38 A26 26 0 0 1 76 38 C76 52 68 62 50 86 Z" fill={GOLD}/>
        <text x={50} y={48} textAnchor="middle" fontSize={30} fontWeight={900} fill="#1A1A1A">?</text></g></>;},
    number:()=>{const n=Math.floor(age/3)%9+1;return <>
      <rect x={20} y={18} width={60} height={64} rx={14} {...line}/>
      <text x={50} y={66} textAnchor="middle" fontSize={44} fontWeight={900} fill={GOLD}>{age<36?n:"?"}</text></>;},
    price:()=>{const r=8*Math.sin(age/10)*Math.exp(-age/60);return <g transform={`rotate(${r} 50 14)`}>
      <line x1={50} y1={8} x2={50} y2={24} {...line} strokeWidth={3}/>
      <path d="M30 24 H70 L82 50 L70 88 H30 L18 50 Z" fill={GOLD}/>
      <circle cx={50} cy={36} r={4} fill="#1A1A1A"/>
      <text x={50} y={72} textAnchor="middle" fontSize={30} fontWeight={900} fill="#1A1A1A">¥</text></g>;},
    done:()=>{const p=easeInOut((age-2)/20);return <>
      <circle cx={50} cy={50} r={34} {...line} stroke="rgba(255,255,255,.3)" strokeWidth={8}/>
      <circle cx={50} cy={50} r={34} {...S} stroke={GOLD} strokeWidth={8} pathLength={1} strokeDasharray={1} strokeDashoffset={1-p} transform="rotate(-90 50 50)"/>
      <path d="M36 51 L46 61 L66 41" {...S} stroke={GOLD} strokeWidth={7} {...draw(20,8)}/></>;},
    pin:()=>{const d=pop(0,2.2,.45),ring=loop(40);return <>
      <ellipse cx={50} cy={88} rx={10+24*ring} ry={3+7*ring} {...gold} strokeWidth={3} opacity={(1-ring)*clamp01((age-10)/6)}/>
      <g transform={`translate(0 ${(1-Math.min(1,d))*-40})`}><path d="M50 86 C32 62 24 52 24 38 A26 26 0 0 1 76 38 C76 52 68 62 50 86 Z" fill={GOLD}/>
        <circle cx={50} cy={38} r={10} fill="#1A1A1A"/></g></>;},
    have:()=>{const lid=easeOut((age-6)/12);return <>
      <rect x={22} y={46} width={56} height={40} rx={6} {...line}/>
      <g transform={`rotate(${-28*lid} 22 46)`}><rect x={18} y={36} width={64} height={10} rx={4} fill={GOLD}/></g>
      {[0,1,2].map(k=><path key={k} d={`M${36+k*14} ${30-(k%2)*8} l0 -8 M${32+k*14} ${26-(k%2)*8} l8 0`} {...gold} strokeWidth={3}
        opacity={lid*(.5+.5*Math.sin((age+k*7)/5))}/>)}</>;},
    check:()=><path d="M24 52 L42 70 L78 32" {...S} stroke={GREEN} strokeWidth={9} {...draw(0,12)}/>,
    near:()=>{const p=pop(0);return <><path d="M14 86 L50 30 L86 86" {...line} strokeWidth={3} opacity={.5}/>
      <circle cx={50} cy={72} r={14*Math.min(1.1,p)} fill={GOLD}/><path d="M50 20 V44 M42 36 L50 44 L58 36" {...line} opacity={clamp01((age-8)/6)}/></>;},
    far:()=>{const p=pop(0);return <><path d="M14 86 L50 30 L86 86" {...line} strokeWidth={3} opacity={.5}/>
      <circle cx={50} cy={38} r={6*Math.min(1.1,p)} fill={GOLD}/><path d="M50 92 V64 M42 72 L50 64 L58 72" {...line} opacity={clamp01((age-8)/6)}/></>;},
    think:()=><>{[[26,82,5],[36,70,8]].map(([x,y,r],k)=><circle key={k} cx={x} cy={y} r={r*Math.min(1.1,pop(k*4))} {...line}/>)}
      <path d="M40 54 Q28 54 30 40 Q26 24 44 22 Q52 10 66 18 Q84 16 82 34 Q90 48 74 54 Z" {...line} {...draw(8,14)}/></>,
    want:()=>{const hit=easeOut((age-10)/8);return <>
      {[30,20,10].map((r,k)=><circle key={k} cx={58} cy={46} r={r} {...(k===2?gold:line)} strokeWidth={4} opacity={clamp01((age-k*3)/6)}/>)}
      <path d={`M${14+30*hit} ${80-24*hit} L${36+22*hit} ${62-16*hit}`} {...gold} strokeWidth={6}/></>;},
    heart:()=>{const beat=1+.12*bell(age%26,10);return <g transform={`translate(50 52) scale(${beat*Math.min(1,pop(0))}) translate(-50 -52)`}>
      <path d="M50 84 C20 62 14 46 18 34 C22 20 42 16 50 32 C58 16 78 20 82 34 C86 46 80 62 50 84 Z" fill={C.brandRed}/></g>;},
    on:()=>position(0),
    under:()=>position(1),
    in:()=>position(2),
    beside:()=>position(3),
    clock:()=><><circle cx={50} cy={50} r={36} {...line}/>
      {Array.from({length:12},(_,k)=><line key={k} x1={50} y1={18} x2={50} y2={k%3?21:24} {...line} strokeWidth={3} transform={`rotate(${k*30} 50 50)`}/>)}
      <line x1={50} y1={50} x2={50} y2={30} {...line} strokeWidth={5} transform={`rotate(${age*.5} 50 50)`}/>
      <line x1={50} y1={50} x2={50} y2={22} {...gold} strokeWidth={4} transform={`rotate(${age*6} 50 50)`}/></>,
    book:()=>{const open=easeOut((age-2)/16);return <>
      <path d={`M50 30 L${50-36*open} ${26+4*(1-open)} L${50-36*open} ${80} L50 84 Z`} fill="rgba(255,255,255,.9)"/>
      <path d={`M50 30 L${50+36*open} ${26+4*(1-open)} L${50+36*open} ${80} L50 84 Z`} fill="rgba(255,255,255,.75)"/>
      <line x1={50} y1={30} x2={50} y2={84} stroke={GOLD} strokeWidth={4}/>
      {[0,1,2].map(k=><line key={k} x1={50-30*open} x2={50-10*open} y1={42+k*10} y2={42+k*10} stroke="#9AA0A6" strokeWidth={2.5} opacity={open}/>)}</>;},
    table:()=><><rect x={10} y={40} width={80} height={10} rx={4} fill={GOLD}/>
      <line x1={18} y1={50} x2={18} y2={88} {...line} {...draw(6,10)}/><line x1={82} y1={50} x2={82} y2={88} {...line} {...draw(6,10)}/></>,
    chair:()=><><path d="M30 16 V56 H70 V88 M30 56 V88" {...line} {...draw(0,16)}/><line x1={30} y1={56} x2={70} y2={56} {...gold} strokeWidth={7}/></>,
    cup:()=><><path d="M24 40 H70 V70 Q70 86 54 86 H40 Q24 86 24 70 Z" fill="rgba(255,255,255,.88)"/>
      <path d="M70 48 Q86 48 84 62 Q82 72 70 72" {...line}/>{steam(36,32)}</>,
    tea:()=><><path d="M20 46 H74 Q72 84 47 84 Q22 84 20 46 Z" fill="rgba(255,255,255,.9)"/><ellipse cx={47} cy={46} rx={27} ry={6} fill="#8BC34A"/>
      <path d="M58 30 Q70 22 74 32 Q66 38 58 30 Z" fill="#8BC34A"/>{steam(34,36)}</>,
    coffee:()=><><path d="M24 40 H70 V72 Q70 86 54 86 H40 Q24 86 24 72 Z" fill="#C8A27A"/><ellipse cx={47} cy={40} rx={23} ry={5} fill="#5B3A22"/>
      <path d="M70 48 Q86 48 84 62 Q82 72 70 72" {...S} stroke="#C8A27A"/>{steam(36,32)}</>,
    water:()=>{const t=loop(40),y=12+60*Math.min(1,t*1.6),splash=Math.max(0,t*1.6-1)/.6;return <>
      <path d={`M50 ${y-14} Q60 ${y} 50 ${y+8} Q40 ${y} 50 ${y-14} Z`} fill={ICE} opacity={t<.62?1:0}/>
      <ellipse cx={50} cy={82} rx={10+26*splash} ry={3+6*splash} {...S} stroke={ICE} strokeWidth={3} opacity={splash>0?1-splash:0}/>
      <path d="M14 82 H86" {...S} stroke="rgba(108,200,255,.5)" strokeWidth={3}/></>;},
    bowl:()=><><path d="M14 50 H86 Q84 84 50 84 Q16 84 14 50 Z" fill="rgba(255,255,255,.9)"/>
      <line x1={58} y1={44} x2={86} y2={14} {...gold} strokeWidth={4}/><line x1={66} y1={46} x2={92} y2={20} {...gold} strokeWidth={4}/>{steam(30,40)}</>,
    apple:()=>{const b=-8*Math.abs(Math.sin(age/7))*Math.exp(-age/50);return <g transform={`translate(0 ${b})`}>
      <path d="M50 34 C30 20 12 34 16 56 C20 80 40 90 50 82 C60 90 80 80 84 56 C88 34 70 20 50 34 Z" fill={C.brandRed}/>
      <path d="M50 34 Q50 20 56 14" {...line} strokeWidth={4}/><path d="M56 20 Q68 10 74 20 Q64 26 56 20 Z" fill="#8BC34A"/></g>;},
    coin:()=>{const w=Math.abs(Math.cos(age/8));return <><ellipse cx={50} cy={50} rx={34*Math.max(.12,w)} ry={34} fill={GOLD}/>
      <text x={50} y={62} textAnchor="middle" fontSize={34} fontWeight={900} fill="#5A3B00" opacity={w>.5?1:0}>¥</text></>;},
    bag:()=>{const r=5*Math.sin(age/9);return <g transform={`rotate(${r} 50 20)`}><path d="M22 36 H78 L84 88 H16 Z" fill={GOLD}/>
      <path d="M36 36 V26 Q36 14 50 14 Q64 14 64 26 V36" {...line}/></g>;},
    phone:()=><><rect x={30} y={10} width={40} height={80} rx={8} {...line}/>
      <rect x={35} y={18} width={30} height={58} rx={3} fill={GOLD} opacity={.35+.35*Math.abs(Math.sin(age/10))}/>
      <circle cx={68} cy={14} r={7*Math.min(1.1,pop(10))} fill={C.brandRed}/></>,
    laptop:()=><><rect x={22} y={22} width={56} height={40} rx={4} {...line}/><path d="M12 72 H88 L82 80 H18 Z" fill="rgba(255,255,255,.85)"/>
      <rect x={30} y={34} width={4} height={14} fill={GOLD} opacity={Math.floor(age/10)%2?1:0}/></>,
    house:()=>{const door=easeOut((age-10)/12);return <><path d="M14 48 L50 16 L86 48" {...gold} strokeWidth={6} {...draw(0,12)}/>
      <rect x={24} y={46} width={52} height={40} rx={4} {...line}/><rect x={44} y={62} width={14*(1-door*.7)} height={24} fill={GOLD}/>
      <rect x={44} y={62} width={14} height={24} fill="rgba(255,214,120,.35)" opacity={door}/></>;},
    school:()=><><rect x={18} y={42} width={64} height={44} rx={3} {...line}/><path d="M12 44 L50 24 L88 44" {...line}/>
      <line x1={50} y1={24} x2={50} y2={6} {...line} strokeWidth={3}/>
      <path d={`M50 6 Q${58} ${8+3*Math.sin(age/5)} 66 ${8} L66 16 Q58 ${18+3*Math.sin(age/5+1)} 50 16 Z`} fill={C.brandRed}/>
      <rect x={44} y={66} width={12} height={20} fill={GOLD}/></>,
    student:()=>{const swing=12*Math.sin(age/8);return <><path d="M10 40 L50 22 L90 40 L50 58 Z" fill={GOLD}/>
      <path d="M26 48 V64 Q50 78 74 64 V48" {...line}/>
      <g transform={`rotate(${swing} 82 40)`}><line x1={82} y1={40} x2={82} y2={66} {...line} strokeWidth={3}/><circle cx={82} cy={68} r={4} fill={ink}/></g></>;},
    board:()=><><rect x={12} y={18} width={76} height={52} rx={4} fill="#1F5C45" stroke={ink} strokeWidth={4}/>
      <path d="M22 36 H52 M22 50 H70" {...line} strokeWidth={3} {...draw(4,18)}/><line x1={30} y1={70} x2={24} y2={88} {...line}/><line x1={70} y1={70} x2={76} y2={88} {...line}/></>,
    medic:()=>{const p=1+.1*bell(age%30,12);return <g transform={`translate(50 50) scale(${p}) translate(-50 -50)`}>
      <path d="M40 16 H60 V40 H84 V60 H60 V84 H40 V60 H16 V40 H40 Z" fill={C.brandRed}/></g>;},
    car:()=>{const x=-4*Math.sin(age/6);return <g transform={`translate(${x} 0)`}>
      <path d="M10 64 V52 Q12 46 20 44 L32 30 H64 L78 44 Q88 46 90 54 V64 Z" fill={GOLD}/>
      {[30,72].map(cx=><g key={cx} transform={`rotate(${age*12} ${cx} 66)`}><circle cx={cx} cy={66} r={10} fill="#1A1A1A" stroke={ink} strokeWidth={3}/>
        <line x1={cx} y1={58} x2={cx} y2={74} stroke={ink} strokeWidth={2}/></g>)}
      {[0,1].map(k=><line key={k} x1={-6} x2={6} y1={48+k*10} y2={48+k*10} {...line} strokeWidth={3} opacity={.5}/>)}</g>;},
    plane:()=>{const t=loop(60),x=-20+130*t;return <g transform={`translate(${x-50} ${10-20*t})`}>
      <path d="M20 54 L80 44 Q90 44 90 50 Q90 56 80 56 L20 50 Z M48 48 L36 24 H44 L62 46 M48 54 L38 72 H46 L62 54" fill={ink}/>
      <line x1={-30} x2={14} y1={52} y2={52} {...gold} strokeWidth={3} opacity={.7}/></g>;},
    cat:()=>animal(true),
    dog:()=>animal(false),
    rain:()=><><path d="M24 50 Q10 50 12 38 Q14 26 28 28 Q32 14 50 16 Q68 14 72 28 Q90 28 88 42 Q86 52 72 50 Z" fill="rgba(255,255,255,.88)"/>
      {[0,1,2,3].map(k=>{const t=loop(24,k*6);return <line key={k} x1={28+k*14} x2={24+k*14} y1={58+t*30} y2={66+t*30} {...S} stroke={ICE} strokeWidth={4} opacity={1-t}/>;})}</>,
    sun:()=><g transform={`rotate(${age*1.5} 50 50)`}>{Array.from({length:8},(_,k)=><line key={k} x1={50} y1={8} x2={50} y2={20} {...S} stroke={GOLD} strokeWidth={5} transform={`rotate(${k*45} 50 50)`}/>)}
      <circle cx={50} cy={50} r={20} fill={GOLD}/></g>,
    swim:()=><>{[0,1].map(k=><path key={k} d={`M${-20+((age*1.5+k*20)%40)} ${66+k*14} q10 -8 20 0 t20 0 t20 0 t20 0 t20 0`} {...S} stroke={ICE} strokeWidth={4}/>)}
      <circle cx={46} cy={50+3*Math.sin(age/6)} r={9} fill={GOLD}/>
      <path d={`M56 ${56} Q${70} ${36+10*Math.sin(age/6)} ${80} ${54}`} {...line} strokeWidth={5}/></>,
    eye:()=>{const blink=1-bell(age%50,6)*.9;return <><path d={`M10 50 Q50 ${50-30*blink} 90 50 Q50 ${50+30*blink} 10 50 Z`} {...line}/>
      <circle cx={50} cy={50} r={12*blink} fill={GOLD}/></>;},
    pencil:()=>{const p=easeInOut(loop(48)*1.4);return <><path d={`M14 78 H${14+64*p}`} {...gold} strokeWidth={4}/>
      <g transform={`translate(${64*p} 0)`}><path d="M10 74 L18 78 L66 30 L58 22 Z" fill="rgba(255,255,255,.9)"/><path d="M10 74 L14 70 L18 78 Z" fill={GOLD}/></g></>;},
    speech:()=><><path d="M14 22 H86 Q90 22 90 28 V62 Q90 68 84 68 H40 L24 84 V68 H16 Q10 68 10 62 V28 Q10 22 14 22 Z" {...line}/>
      {[0,1,2].map(k=><circle key={k} cx={34+k*16} cy={45-4*bell((age+k*-5)%24,10)} r={5} fill={GOLD}/>)}</>,
    go:()=>{const x=(loop(30)*24)-6;return <g transform={`translate(${x} 0)`}><path d="M14 50 H70 M54 32 L72 50 L54 68" {...gold} strokeWidth={8}/></g>;},
    come:()=>{const x=-(loop(30)*24)+6;return <g transform={`translate(${x} 0)`}><path d="M86 50 H30 M46 32 L28 50 L46 68" {...gold} strokeWidth={8}/></g>;},
    cart:()=><><path d="M8 20 H22 L32 62 H78 L86 32 H26" {...line}/>
      {[38,72].map(cx=><circle key={cx} cx={cx} cy={76} r={7} fill={GOLD} transform={`rotate(${age*8} ${cx} 76)`}/>)}
      <rect x={40} y={34+Math.max(0,12-age)} width={14} height={16} rx={2} fill={GOLD} opacity={clamp01(age/8)}/></>,
    sleep:()=><>{[0,1,2].map(k=>{const t=loop(45,k*15);return <text key={k} x={30+k*16+t*10} y={80-t*50} fontSize={18+k*6} fontWeight={900}
      fill={k===2?GOLD:ink} opacity={Math.sin(Math.PI*t)}>Z</text>;})}</>,
    work:()=><><rect x={14} y={34} width={72} height={48} rx={6} fill={GOLD}/><path d="M38 34 V26 Q38 22 42 22 H58 Q62 22 62 26 V34" {...line}/>
      <line x1={14} y1={52} x2={86} y2={52} stroke="#5A3B00" strokeWidth={3}/></>,
    ear:()=><><path d="M34 70 Q20 56 22 40 Q26 18 48 18 Q68 20 68 40 Q68 54 56 60 Q50 64 50 74 Q48 84 38 80" {...line}/>
      {[0,1].map(k=>{const t=loop(30,k*15);return <path key={k} d={`M${76+t*10} 30 Q${86+t*14} 44 ${76+t*10} 58`} {...gold} strokeWidth={3} opacity={1-t}/>;})}</>,
    music:()=><>{[0,1].map(k=>{const b=-6*Math.abs(Math.sin((age+k*8)/7));return <g key={k} transform={`translate(${k*30} ${b})`}>
      <circle cx={30} cy={70} r={9} fill={k?GOLD:ink}/><line x1={38} y1={70} x2={38} y2={26} stroke={k?GOLD:ink} strokeWidth={4}/>
      <path d="M38 26 Q50 30 52 40" {...S} stroke={k?GOLD:ink} strokeWidth={4}/></g>;})}</>,
    shirt:()=>{const p=pop(0,2.2,.6),sway=3*Math.sin(age/10);return <g transform={`rotate(${sway} 50 14) ${scaleAt(p,50,50)}`}>
      <path d="M34 14 L14 26 L21 46 L30 42 V88 H70 V42 L79 46 L86 26 L66 14 Q58 25 50 25 Q42 25 34 14 Z" fill={GOLD}/>
      <path d="M40 15 Q50 28 60 15" {...line} strokeWidth={3}/><line x1={50} y1={34} x2={50} y2={80} stroke="#5A3B00" strokeWidth={2.5} strokeDasharray="2 8"/></g>;},
    shoe:()=>{const b=-6*Math.abs(Math.sin(age/8));return <g transform={`translate(0 ${b})`}>
      <path d="M12 72 V50 Q12 44 18 44 H38 L50 56 Q70 58 82 62 Q90 65 90 72 V76 H12 Z" fill="rgba(255,255,255,.9)"/>
      <line x1={10} x2={92} y1={80} y2={80} {...gold} strokeWidth={7}/>{[0,1,2].map(k=><line key={k} x1={36+k*7} y1={50+k*2} x2={44+k*7} y2={48+k*2} stroke="#1A1A1A" strokeWidth={2.5}/>)}</g>;},
    train:()=>{const off=(age*2.4)%24;return <>
      <rect x={16} y={18} width={68} height={56} rx={16} fill={GOLD}/>
      <rect x={24} y={28} width={22} height={18} rx={4} fill="rgba(255,255,255,.92)"/><rect x={54} y={28} width={22} height={18} rx={4} fill="rgba(255,255,255,.92)"/>
      <circle cx={30} cy={62} r={4} fill="#FFF7D6"/><circle cx={70} cy={62} r={4} fill="#FFF7D6"/>
      {Array.from({length:6},(_,k)=>{const x=((k*24-off)%144+144)%144-22;return <line key={k} x1={x} x2={x+12} y1={88} y2={88} {...line} strokeWidth={4}/>;})}
      <path d="M26 74 L18 84 M74 74 L82 84" {...line} strokeWidth={4}/></>;},
    bus:()=>{const x=-3*Math.sin(age/6);return <g transform={`translate(${x} 0)`}>
      <rect x={10} y={22} width={80} height={48} rx={10} fill={GOLD}/>
      {[0,1,2].map(k=><rect key={k} x={18+k*20} y={30} width={14} height={14} rx={3} fill="rgba(255,255,255,.92)"/>)}<rect x={76} y={30} width={10} height={28} rx={3} fill="rgba(255,255,255,.92)"/>
      {[28,70].map(cx=><g key={cx} transform={`rotate(${age*12} ${cx} 72)`}><circle cx={cx} cy={72} r={9} fill="#1A1A1A" stroke={ink} strokeWidth={3}/>
        <line x1={cx} y1={65} x2={cx} y2={79} stroke={ink} strokeWidth={2}/></g>)}</g>;},
    bike:()=><>{[26,74].map(cx=><g key={cx} transform={`rotate(${age*9} ${cx} 66)`}><circle cx={cx} cy={66} r={18} {...line}/>
        {[0,60,120].map(r=><line key={r} x1={cx} y1={50} x2={cx} y2={82} stroke={ink} strokeWidth={1.6} transform={`rotate(${r} ${cx} 66)`}/>)}</g>)}
      <path d="M26 66 L42 40 H66 L74 66 M42 40 L52 66 L66 40 M40 32 H48 M66 40 L62 28 H72" {...gold} strokeWidth={4.5}/></>,
    shop:()=>{const door=easeOut((age-10)/12);return <>
      <rect x={18} y={44} width={64} height={44} rx={3} {...line}/>
      {Array.from({length:5},(_,k)=><path key={k} d={`M${14+k*14.4} 30 H${28.4+k*14.4} V44 Q${21.2+k*14.4} 52 ${14+k*14.4} 44 Z`}
        fill={k%2?"rgba(255,255,255,.9)":GOLD} opacity={clamp01(pop(k*2)*2)}/>)}
      <rect x={42} y={60} width={16*(1-.7*door)} height={28} fill={GOLD} opacity={.85}/><rect x={24} y={56} width={12} height={12} rx={2} {...line} strokeWidth={3}/></>;},
    ticket:()=>{const st=pop(14,2.6,.45);return <g transform={`rotate(-8 50 50)`}>
      <path d="M12 30 H88 V44 Q80 50 88 56 V70 H12 V56 Q20 50 12 44 Z" fill="rgba(255,255,255,.9)"/>
      <line x1={64} y1={32} x2={64} y2={68} stroke="#1A1A1A" strokeWidth={2.5} strokeDasharray="3 5"/>
      <line x1={22} y1={42} x2={52} y2={42} stroke="#1A1A1A" strokeWidth={3}/><line x1={22} y1={54} x2={44} y2={54} stroke="#1A1A1A" strokeWidth={3}/>
      <circle cx={76} cy={50} r={10*Math.min(1.15,st)} {...gold} strokeWidth={4} opacity={clamp01(st*2)}/></g>;},
    fish:()=>{const x=6*Math.sin(age/10),tail=10*Math.sin(age/4);return <><g transform={`translate(${x} 0)`}>
      <path d="M18 50 Q40 26 66 50 Q40 74 18 50 Z" fill={GOLD}/><path d={`M64 50 L84 ${38+tail*.3} L84 ${62-tail*.3} Z`} fill={GOLD}/>
      <circle cx={30} cy={47} r={3.5} fill="#1A1A1A"/></g>
      {[0,1].map(k=>{const t=loop(40,k*20);return <circle key={k} cx={20+k*6} cy={36-t*30} r={3+k} {...line} strokeWidth={2} opacity={1-t}/>;})}</>;},
    egg:()=>{const r=6*Math.sin(age/7)*Math.exp(-age/70);return <g transform={`rotate(${r} 50 86)`}>
      <ellipse cx={50} cy={54} rx={26} ry={34} fill="rgba(255,255,255,.94)"/><ellipse cx={42} cy={40} rx={6} ry={9} fill="#FFFFFF" opacity={.9}/></g>;},
    milk:()=>{const p=pop(0,2.2,.6);return <g transform={scaleAt(p,50,88)}>
      <path d="M30 30 L40 14 H60 L70 30 V88 H30 Z" fill="rgba(255,255,255,.94)"/><path d="M30 30 H70" stroke="#C9D7E8" strokeWidth={3}/>
      <rect x={30} y={46} width={40} height={22} fill={ICE}/><path d="M44 52 Q50 46 56 52 Q50 64 44 52 Z" fill="#FFFFFF"/></g>;},
    screen:()=>{const play=1+.12*Math.sin(age/6);return <>
      <rect x={10} y={18} width={80} height={54} rx={6} {...line}/><path d="M38 84 H62 M50 72 V84" {...line}/>
      <g transform={`translate(50 45) scale(${play*Math.min(1,pop(4))}) translate(-50 -45)`}><path d="M42 33 L62 45 L42 57 Z" fill={GOLD}/></g></>;},
    ball:()=>{const t=loop(30),h=Math.sin(Math.PI*t),y=78-50*h,squash=t<.08||t>.92?.84:1;return <>
      <ellipse cx={50} cy={90} rx={18*(1-.4*h)} ry={4} fill="rgba(0,0,0,.3)"/>
      <g transform={`translate(50 ${y-12}) scale(${2-squash} ${squash}) rotate(${age*6})`}><circle r={18} fill="rgba(255,255,255,.94)"/>
        <path d="M0 -7 L7 -2 L4 6 H-4 L-7 -2 Z" fill="#1A1A1A"/><path d="M0 -18 V-7 M17 -5 L7 -2 M10 15 L4 6 M-10 15 L-4 6 M-17 -5 L-7 -2" stroke="#1A1A1A" strokeWidth={2}/></g></>;},
    run:()=>{const b=-5*Math.abs(Math.sin(age/5));return <><g transform={`translate(${6*Math.sin(age/10)} ${b})`}>
      <path d="M34 66 V48 Q34 42 40 42 H56 L64 52 Q78 54 86 58 Q90 60 90 66 V70 H34 Z" fill={GOLD}/><line x1={32} x2={92} y1={73} y2={73} {...line} strokeWidth={5}/></g>
      {[0,1,2].map(k=>{const t=loop(18,k*6);return <line key={k} x1={26-t*18} x2={8-t*18} y1={46+k*10} y2={46+k*10} {...line} strokeWidth={4} opacity={1-t}/>;})}</>;},
    gift:()=>{const lid=easeOut((age-14)/10),bounce=bell(age-14,10);return <>
      <rect x={18} y={46} width={64} height={42} rx={4} fill={GOLD}/><rect x={46} y={46} width={8} height={42} fill={C.brandRed}/>
      <g transform={`translate(0 ${-14*lid}) rotate(${-10*lid} 18 40)`}><rect x={14} y={34} width={72} height={14} rx={4} fill={GOLD} stroke="#5A3B00" strokeWidth={1.5}/>
        <rect x={46} y={34} width={8} height={14} fill={C.brandRed}/><path d="M50 34 Q36 18 30 28 Q32 34 50 34 Q64 18 70 28 Q68 34 50 34" fill="none" stroke={C.brandRed} strokeWidth={4}/></g>
      {lid>.5&&[0,1,2].map(k=><circle key={k} cx={34+k*16} cy={30-20*bounce-k*4} r={3} fill={k===1?"#FFFFFF":GOLD} opacity={bounce}/>)}</>;},
    flower:()=>{const g=easeOut((age-2)/20),spin=age*.8;return <>
      <path d={`M50 90 V${90-40*g}`} {...S} stroke={GREEN} strokeWidth={5}/><path d={`M50 72 Q${50-16*g} ${66} ${50-20*g} 58`} {...S} stroke={GREEN} strokeWidth={4}/>
      <g transform={`translate(50 ${90-46*g}) scale(${Math.min(1,pop(10))}) rotate(${spin})`}>{Array.from({length:6},(_,k)=><ellipse key={k} cx={0} cy={-13} rx={8} ry={12}
        fill={k%2?"#FFB4C8":"#FF8FB0"} transform={`rotate(${k*60})`}/>)}<circle r={7} fill={GOLD}/></g></>;},
    tree:()=>{const sway=3*Math.sin(age/12),g=pop(0,2,.6);return <g transform={`rotate(${sway} 50 90)`}>
      <path d="M46 90 V58 H54 V90 Z" fill="#9A6B3F"/>
      <g transform={scaleAt(g,50,56)}><circle cx={50} cy={40} r={24} fill={GREEN}/><circle cx={34} cy={52} r={16} fill="#2FBF80"/><circle cx={66} cy={52} r={16} fill="#2FBF80"/></g></g>;},
    umbrella:()=>{const open=pop(2,2.4,.55);return <>
      {[0,1,2,3].map(k=>{const t=loop(26,k*7);return <line key={k} x1={14+k*24} x2={11+k*24} y1={4+t*22} y2={10+t*22} {...S} stroke={ICE} strokeWidth={3.5} opacity={1-t}/>;})}
      <g transform={`translate(50 46) scale(${Math.min(1.05,open)} 1) translate(-50 -46)`}><path d="M12 46 Q50 6 88 46 Q78 40 69 46 Q60 40 50 46 Q40 40 31 46 Q22 40 12 46 Z" fill={GOLD}/></g>
      <path d="M50 46 V80 Q50 88 42 88 Q36 88 36 82" {...line} strokeWidth={4.5}/></>;},
    door:()=>{const open=.5-.5*Math.cos(Math.min(1,clamp01((age-6)/18))*Math.PI);return <>
      <rect x={24} y={12} width={52} height={78} rx={3} {...line}/><rect x={28} y={16} width={44} height={72} fill={GOLD} opacity={.25*open}/>
      <g transform={`translate(28 0) scale(${1-.72*open} 1) translate(-28 0)`}><rect x={28} y={16} width={44} height={72} rx={2} fill={GOLD}/>
        <circle cx={64} cy={54} r={3.5} fill="#5A3B00"/></g></>;},
    snow:()=><>{Array.from({length:5},(_,k)=>{const t=loop(50,k*10),x=14+k*18+Math.sin((age+k*13)/9)*5;return <g key={k} transform={`translate(${x} ${6+t*68}) rotate(${age*3+k*40})`} opacity={Math.sin(Math.PI*t)}>
        {[0,60,120].map(r=><line key={r} x1={-7} x2={7} y1={0} y2={0} stroke="#DDF3FF" strokeWidth={2.6} strokeLinecap="round" transform={`rotate(${r})`}/>)}</g>;})}
      <path d={`M6 92 Q30 ${92-10*grow} 50 ${90-6*grow} Q72 ${92-12*grow} 94 92 Z`} fill="#F2FAFF"/></>,
    moon:()=><><path d="M58 14 A34 34 0 1 0 86 66 A27 27 0 1 1 58 14 Z" fill={GOLD} transform={scaleAt(pop(0,2,.6),56,50)}/>
      {[[18,22],[28,74],[82,22]].map(([x,y],k)=>{const tw=.4+.6*Math.abs(Math.sin((age+k*11)/8));return <path key={k} d={`M${x} ${y-6} L${x+2} ${y-2} L${x+6} ${y} L${x+2} ${y+2} L${x} ${y+6} L${x-2} ${y+2} L${x-6} ${y} L${x-2} ${y-2} Z`} fill="#FFFFFF" opacity={tw}/>;})}</>,
    cake:()=>{const flame=1+.2*Math.sin(age/2.5);return <>
      <rect x={18} y={56} width={64} height={30} rx={6} fill="rgba(255,255,255,.92)"/><rect x={26} y={38} width={48} height={20} rx={5} fill="#FFB4C8"/>
      <path d="M18 64 Q26 70 34 64 Q42 70 50 64 Q58 70 66 64 Q74 70 82 64" fill="none" stroke="#FF8FB0" strokeWidth={4}/>
      <rect x={47} y={22} width={6} height={16} rx={2} fill={ICE}/><ellipse cx={50} cy={16} rx={4*flame} ry={7*flame} fill={GOLD} opacity={clamp01((age-6)/6)}/></>;},
    cloud:()=>{const x=6*Math.sin(age/16);return <g transform={`translate(${x} 0)`}>
      <path d="M24 70 Q8 70 10 56 Q12 42 28 44 Q32 26 52 28 Q70 28 74 44 Q92 44 90 58 Q88 70 74 70 Z" fill="rgba(255,255,255,.9)"/>
      <path d="M40 80 Q24 80 26 72 H72 Q74 80 60 80 Z" fill="rgba(255,255,255,.55)"/></g>;},
    camera:()=>{const flash=bell(age%40-8,5);return <>
      <rect x={10} y={30} width={80} height={54} rx={10} fill="rgba(255,255,255,.9)"/><path d="M34 30 L40 20 H60 L66 30 Z" fill="rgba(255,255,255,.9)"/>
      <circle cx={50} cy={57} r={17} fill="#1A1A1A"/><circle cx={50} cy={57} r={9} fill={ICE}/><circle cx={46} cy={53} r={3} fill="#FFFFFF"/>
      <rect x={72} y={36} width={10} height={6} rx={2} fill={GOLD}/>
      {flash>.05&&<circle cx={77} cy={39} r={18*flash} fill="#FFF7D6" opacity={.8*flash}/>}</>;},
    palette:()=><><path d="M50 12 Q88 12 90 46 Q92 66 72 64 Q60 62 62 74 Q64 90 46 88 Q10 84 10 50 Q12 12 50 12 Z" fill="rgba(255,255,255,.9)"/>
      {[[32,36,C.brandRed],[52,26,GOLD],[72,36,GREEN],[28,58,ICE]].map(([x,y,c],k)=><circle key={k} cx={x as number} cy={y as number} r={8*Math.min(1.15,pop(4+k*4))} fill={c as string}/>)}</>,
    card:()=>{const p=pop(0,2.2,.6);return <g transform={`rotate(${-6+6*Math.min(1,p)} 50 50) ${scaleAt(p,50,50)}`}>
      <rect x={10} y={24} width={80} height={52} rx={8} fill="rgba(255,255,255,.92)"/><circle cx={30} cy={46} r={10} fill={GOLD}/>
      <line x1={48} y1={40} x2={80} y2={40} stroke="#1A1A1A" strokeWidth={4} strokeLinecap="round" {...draw(8,10)}/>
      <line x1={48} y1={52} x2={72} y2={52} stroke="#9AA4B2" strokeWidth={3.5} strokeLinecap="round" {...draw(12,10)}/>
      <line x1={20} y1={66} x2={80} y2={66} stroke={GOLD} strokeWidth={3} strokeLinecap="round" {...draw(16,10)}/></g>;},
    mountain:()=>{const sun=easeOut((age-6)/24);return <>
      <circle cx={70} cy={50-24*sun} r={10} fill={GOLD} opacity={clamp01(sun*2)}/>
      <path d="M6 88 L38 34 L56 62 L66 48 L94 88 Z" fill="rgba(255,255,255,.88)"/><path d="M38 34 L46 48 L40 46 L34 50 L30 47 Z" fill="#F2FAFF"/>
      <path d="M6 88 L38 34 L56 62" {...line} strokeWidth={3} {...draw(0,16)}/></>;},
  };
  function scaleAt(p:number,cx:number,cy:number){return `translate(${cx} ${cy}) scale(${Math.max(0,Math.min(1.08,p))}) translate(${-cx} ${-cy})`;}
  function thermometer(cold:boolean){
    const level=cold?70-50*easeOut((age-4)/26):30+50*easeOut((age-4)/26), color=cold?ICE:WARM;
    return <>
      <rect x={30} y={10} width={18} height={62} rx={9} {...line} strokeWidth={4}/>
      <circle cx={39} cy={80} r={13} {...line} strokeWidth={4}/><circle cx={39} cy={80} r={8.5} fill={color}/>
      <rect x={35} y={72-level*.58} width={8} height={level*.58+4} rx={4} fill={color}/>
      {cold?[0,1,2].map(k=>{const y=(age*1.2+k*33)%90;return <g key={k} transform={`translate(${62+k*10} ${y}) rotate(${age*4+k*40})`}>
        <line x1={-6} x2={6} y1={0} y2={0} stroke={ICE} strokeWidth={2.4} strokeLinecap="round"/>
        <line x1={-3} x2={3} y1={-5} y2={5} stroke={ICE} strokeWidth={2.4} strokeLinecap="round"/>
        <line x1={-3} x2={3} y1={5} y2={-5} stroke={ICE} strokeWidth={2.4} strokeLinecap="round"/></g>;})
        :<g transform={`rotate(${age*2} 74 30)`}>{Array.from({length:8},(_,k)=><line key={k} x1={74} y1={14} x2={74} y2={8} stroke={WARM}
          strokeWidth={3} strokeLinecap="round" transform={`rotate(${k*45} 74 30)`}/>)}<circle cx={74} cy={30} r={9} fill={WARM}/></g>}
    </>;
  }
  function position(where:number){
    const p=pop(4,2.4,.5), drop=(1-Math.min(1,p))*-30;
    const spot=[[50,30],[50,82],[50,64],[84,74]][where];
    return <>
      {where===2?<path d="M18 40 V88 H82 V40" {...line}/>:<><rect x={14} y={42} width={72} height={8} rx={3} {...line}/>
        <line x1={22} y1={50} x2={22} y2={92} {...line}/><line x1={78} y1={50} x2={78} y2={92} {...line}/></>}
      <rect x={spot[0]-11} y={spot[1]-11+drop} width={22} height={22} rx={4} fill={GOLD} opacity={clamp01(p*2)}/>
    </>;
  }
  function animal(cat:boolean){
    const blink=1-bell(age%60,6)*.9, wag=cat?0:10*Math.sin(age/4);
    return <>
      {cat?<path d="M22 40 L26 14 L42 30 M78 40 L74 14 L58 30" {...line} fill="rgba(255,255,255,.88)"/>
        :<g transform={`rotate(${wag} 28 30)`}><path d="M28 30 Q14 30 14 52 Q24 54 30 44" fill={GOLD}/></g>}
      {!cat&&<path d="M72 30 Q86 30 86 52 Q76 54 70 44" fill={GOLD}/>}
      <circle cx={50} cy={52} r={30} fill="rgba(255,255,255,.9)"/>
      <ellipse cx={39} cy={48} rx={4} ry={5*blink} fill="#1A1A1A"/><ellipse cx={61} cy={48} rx={4} ry={5*blink} fill="#1A1A1A"/>
      <path d="M46 60 L50 64 L54 60 Z" fill={C.brandRed}/>
      {cat&&[0,1].map(k=><g key={k}><line x1={k?64:36} x2={k?84:16} y1={62} y2={58} stroke="#1A1A1A" strokeWidth={2}/></g>)}
    </>;
  }
  const body=(icons as Record<string,(()=>ReactNode)|undefined>)[kind]?.();
  if(!body)return null;
  return <svg width={size} height={size} viewBox="0 0 100 100" style={{overflow:"visible"}} aria-hidden="true">{body}</svg>;
};
