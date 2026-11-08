import {createElement} from "react";
import {graphicNodeState, validateGraphicScene} from "../scripts/graphic-scene.mjs";
import type {GraphicScene as GraphicPlan, GraphicNode} from "../scripts/graphic-scene.mjs";
import visual from "../content/visual-system.json";

const colors:Record<string,string>={...visual.narratedActionPalette,
  red:visual.colors.brandRed,gold:visual.colors.brandGold,teal:visual.colors.brandTeal,none:"none"};

// Lighter top of a filled shape for the reference-glass depth (soft 3D look).
const lighten=(hex:string,amount:number)=>{
  const value=parseInt(hex.slice(1),16);
  const channel=(shift:number)=>Math.round(((value>>shift)&255)+(255-((value>>shift)&255))*amount);
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`;
};

export const GraphicScene:React.FC<{plan:GraphicPlan;frame:number;height:number;fps?:number;look?:"flat"|"glass"}>=({plan,frame,height,fps=30,look="flat"})=>{
  validateGraphicScene(plan);
  const glass=look==="glass";
  const tokens=[...new Set(plan.nodes.map(node=>node.attrs.fill).filter((fill):fill is string=>
    typeof fill==="string"&&fill!=="none"&&Boolean(colors[fill])))];
  const draw=(node:GraphicNode):React.ReactNode=>{
    const state=graphicNodeState(plan,node,frame*1000/fps);
    const attrs={...node.attrs};
    if(glass&&typeof attrs.fill==="string"&&attrs.fill!=="none"&&colors[attrs.fill]) {
      attrs.fill=`url(#glass-${attrs.fill})`;
      // Rim light keeps a teal/gold figure readable on a teal/gold scene.
      if(attrs.stroke===undefined||attrs.stroke==="none") Object.assign(attrs,{stroke:"rim",strokeWidth:3});
    }
    else if(typeof attrs.fill==="string") attrs.fill=colors[attrs.fill];
    // On the saturated reference backgrounds the drawing's ink is white.
    if(typeof attrs.stroke==="string") attrs.stroke=attrs.stroke==="rim"?"rgba(255,255,255,.6)"
      :glass&&attrs.stroke==="foreground"?"#FFFFFF":colors[attrs.stroke];
    return createElement("g",{key:node.id,"data-graphic-node":node.id,opacity:state.opacity,
      transform:`translate(${state.x} ${state.y}) rotate(${state.rotate}) scale(${state.scale})`},
      createElement(node.type,{fill:"none",strokeLinecap:"round",strokeLinejoin:"round",...attrs},
        ...plan.nodes.filter(child=>child.parentId===node.id).map(draw)));
  };
  return <svg width="100%" height={height} viewBox={`0 0 ${plan.width} ${plan.height}`} style={{overflow:"visible"}}>
    {glass&&<defs>
      {tokens.map(token=><linearGradient key={token} id={`glass-${token}`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={lighten(colors[token],.38)}/>
        <stop offset=".55" stopColor={colors[token]}/>
        <stop offset="1" stopColor={colors[token]} stopOpacity=".86"/>
      </linearGradient>)}
      <filter id="glass-depth" x="-30%" y="-30%" width="160%" height="170%">
        <feDropShadow dx="0" dy="16" stdDeviation="14" floodColor="#000000" floodOpacity=".45"/>
      </filter>
    </defs>}
    <g filter={glass?"url(#glass-depth)":undefined}>
      {plan.nodes.filter(node=>node.parentId===undefined).map(draw)}
    </g>
  </svg>;
};
