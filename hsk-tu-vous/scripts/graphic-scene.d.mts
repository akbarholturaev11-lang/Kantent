export type GraphicNode = {id:string;parentId?:string;type:string;attrs:Record<string,string|number>;x?:number;y?:number;rotate?:number;scale?:number;opacity?:number};
export type GraphicTrack = {nodeId:string;property:"x"|"y"|"rotate"|"scale"|"opacity";keyframes:{atMs:number;value:number}[];loop?:boolean};
export type GraphicScene = {width:number;height:number;nodes:GraphicNode[];tracks:GraphicTrack[]};
export const GRAPHIC_TYPES:string[];
export const GRAPHIC_COLORS:string[];
export function validateGraphicScene(scene:unknown):{nodeCount:number;trackCount:number};
export function graphicNodeState(scene:GraphicScene,node:GraphicNode,elapsedMs:number):{x:number;y:number;rotate:number;scale:number;opacity:number};
export function graphicFingerprint(scene:GraphicScene):unknown;
