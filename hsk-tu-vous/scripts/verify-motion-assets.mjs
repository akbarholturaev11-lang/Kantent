import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import manifest from "../content/motion-assets.json" with {type:"json"};
import {validateMotionAssetManifest} from "./motion-assets.mjs";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
export function verifyMotionAssetFiles(collection=manifest,base=root){
  validateMotionAssetManifest(collection);
  const publicRoot=path.resolve(base,"public");
  for(const item of collection.assets){
    const full=path.resolve(publicRoot,item.path);
    if(!full.startsWith(publicRoot+path.sep))throw Error("Motion asset outside public root");
    if(!fs.existsSync(full))throw Error("Motion asset missing: "+item.id);
    const blob=fs.readFileSync(full);
    if(blob.length>100000)throw Error("Motion SVG too large: "+item.id);
    if(createHash("sha256").update(blob).digest("hex")!==item.sha256)
      throw Error("Motion asset changed without registry hash update: "+item.id);
    const svg=blob.toString("utf8");
    if(!svg.startsWith("<svg ")||!/viewBox="0 0 640 480"/.test(svg)||
      /<!DOCTYPE|<!ENTITY|<script|<foreignObject|<image|<text\b|<use\b|<style|<animate|<iframe|<video|<audio|<a\b|\bon[a-z]+\s*=|(?:xlink:)?href\s*=|https?:|data:|@import|url\(\s*['"]?(?!#)/i.test(svg))
      throw Error("Motion asset has unsafe or unsupported SVG feature: "+item.id);
    const declared=svg.match(/width="(\d+)" height="(\d+)"/);
    if(!declared||Number(declared[1])!==item.width||Number(declared[2])!==item.height)
      throw Error("Motion asset dimensions mismatch: "+item.id);
  }
  return {verified:collection.assets.map(a=>a.id),approval:"review-only-until-owner-visual-approval"};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const data=verifyMotionAssetFiles();
  console.log(JSON.stringify(data));
}
