import test from "node:test";
import assert from "node:assert/strict";
import {deflateSync} from "node:zlib";
import {decodeRgbPng,frameSignals,regionChangeRatio,inspectMotionFrames} from "./motion-frame-qa.mjs";
const chunk=(type,data)=>{
 const body=Buffer.concat([Buffer.from(type),data]);
 // CRC not needed for this decoder's shape/pixel validation; fixture chunks
 // are synthetic local tests and never used as external image inputs.
 const header=Buffer.alloc(4),footer=Buffer.alloc(4);
 header.writeUInt32BE(data.length);
 return Buffer.concat([header,body,footer]);
};
const png=(w,h,rgb)=>{
 const header=Buffer.alloc(13);
 header.writeUInt32BE(w,0);header.writeUInt32BE(h,4);
 header[8]=8;header[9]=2;
 const raw=Buffer.alloc((w*3+1)*h);
 for(let y=0;y<h;y++){const row=y*(w*3+1);raw[row]=0;rgb.copy(raw,row+1,y*w*3,(y+1)*w*3);}
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk("IHDR",header),chunk("IDAT",deflateSync(raw)),chunk("IEND",Buffer.alloc(0))]);
};
const image=(x0,y0)=>{
 const width=96,height=80,colors=Buffer.alloc(width*height*3,20);
 for(let y=y0;y<y0+30;y++)for(let x=x0;x<x0+24;x++){
  const index=(y*width+x)*3;
  colors[index]=245;colors[index+1]=180;colors[index+2]=35;
 }
 return decodeRgbPng(png(width,height,colors));
};
const roi={x:10,y:10,width:75,height:60};

test("PNG decoder recovers exact RGB pixels from an uncompressed-row synthetic fixture",()=>{
 const a=image(24,20);
 assert.equal(a.width,96);assert.equal(a.height,80);
 assert.deepEqual([...a.pixels.subarray((20*96+24)*3,(20*96+24)*3+3)],[245,180,35]);
});
test("bounded subject occupancy and artwork-only differences are measured",()=>{
 const a=image(24,20),b=image(49,20);
 const first=frameSignals(a,{roi,minVisible:0.03});
 assert.ok(first.occupancy>0.1);
 assert.equal(first.bounds.left,24);
 assert.ok(regionChangeRatio(a,b,roi)>0.15);
 assert.equal(regionChangeRatio(a,a,roi),0);
 const report=inspectMotionFrames([{id:"book",image:a},{id:"cup",image:b}],{roi,minimumChange:0.05});
 assert.equal(report.publishable,false);
 assert.equal(report.semanticChanges.length,1);
});
test("duplicate unchanged hero, cropped hero and blank slide block QA",()=>{
 const a=image(24,20);
 assert.throws(()=>inspectMotionFrames([{id:"one",image:a},{id:"two",image:a}],{roi}),/no meaningful artwork-region change/);
 assert.throws(()=>frameSignals(image(8,20),{roi}),/safe margins/);
 const blank={width:96,height:80,pixels:Buffer.alloc(96*80*3,15)};
 assert.throws(()=>frameSignals(blank,{roi}),/blank or too small/);
});
test("corrupt or unsupported PNG fails before any published-video conclusion",()=>{
 assert.throws(()=>decodeRgbPng(Buffer.from("not a PNG")) ,/invalid PNG/);
 assert.throws(()=>regionChangeRatio(image(24,20),{width:1,height:1,pixels:Buffer.alloc(3)},roi),/dimensions mismatch/);
});
