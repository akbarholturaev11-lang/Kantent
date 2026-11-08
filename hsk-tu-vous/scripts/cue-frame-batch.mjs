/**
 * Decode all requested exact encoded frame indices in TWO sequential FFmpeg
 * passes (1080x1920 and 270x480), rather than one full-decode per cue.
 * Output labels are protected against traversal and never use guessed times.
 */
import fs from "node:fs/promises";
import path from "node:path";
import {spawnSync} from "node:child_process";

function execFfmpeg(args){
  const r=spawnSync("ffmpeg",args,{encoding:"utf8",stdio:["ignore","pipe","pipe"]});
  if(r.error)throw r.error;
  if(r.status!==0)throw Error("FFmpeg frame batch failed: "+(r.stderr||r.stdout||"").slice(-1500));
}

export async function extractCueFrameBatch(video,outputDir,requests,{execute=execFfmpeg}={}){
  if(!Array.isArray(requests)||requests.length<1||requests.length>2000)
    throw Error("Frame proof requests must be 1..2000 entries.");
  const stems=new Set();
  for(const req of requests) {
    if(!Number.isSafeInteger(req.frame)||req.frame<0||
        typeof req.stem!=="string"||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(req.stem)||
        stems.has(req.stem))
      throw Error("Invalid or duplicate frame proof label/index.");
    stems.add(req.stem);
  }
  const frames=[...new Set(requests.map(r=>r.frame))].sort((a,b)=>a-b);
  const index=new Map(frames.map((f,i)=>[f,i]));
  for(const [label,width,height] of [["full",1080,1920],["phone",270,480]]){
    const temporary=path.join(outputDir,".frame-batch-"+label);
    await fs.mkdir(temporary,{recursive:false});
    try {
      const selector=frames.map(frame=>\`eq(n\\\\,\${frame})\`).join("+");
      const filter=\`select=\${selector},scale=\${width}:\${height}:flags=lanczos\`;
      await execute(["-hide_banner","-loglevel","error","-nostdin","-y",
        "-i",video,"-vf",filter,"-fps_mode","passthrough",
        "-start_number","0",path.join(temporary,"%06d.png")]);
      for(const [i] of frames.entries()){
        const file=path.join(temporary,String(i).padStart(6,"0")+".png");
        if((await fs.stat(file)).size<100)throw Error("Missing or empty exact decoded frame: "+frames[i]);
      }
      const actual=(await fs.readdir(temporary)).filter(name=>name.endsWith(".png"));
      if(actual.length!==frames.length)
        throw Error("Frame decoder produced unexpected number of frames.");
      for(const request of requests) {
        const source=path.join(temporary,String(index.get(request.frame)).padStart(6,"0")+".png");
        const destination=path.join(outputDir,\`\${request.stem}-\${label}.png\`);
        await fs.copyFile(source,destination);
      }
    } finally {
      await fs.rm(temporary,{recursive:true,force:true});
    }
  }
  return {uniqueFrames:frames.length,ffmpegPasses:2,files:requests.length*2};
}
