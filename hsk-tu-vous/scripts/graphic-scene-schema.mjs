import * as z from "zod/v4";
import {GRAPHIC_TYPES,validateGraphicScene} from "./graphic-scene.mjs";
const id=z.string().regex(/^[a-z][a-z0-9-]{0,63}$/);
export const graphicSceneSchema=z.object({
  width:z.number().min(100).max(1600),height:z.number().min(100).max(1200),
  nodes:z.array(z.object({
    id,parentId:id.optional(),type:z.enum(GRAPHIC_TYPES),
    attrs:z.record(z.string(),z.union([z.string(),z.number()])),
    x:z.number().optional(),y:z.number().optional(),rotate:z.number().optional(),
    scale:z.number().optional(),opacity:z.number().optional(),
  }).strict()).min(1).max(120),
  tracks:z.array(z.object({
    nodeId:id,property:z.enum(["x","y","rotate","scale","opacity"]),
    keyframes:z.array(z.object({atMs:z.number(),value:z.number()}).strict()).min(2).max(12),
    loop:z.boolean().optional(),
  }).strict()).max(40),
}).strict().superRefine((value,context)=>{
  try { validateGraphicScene(value); }
  catch(error) {context.addIssue({code:"custom",message:error.message});}
});
