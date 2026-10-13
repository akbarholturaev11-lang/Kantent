import { AbsoluteFill, Easing, interpolate } from 'remotion';
import visualSystem from '../content/visual-system.json';
import type { VisualBeat } from './EpisodeComposition';

export type Storyboard = {
  formatId: 'street-situation' | 'speed-quiz' | 'micro-series' | 'problem-fix';
  setting: 'street' | 'cafe' | 'campus' | 'home';
  character: 'student' | 'shopkeeper';
  mood: 'question' | 'mistake' | 'answer' | 'practice';
  sign?: string;
  options?: string[];
};

const colors=visualSystem.colors;
const layout=visualSystem.storyboardLayout;
const clamp={extrapolateLeft:'clamp' as const,extrapolateRight:'clamp' as const,
  easing:Easing.bezier(0.16,1,0.3,1)};
const font="'PingFang SC','Noto Sans CJK SC','Microsoft YaHei',sans-serif";

const characterPalette={
  student:{coat:colors.brandRed,skin:'#E4AA83',hair:'#272126'},
  shopkeeper:{coat:colors.brandTeal,skin:'#D79D76',hair:'#251F21'},
};

const Building: React.FC<{setting:Storyboard['setting']; sign?:string}> = ({setting,sign}) => {
  if(setting==='home') return <>
    <path d="M70 382 324 190 588 382V710H70Z" fill="#E8D2B3"/>
    <path d="M45 392 324 166 617 392" fill="none" stroke="#B87556" strokeWidth="42" strokeLinejoin="round" strokeLinecap="round"/>
    <rect x="290" y="457" width="128" height="253" rx="15" fill="#815D57"/>
    <circle cx="385" cy="580" r="8" fill="#F3C975"/>
    <rect x="117" y="435" width="120" height="110" rx="15" fill="#A6D8D0" stroke="#FFF5DC" strokeWidth="15"/>
    <path d="M177 432v118M116 493h122" stroke="#FFF5DC" strokeWidth="11"/>
  </>;
  if(setting==='cafe') return <>
    <rect x="65" y="196" width="560" height="510" rx="22" fill="#E7C7AC"/>
    <rect x="65" y="282" width="560" height="95" rx="8" fill="#E4A55E"/>
    <path d="M65 370 Q111 412 158 370Q204 412 251 370Q297 412 344 370Q390 412 437 370Q483 412 530 370Q577 412 625 370" fill="none" stroke="#FFF2D4" strokeWidth="32" strokeLinecap="round"/>
    <rect x="132" y="425" width="205" height="193" rx="18" fill="#96B9B0" stroke="#FFF0D4" strokeWidth="14"/>
    <rect x="378" y="427" width="183" height="280" rx="14" fill="#816056"/>
    <text x="346" y="258" textAnchor="middle" fontFamily={font} fontWeight={800} fontSize="56" fill="#56382C">{sign||'茶馆'}</text>
    <path d="M240 637h320" stroke="#FFF4E0" strokeWidth="20" strokeLinecap="round"/>
  </>;
  if(setting==='campus') return <>
    <rect x="60" y="200" width="605" height="515" rx="20" fill="#E7CEB2"/>
    <rect x="45" y="203" width="636" height="60" rx="16" fill="#D57E63"/>
    {Array.from({length:3}).map((_,i)=><g key={i}><rect x={104+i*175} y="335" width="132" height="145" rx="13" fill="#A9D4CF" stroke="#FCF1DA" strokeWidth="16"/><path d={`M${170+i*175} 330v154`} stroke="#FCF1DA" strokeWidth="10"/></g>)}
    <rect x="293" y="536" width="132" height="179" rx="12" fill="#795D56"/>
    <rect x="198" y="258" width="352" height="65" rx="7" fill="#F5E9CF"/>
    <text x="375" y="309" textAnchor="middle" fontFamily={font} fontWeight={800} fontSize="51" fill="#70514B">{sign||'学校'}</text>
  </>;
  return <>
    <rect x="48" y="290" width="310" height="418" rx="16" fill="#E6C5A9"/>
    <rect x="392" y="187" width="258" height="521" rx="16" fill="#D7B4A2"/>
    {Array.from({length:6}).map((_,i)=><rect key={i} x={420+(i%2)*104} y={246+Math.floor(i/2)*130} width="75" height="76" rx="8" fill="#9ECBC7" stroke="#FCF2DF" strokeWidth="9"/>)}
    <rect x="89" y="348" width="222" height="52" rx="8" fill="#F4E4C7"/>
    <text x="200" y="386" textAnchor="middle" fontFamily={font} fontSize="37" fontWeight={800} fill="#5D4E46">{sign||'中国'}</text>
    <rect x="118" y="468" width="110" height="143" rx="8" fill="#9ECBC7"/>
  </>;
};

const Human: React.FC<{character:Storyboard['character'];mood:Storyboard['mood'];frame:number}> = ({character,mood,frame}) => {
 const {coat,skin,hair}=characterPalette[character];
 const bob=Math.sin(frame/17)*layout.characterBobAmplitudePx;
 const sway=Math.sin(frame/27)*layout.characterSwayDeg;
 const wave=mood==='question'?Math.sin(frame/12)*layout.characterQuestionWavePx:0;
 return <g transform={`translate(770 ${570+bob}) rotate(${sway} 0 -170)`}>
   <ellipse cx="0" cy="154" rx="110" ry="18" fill="#40352D" fillOpacity=".12"/>
   <path d="M-94 -10 Q-68 -66 -38 -70L38 -70Q75 -60 92 -10L76 154H-81Z" fill={coat}/>
   <path d="M-40 -69 0 -20 40 -69" fill="none" stroke="#FFF8E8" strokeWidth="18" strokeLinecap="round"/>
   <path d="M-88 0Q-125 45 -104 85" stroke={coat} strokeWidth="31" strokeLinecap="round" fill="none"/>
   <path d={`M88 0Q${125+wave} 37 ${92+wave} 86`} stroke={coat} strokeWidth="31" strokeLinecap="round" fill="none"/>
   <path d="M-24 -78v-31M24 -78v-31" stroke={skin} strokeWidth="22" strokeLinecap="round"/>
   <ellipse cx="0" cy="-162" rx="70" ry="81" fill={skin}/>
   <path d="M-69 -174Q-75 -255 6 -251Q82 -246 68 -166Q53 -206 27 -211Q-22 -192 -69 -174Z" fill={hair}/>
   <ellipse cx="-25" cy="-153" rx="5" ry="7" fill="#29242A"/>
   <ellipse cx="24" cy="-153" rx="5" ry="7" fill="#29242A"/>
   {mood==='question'||mood==='mistake'
    ? <path d="M-15 -111Q0 -126 15 -111" stroke="#704C45" strokeWidth="4" fill="none" strokeLinecap="round"/>
    : <path d="M-17 -119Q0 -100 17 -119" stroke="#704C45" strokeWidth="4" fill="none" strokeLinecap="round"/>}
   {mood==='question'&&<text x="74" y="-251" fontSize="65" fontWeight="900" fill={colors.brandRed}>?</text>}
 </g>;
};

export const CinematicStoryScene:React.FC<{
 beat:VisualBeat; storyboard:Storyboard; frame:number; beatFrame:number; isHook:boolean;
}> = ({beat,storyboard,frame,beatFrame,isHook}) => {
 const lead=isHook?1:interpolate(beatFrame,[0,10],[0,1],clamp);
 const rise=interpolate(beatFrame,[0,16],[18,0],clamp);
 const pan=interpolate(frame,[0,150],[0,-18],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 const isChinese=beat.chinese || /[\u3400-\u9fff]/u.test(beat.hero);
 const cameraDrift=Math.sin(frame/31)*layout.cameraDriftPx;
 const quiver=interpolate(beatFrame,[0,2,5,10],[0,1,0.45,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
 const heroShakeX=isChinese?Math.sin(beatFrame*2.5)*layout.heroQuiverPx*quiver:0;
 const heroShakeY=isChinese?Math.cos(beatFrame*2.1)*layout.heroQuiverPx*0.35*quiver:0;
 const heroTilt=isChinese?Math.sin(beatFrame*2.5)*layout.heroQuiverDeg*quiver:0;
 const baseHanziSize=beat.hero.length<=2?198:beat.hero.length<=6?138:99;
 const fontSize=isChinese?Math.round(baseHanziSize*layout.hanziScale):(beat.hero.length>20?67:82);
 const heroScale=isChinese&&!isHook?interpolate(beatFrame,[0,7,15],[0.94,1.025,1],clamp):1;
 const meaning=beat.meaning;
 const quiz=storyboard.formatId==='speed-quiz' && Boolean(storyboard.options?.length);
 const isSeries=storyboard.formatId==='micro-series';
 const isFix=storyboard.formatId==='problem-fix';
 const quizSeconds=Math.max(1,3-Math.floor(frame/30));
 return <AbsoluteFill style={{background:colors.background, overflow:'hidden',fontFamily:font,color:colors.foreground}}>
   <AbsoluteFill style={{background:isSeries
     ? `radial-gradient(ellipse at 56% 30%, ${colors.brandTeal}24 0%, transparent 50%),linear-gradient(160deg,#FFF8E9 0%,#F1E6CC 70%,#FDF9F0 100%)`
     : isFix ? `radial-gradient(ellipse at 56% 30%, ${colors.brandRed}19 0%, transparent 50%),linear-gradient(160deg,#FFF9F2 0%,#F1DACC 70%,#FDF9F0 100%)`
     : `radial-gradient(ellipse at 56% 30%, ${colors.brandGold}21 0%, transparent 50%),linear-gradient(160deg,#FFF8E9 0%,#F6E7D2 70%,#FDF9F0 100%)`}}/>
   <svg viewBox="0 0 1080 790" style={{position:'absolute',top:layout.environmentTopPx,left:0,width:1080,height:layout.environmentHeightPx,overflow:'visible'}} aria-hidden>
      <g transform={`translate(${pan+cameraDrift} 0)`}>
        <ellipse cx="828" cy="144" rx="114" ry="114" fill="#F0C47B" fillOpacity=".45"
          transform={`translate(828 144) scale(${1+Math.sin(frame/34)*0.035}) translate(-828 -144)`}/>
        <path d="M-70 648Q180 570 380 642Q625 562 1150 654V800H-70Z" fill="#E2D5B8"/>
        <Building setting={storyboard.setting} sign={storyboard.sign}/>
        <path d="M0 718H1080V790H0Z" fill="#DFC8A6"/>
        <path d="M0 726H1080" stroke="#FFF0D8" strokeWidth="11"/>
        {!quiz&&<Human character={storyboard.character} mood={storyboard.mood} frame={frame}/>}
      </g>
    </svg>
    <div aria-hidden style={{position:'absolute',top:750,left:0,right:0,height:660,
       background:'linear-gradient(180deg,rgba(253,249,240,0) 0%,rgba(253,249,240,.94) 55%,#FDF9F0 100%)'}}/>
    {quiz&&isHook&&<div style={{position:'absolute',top:425,left:0,right:0,textAlign:'center',
        fontSize:62,fontWeight:900,color:colors.brandRed,opacity:frame<90?1:0.2}}>
        {quizSeconds}
      </div>}
    {isFix&&<div aria-hidden style={{position:'absolute',top:820,left:150,right:150,height:7,
       borderRadius:30,background:storyboard.mood==='question'||storyboard.mood==='mistake' ? colors.brandRed : colors.brandTeal,
       opacity:0.65}}/>}
    {isSeries&&<div aria-hidden style={{position:'absolute',top:730,left:210,right:210,height:5,borderRadius:30,
        background:colors.brandTeal,opacity:0.4}}/>}
    {quiz&&<div style={{position:'absolute',top:510,left:90,right:90,display:'flex',gap:14,justifyContent:'center'}}>
      {storyboard.options?.map((opt,index)=><div key={index} style={{minWidth:180,maxWidth:275,padding:'17px 22px',
        borderRadius:20,background:'#FFFDF7E8',border:`2px solid ${colors.border}`,
        textAlign:'center',fontSize:45,fontWeight:850,boxShadow:'0 9px 22px #61431A18'}}>
          {opt}
        </div>)}
      </div>}
    <div style={{position:'absolute',left:layout.safeSidePx,right:layout.safeSidePx,top:layout.heroTopPx,
      textAlign:'center',opacity:lead,translate:`${heroShakeX}px ${rise+heroShakeY}px`,rotate:`${heroTilt}deg`,scale:heroScale}}>
      <div style={{fontSize,fontWeight:900,letterSpacing:isChinese?'.025em':'-.032em',
         lineHeight:1.15,wordBreak:'break-word',textWrap:'balance',color:colors.foreground,
         textShadow:isChinese?'0 5px 20px #E9A91644, 0 3px 12px #FFF6E4':'0 5px 20px #FFF6E4'}}>
        {beat.hero}
      </div>
      {beat.pinyin&&<div style={{marginTop:17,fontSize:layout.pinyinFontPx,fontWeight:700,color:colors.brandRed,
          lineHeight:1.2,textWrap:'balance'}}>{beat.pinyin}</div>}
      {meaning&&<div style={{marginTop:20,fontSize:layout.meaningFontPx,fontWeight:680,
          color:colors.muted,lineHeight:1.25,textWrap:'balance'}}>{meaning}</div>}
    </div>
 </AbsoluteFill>;
};
