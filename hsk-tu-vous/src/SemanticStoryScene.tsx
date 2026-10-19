import { AbsoluteFill, Easing } from "remotion";
import visual from "../content/visual-system.json";
import type { VisualBeat } from "./EpisodeComposition";

export type SemanticShot = {
  environmentId: "street" | "home" | "campus" | "cafe" | "pool" | "transport-stop" | "room" | "neutral";
  shotType: "wide" | "medium" | "closeup" | "object-focus" | "split-contrast";
  cameraStyle: "static" | "follow" | "push-in" | "pull-back" | "side-track";
  actorIds?: string[];
  objectIds?: string[];
};
export type SemanticAction = {
  type: "approach-camera" | "move-away" | "enter" | "exit" | "give" | "take" |
    "open" | "close" | "appear" | "disappear" | "point-to" | "compare" |
    "show-blocked" | "hold";
  subjectId: string;
  targetId?: string;
  durationMs?: number;
};
export type ResolvedSemanticAction = {
  beatIndex: number;
  action: SemanticAction["type"];
  subjectId: string;
  targetId: string | null;
  cueText: string;
  startMs: number;
  endMs: number;
  startFrame: number;
  endFrame: number;
  captionIndex: number;
};
export type SemanticTimelineScene = {
  sceneId: string;
  shot: SemanticShot;
  actions: ResolvedSemanticAction[];
};
export type SemanticTimeline = {
  schemaVersion: number;
  mode: "review-only";
  episodeId: string;
  fps: number;
  sourceFingerprint: string;
  timingFingerprint: string;
  scenes: SemanticTimelineScene[];
};

const COLORS = visual.colors;
const LAYOUT = visual.storyboardLayout;
const ease = Easing.bezier(0.18, 0.82, 0.2, 1);
const clamp = (value: number) => Math.max(0, Math.min(1, value));
export const semanticActionProgress = (frame: number, action: ResolvedSemanticAction) =>
  ease(clamp((frame - action.startFrame) / Math.max(1, action.endFrame - action.startFrame)));

/** Motion is keyed solely to absolute audio frame, never to equal-time visual beats. */
export const semanticActorPose = (
  id: string,
  frame: number,
  actions: ResolvedSemanticAction[],
) => {
  const related = actions.filter((item) => item.subjectId === id);
  const approaches = related.some((a) => a.action === "approach-camera");
  let scale = approaches ? 0.64 : 1;
  let x = 0;
  let opacity = 1;
  let gesture = 0;
  for (const a of related) {
    const p = semanticActionProgress(frame, a);
    if (a.action === "approach-camera") { scale += 0.52 * p; x -= 38 * p; }
    if (a.action === "move-away") { scale -= 0.52 * p; x += 38 * p; }
    if (a.action === "enter") x += 280 * (p - 1);
    if (a.action === "exit") { x += 280 * p; opacity *= 1 - p; }
    if (a.action === "appear") opacity *= p;
    if (a.action === "disappear") opacity *= 1 - p;
    if (["give","take","point-to","compare"].includes(a.action)) gesture = p;
  }
  return {x,scale:Math.max(0.12,scale),opacity:clamp(opacity),gesture};
};

const SceneBackdrop: React.FC<{shot:SemanticShot}> = ({shot}) => {
  const background = <rect width="1080" height="710" fill="#F6E8D3" />;
  switch(shot.environmentId) {
    case "street":
      return <g>{background}
        <rect x="30" y="155" width="285" height="390" rx="15" fill="#DABAA0"/>
        <rect x="760" y="95" width="285" height="450" rx="15" fill="#D1B2A3"/>
        {[80,195,815,932].map(x=><rect key={x} x={x} y={215} width="69" height="128" rx="10" fill="#A4D2D0"/>)}
        <path d="M0 550h1080v160H0Z" fill="#DBCCB1"/>
        <path d="M540 552 270 710M540 552 810 710" stroke="#F9F5E9" strokeWidth="9" strokeDasharray="35 28"/>
        <path d="M350 550h380" stroke="#8A9D85" strokeWidth="11"/>
      </g>;
    case "pool":
      return <g>{background}<rect x="80" y="72" width="920" height="480" rx="34" fill="#D7E7E1"/>
        <rect x="103" y="285" width="874" height="300" rx="20" fill="#6ABDC7"/>
        {[345,420,495].map(y=><path key={y} d={`M125 ${y}Q275 ${y-18} 425 ${y}T725 ${y}T960 ${y}`} stroke="#DAF8F4" strokeWidth="9" fill="none" opacity=".8"/>)}
        <path d="M92 284h895" stroke="#FFF8EF" strokeWidth="25"/>
        <path d="M60 600h960" stroke="#E6D8BF" strokeWidth="52"/>
      </g>;
    case "cafe":
      return <g>{background}<rect x="68" y="90" width="944" height="450" rx="26" fill="#E4C8AD"/>
        <rect x="112" y="133" width="248" height="260" rx="18" fill="#B1CFCA"/>
        <rect x="408" y="152" width="560" height="130" rx="16" fill="#F6EBDD"/>
        <path d="M80 570h920" stroke="#9D7764" strokeWidth="55"/>
        <path d="M244 585v125M842 585v125" stroke="#87645A" strokeWidth="22"/>
      </g>;
    case "home":
    case "room":
      return <g>{background}<rect x="90" y="85" width="890" height="465" rx="28" fill="#F0D8B5"/>
        <rect x="610" y="136" width="254" height="225" rx="18" fill="#A4D0D1"/>
        <path d="M738 140v220M610 248h254" stroke="#FFF6E8" strokeWidth="17"/>
        <rect x="140" y="415" width="380" height="135" rx="48" fill="#B38B77"/>
        <rect x="155" y="382" width="350" height="73" rx="28" fill="#D9A88B"/>
        <path d="M0 559h1080" stroke="#D9BC9A" strokeWidth="45"/>
      </g>;
    case "transport-stop":
      return <g>{background}<path d="M100 190h900M170 190v430M925 190v430" stroke="#678F87" strokeWidth="24"/>
        <rect x="245" y="245" width="590" height="275" rx="24" fill="#AFD5CF"/>
        <path d="M225 550h680" stroke="#8A7564" strokeWidth="30"/>
        <rect x="120" y="145" width="840" height="55" rx="14" fill="#C98A66"/>
      </g>;
    case "campus":
      return <g>{background}<rect x="145" y="153" width="790" height="416" rx="24" fill="#DEC2A3"/>
        {[245,460,675].map(x=><rect key={x} x={x} y="250" width="160" height="178" rx="12" fill="#A8D1CF"/>)}
        <path d="M125 155h835" stroke="#D68164" strokeWidth="46"/>
        <path d="M0 570h1080" stroke="#D5C5A9" strokeWidth="44"/>
      </g>;
    default:
      return <g>{background}<ellipse cx="540" cy="560" rx="450" ry="135" fill="#E7D8BE"/>
        <path d="M0 610H1080" stroke="#D5C5A9" strokeWidth="22"/></g>;
  }
};

const Person:React.FC<{id:string;index:number;pose:ReturnType<typeof semanticActorPose>;shot:SemanticShot}> = ({id,index,pose,shot})=>{
  const x=shot.shotType==="split-contrast" ? 290+index*480 : 500+index*160;
  const base=shot.shotType==="closeup"?1.24:shot.shotType==="wide"?0.80:1;
  const jacket=index%2===0?COLORS.brandRed:COLORS.brandTeal;
  return <g aria-label={id} transform={`translate(${x+pose.x} 527) scale(${base*pose.scale})`} opacity={pose.opacity}>
    <ellipse cy="135" rx="110" ry="16" fill="#4E4639" fillOpacity=".14"/>
    <path d="M-80 -10Q-72 -56 -27 -72H30Q70 -56 82 -10L70 130H-70Z" fill={jacket}/>
    <path d="M-32 -68L0 -30 32 -68" stroke="#FFF5E5" strokeWidth="13" fill="none"/>
    <path d={`M-75 4Q-113 35 -99 90M75 4Q109 39 ${96+pose.gesture*35} 90`} fill="none" stroke={jacket} strokeWidth="24" strokeLinecap="round"/>
    <path d="M-20 -77v-31M20 -77v-31" stroke="#DEAC85" strokeWidth="20"/>
    <ellipse cy="-164" rx="58" ry="70" fill="#DEAC85"/>
    <path d="M-58 -182Q-62 -249 7 -239Q66 -235 60 -180Q24 -202 -58 -182Z" fill="#30252A"/>
    <circle cx="-18" cy="-159" r="5" fill="#33282C"/><circle cx="20" cy="-159" r="5" fill="#33282C"/>
    <path d="M-13 -126Q0 -118 13 -126" stroke="#8B5F51" strokeWidth="4" fill="none"/>
  </g>;
};

const ObjectMark:React.FC<{id:string;index:number;frame:number;actions:ResolvedSemanticAction[]}> = ({id,index,frame,actions})=>{
  const pose=semanticActorPose(id,frame,actions);
  const x=260+index*245;
  const opening=actions.filter(a=>a.subjectId===id && (a.action==="open"||a.action==="close"))
    .reduce((v,a)=>a.action==="open"?semanticActionProgress(frame,a):1-semanticActionProgress(frame,a),0);
  const blocked=actions.some(a=>a.subjectId===id && a.action==="show-blocked" && frame>=a.startFrame);
  return <g aria-label={id} transform={`translate(${x+pose.x} 445) scale(${pose.scale})`} opacity={pose.opacity}>
    <ellipse cx="0" cy="118" rx="87" ry="14" fill="#554431" fillOpacity=".12"/>
    <rect x="-70" y="-105" width="140" height="215" rx="13" fill="#D4AD88" stroke="#8F6754" strokeWidth="8"/>
    <path d={`M${-58+opening*106} -86h${110-opening*103}v179h${-110+opening*103}Z`}
      fill="#876250" stroke="#6E4B40" strokeWidth="7"/>
    <circle cx={36+opening*13} cy="12" r="9" fill="#F7D682"/>
    {blocked&&<g><circle cy="-150" r="64" stroke={COLORS.brandRed} strokeWidth="15" fill="#FFF9F0" fillOpacity=".92"/>
      <path d="M-36 -187 36 -115" stroke={COLORS.brandRed} strokeWidth="13"/></g>}
  </g>;
};

export const SemanticStoryScene:React.FC<{
  shot:SemanticShot;timeline:SemanticTimelineScene;beats:VisualBeat[];
  sceneStartFrame:number;frame:number;
}> = ({shot,timeline,beats,sceneStartFrame,frame}) => {
  const absoluteFrame=sceneStartFrame+frame;
  const selected=timeline.actions.filter(a=>absoluteFrame>=a.startFrame).at(-1);
  const beat=beats[selected?.beatIndex ?? 0];
  const hero=beat?.hero??"";
  const cameraScale=shot.shotType==="closeup"?1.10:shot.shotType==="wide"?0.90:1;
  const pan=shot.cameraStyle==="side-track"?Math.min(frame,120)*-.15:0;
  const active=selected?semanticActionProgress(absoluteFrame,selected):0;
  const push=shot.cameraStyle==="push-in"?1+active*.035:shot.cameraStyle==="pull-back"?1-active*.035:1;
  return <AbsoluteFill style={{background:COLORS.background,overflow:"hidden",fontFamily:"'PingFang SC','Noto Sans CJK SC',sans-serif"}}>
    <AbsoluteFill style={{background:"linear-gradient(155deg,#FFF9ED 0%,#F2E3CA 65%,#FDF9F0 100%)"}}/>
    <svg viewBox="0 0 1080 710" aria-label={`Semantic ${shot.environmentId} scene`}
      style={{position:"absolute",left:0,top:LAYOUT.environmentTopPx,width:1080,height:LAYOUT.environmentHeightPx,overflow:"hidden"}}>
      <g transform={`translate(${pan} 0) translate(540 360) scale(${cameraScale*push}) translate(-540 -360)`}>
        <SceneBackdrop shot={shot}/>
        {(shot.objectIds??[]).map((id,index)=><ObjectMark key={id} id={id} index={index} frame={absoluteFrame} actions={timeline.actions}/>)}
        {(shot.actorIds??[]).map((id,index)=><Person key={id} id={id} index={index}
          shot={shot} pose={semanticActorPose(id,absoluteFrame,timeline.actions)}/>)}
      </g>
    </svg>
    <div style={{position:"absolute",top:828,left:0,right:0,height:145,background:"linear-gradient(0deg,#FDF9F0 0%,rgba(253,249,240,0) 100%)"}}/>
    <div style={{position:"absolute",top:LAYOUT.heroTopPx,left:LAYOUT.safeSidePx,right:LAYOUT.safeSidePx,textAlign:"center",color:COLORS.foreground}}>
      <div style={{fontSize:hero.length<=2?116:hero.length<=6?87:62,fontWeight:900,lineHeight:1.12,textWrap:"balance"}}>{hero}</div>
      {beat?.pinyin&&<div style={{marginTop:12,fontSize:LAYOUT.pinyinFontPx,fontWeight:750,color:COLORS.brandRed}}>{beat.pinyin}</div>}
      {beat?.meaning&&<div style={{marginTop:12,fontSize:LAYOUT.meaningFontPx,fontWeight:650,color:COLORS.muted,textWrap:"balance"}}>{beat.meaning}</div>}
    </div>
  </AbsoluteFill>;
};
