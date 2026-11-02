import {createElement} from "react";
import {graphicNodeState, validateGraphicScene} from "../scripts/graphic-scene.mjs";
import type {GraphicScene as GraphicPlan, GraphicNode} from "../scripts/graphic-scene.mjs";
import visual from "../content/visual-system.json";

const colors:Record<string,string>={...visual.narratedActionPalette,
  red:visual.colors.brandRed,gold:visual.colors.brandGold,teal:visual.colors.brandTeal,none:"none"};

type RootPose={x:number;y:number;rotate:number;scale:number;opacity:number};
export const GraphicScene:React.FC<{
  plan:GraphicPlan;frame:number;height:number;fps?:number;
  omitRootIds?:string[];onlyRootIds?:string[];rootPoseOverrides?:Record<string,RootPose>;
}>=({plan,frame,height,fps=30,omitRootIds=[],onlyRootIds,rootPoseOverrides})=>{
  validateGraphicScene(plan);
  const draw=(node:GraphicNode):React.ReactNode=>{
    const state=node.parentId===undefined&&rootPoseOverrides?.[node.id]
      ?rootPoseOverrides[node.id]:graphicNodeState(plan,node,frame*1000/fps);
    const attrs={...node.attrs};
    for(const key of ["fill","stroke"]) if(typeof attrs[key]==="string") attrs[key]=colors[attrs[key]];
    return createElement("g",{key:node.id,"data-graphic-node":node.id,opacity:state.opacity,
      transform:`translate(${state.x} ${state.y}) rotate(${state.rotate}) scale(${state.scale})`},
      createElement(node.type,{fill:"none",strokeLinecap:"round",strokeLinejoin:"round",...attrs},
        ...plan.nodes.filter(child=>child.parentId===node.id).map(draw)));
  };
  return <svg width="100%" height={height} viewBox={`0 0 ${plan.width} ${plan.height}`}>
    {plan.nodes.filter(node=>node.parentId===undefined && !omitRootIds.includes(node.id) &&
      (!onlyRootIds||onlyRootIds.includes(node.id))).map(draw)}
  </svg>;
};
