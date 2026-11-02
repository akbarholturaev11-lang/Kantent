/**
 * M6 deterministic screenshot evidence for original HSK AI lesson stage.
 *
 * Hard checks: valid 8-bit PNG, visibly nonempty central scene, hero contained
 * in its known open-stage safe zone, and genuine *stage-region* difference
 * between distinct intended subjects. Subtitles/logo are outside the ROI.
 * Warnings: comparatively small hero occupancy. This is not human approval.
 * No runtime OCR, computer vision service or new npm dependency.
 */
import fs from "node:fs";
import path from "node:path";
import {inflateSync} from "node:zlib";
const PNG_MAGIC=Buffer.from([137,80,78,71,13,10,26,10]);
const fail=(m)=>{throw Error("Motion frame QA: "+m)};

export function decodeRgbPng(data){
  if(!Buffer.isBuffer(data)||data.length<64||!data.subarray(0,8).equals(PNG_MAGIC))fail("invalid PNG");
  let offset=8,width,height,depth,type,interlace,compression,filter;
  const chunks=[];
  while(offset+12<=data.length){
    const len=data.readUInt32BE(offset),end=offset+12+len;
    if(len>50_000_000||end>data.length)fail("corrupt PNG chunk length");
    const name=data.toString("ascii",offset+4,offset+8);
    const bytes=data.subarray(offset+8,offset+8+len);
    if(name==="IHDR"){
      if(len!==13)fail("invalid IHDR");
      width=bytes.readUInt32BE(0);height=bytes.readUInt32BE(4);
      depth=bytes[8];type=bytes[9];compression=bytes[10];filter=bytes[11];interlace=bytes[12];
    }
    if(name==="IDAT")chunks.push(bytes);
    offset=end;
    if(name==="IEND")break;
  }
  if(!width||!height||width>4096||height>4096||depth!==8||
     ![2,6].includes(type)||compression!==0||filter!==0||interlace!==0||!chunks.length)
    fail("unsupported PNG format (requires RGB/RGBA 8-bit, non-interlaced)");
  const bands=type===6?4:3,rowBytes=width*bands;
  const compressed=Buffer.concat(chunks);
  const inflated=inflateSync(compressed,{maxOutputLength:(rowBytes+1)*height});
  if(inflated.length!==(rowBytes+1)*height)fail("corrupt PNG pixel data");
  const rgb=Buffer.alloc(width*height*3);
  const prior=Buffer.alloc(rowBytes),current=Buffer.alloc(rowBytes);
  let cursor=0;
  for(let y=0;y<height;y++){
    const method=inflated[cursor++];
    if(method>4)fail("unsupported PNG filter");
    for(let x=0;x<rowBytes;x++){
      const raw=inflated[cursor++];
      const left=x>=bands?current[x-bands]:0,up=prior[x],upperLeft=x>=bands?prior[x-bands]:0;
      let predict=0;
      if(method===1)predict=left;
      if(method===2)predict=up;
      if(method===3)predict=Math.floor((left+up)/2);
      if(method===4){
        const p=left+up-upperLeft;
        const a=Math.abs(p-left),b=Math.abs(p-up),c=Math.abs(p-upperLeft);
        predict=a<=b&&a<=c?left:b<=c?up:upperLeft;
      }
      current[x]=(raw+predict)&255;
    }
    for(let x=0;x<width;x++){
      const out=(y*width+x)*3,idx=x*bands,alpha=bands===4?current[idx+3]/255:1;
      // Artwork is rendered on an opaque backdrop; handle alpha safely anyway.
      rgb[out]=Math.round(current[idx]*alpha);
      rgb[out+1]=Math.round(current[idx+1]*alpha);
      rgb[out+2]=Math.round(current[idx+2]*alpha);
    }
    current.copy(prior);
  }
  return {width,height,pixels:rgb};
}

const stageFor=(width,height)=>({
  x:Math.round(width*100/1080),y:Math.round(height*650/1920),
  width:Math.round(width*880/1080),height:Math.round(height*460/1920)
});
const visible=(r,g,b)=>{
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b);
  return mx>=145&&((mx-mn>=48)||((r+g+b)/3>=200));
};
const allowed=(roi,img)=>{
  const {x,y,width,height}=roi;
  return x>=0&&y>=0&&width>0&&height>0&&x+width<=img.width&&y+height<=img.height;
};

export function frameSignals(img,{roi=stageFor(img.width,img.height),minVisible=0.03}={}){
  if(!img||!Number.isInteger(img.width)||!Number.isInteger(img.height)||
     !Buffer.isBuffer(img.pixels)||img.pixels.length!==img.width*img.height*3||!allowed(roi,img))
    fail("invalid image or scene ROI");
  let count=0,minX=Infinity,minY=Infinity,maxX=-1,maxY=-1;
  for(let y=roi.y;y<roi.y+roi.height;y++){
    for(let x=roi.x;x<roi.x+roi.width;x++){
      const i=(y*img.width+x)*3;
      if(visible(img.pixels[i],img.pixels[i+1],img.pixels[i+2])){
        count++;minX=Math.min(minX,x);maxX=Math.max(maxX,x);
        minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      }
    }
  }
  const occupancy=count/(roi.width*roi.height);
  if(occupancy<minVisible||!count)fail("hero blank or too small in central stage: "+occupancy.toFixed(4));
  const bounds={left:minX,top:minY,right:maxX,bottom:maxY,width:maxX-minX+1,height:maxY-minY+1};
  const horizontalSafe=Math.max(12,Math.round(roi.width*0.025));
  const verticalSafe=Math.max(8,Math.round(roi.height*0.025));
  if(minX<roi.x+horizontalSafe||maxX>=roi.x+roi.width-horizontalSafe||
     minY<roi.y+verticalSafe||maxY>=roi.y+roi.height-verticalSafe)
    fail("visible hero touches or escapes stage safe margins");
  return {
    occupancy:Number(occupancy.toFixed(4)),visiblePixels:count,
    bounds,roi,
    warnings:[
      ...(occupancy<0.2?["small-hero-relative-to-stage"]:[]),
      ...(bounds.width<roi.width*0.45?["hero-horizontal-presence-below-45-percent"]:[])
    ],
  };
}
export function regionChangeRatio(a,b,roi=stageFor(a.width,a.height)){
  if(a.width!==b.width||a.height!==b.height||!allowed(roi,a))fail("pixel comparison dimensions mismatch");
  let changed=0;
  for(let y=roi.y;y<roi.y+roi.height;y++){
    for(let x=roi.x;x<roi.x+roi.width;x++){
      const i=(y*a.width+x)*3;
      const delta=Math.abs(a.pixels[i]-b.pixels[i])+
        Math.abs(a.pixels[i+1]-b.pixels[i+1])+
        Math.abs(a.pixels[i+2]-b.pixels[i+2]);
      if(delta>=90)changed++;
    }
  }
  return Number((changed/(roi.width*roi.height)).toFixed(4));
}
export function inspectMotionFrames(images,{roi,minimumChange=0.035}={}){
  if(!images||!Array.isArray(images)||images.length<2)fail("requires at least two semantic samples");
  const entries=images.map(({id,image})=>({id,image,metrics:frameSignals(image,{...(roi?{roi}:{})})}));
  if(entries.some(({id})=>!id))fail("sample lacks ID");
  const changes=[];
  for(let i=1;i<entries.length;i++){
    const ratio=regionChangeRatio(entries[i-1].image,entries[i].image,roi);
    if(ratio<minimumChange)fail(entries[i-1].id+" → "+entries[i].id+" has no meaningful artwork-region change: "+ratio);
    changes.push({from:entries[i-1].id,to:entries[i].id,changedRatio:ratio});
  }
  return {schemaVersion:1,publishable:false,meaningApproved:false,
    inspectionType:"deterministic-stage-pixels",samples:entries.map(({id,metrics})=>({id,...metrics})),
    semanticChanges:changes,requiresHumanReview:true};
}

if(process.argv[1]&&path.resolve(process.argv[1])===import.meta.filename){
  const args=process.argv.slice(2);
  if(args.length!==5)fail("usage: node scripts/motion-frame-qa.mjs <output.json> <book.png> <tea.png> <market.png> <textbook.png>");
  const [output,...files]=args;
  const names=["book","tea","market","textbook"];
  const report=inspectMotionFrames(files.map((file,i)=>({id:names[i],image:decodeRgbPng(fs.readFileSync(file))})));
  fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({samples:report.samples.map(x=>({id:x.id,occupancy:x.occupancy,warnings:x.warnings})),changes:report.semanticChanges}));
}
