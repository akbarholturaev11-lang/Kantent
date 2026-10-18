import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const folder=path.join(root,'assets/voiceover/narration');
const raw=JSON.parse(await fs.readFile(path.join(folder,'word-timestamps.json'),'utf8'));
const metadata=JSON.parse(await fs.readFile(path.join(folder,'metadata.json'),'utf8'));
const script=(await fs.readFile(path.join(root,'tts-input.txt'),'utf8')).trim();
const storyboard=await fs.readFile(path.join(root,'STORYBOARD.md'),'utf8');
const normalize=t=>t.toLowerCase().replaceAll('ё','е').replace(/^v$/,'в');
const parts=t=>(t.match(/[\p{L}\p{N}]+/gu)??[]).map(normalize);
const source=script.split(/\s+/).map(text=>({text,parts:parts(text)})).filter(w=>w.parts.length);
const expected=source.flatMap((w,i)=>w.parts.map(text=>({text,index:i})));
const seconds=t=>typeof t==='number'?t:Number(t.replace(/s$/,''));
const clipPass=JSON.parse(await fs.readFile(path.join(folder,'timing-repair-timestamps.json'),'utf8'));
const russianPass={words:clipPass.words.map(w=>({...w,startOffset:`${13+seconds(w.startOffset)}s`,endOffset:`${13+seconds(w.endOffset)}s`}))};
const repairs=[];
for(let i=1;i<raw.words.length;i++){
 const w=raw.words[i];
 if(seconds(w.startOffset)<seconds(raw.words[i-1].startOffset)){
  const candidates=russianPass.words.filter(r=>normalize(r.text)===normalize(w.text)&&Math.abs(seconds(r.endOffset)-seconds(w.endOffset))<.02&&seconds(r.startOffset)>=seconds(raw.words[i-1].endOffset)&&seconds(r.startOffset)<seconds(w.endOffset));
  if(candidates.length!==1)throw new Error('Out-of-order timestamp cannot be verified against the independent Russian transcription.');
  repairs.push({text:w.text,originalStart:w.startOffset,verifiedStart:candidates[0].startOffset,source:'timing-repair-timestamps.json',clipSourceStart:13});
  w.startOffset=candidates[0].startOffset;
 }
}
const recognized=raw.words.flatMap(w=>parts(w.text).map(text=>({text,start:seconds(w.startOffset),end:Math.max(seconds(w.endOffset),seconds(w.startOffset)+.001)})));
const mismatch=[];
if(expected.length!==recognized.length)mismatch.push({kind:'count',expected:expected.length,recognized:recognized.length});
for(let i=0;i<Math.min(expected.length,recognized.length);i++)if(expected[i].text!==recognized[i].text)mismatch.push({index:i,expected:expected[i].text,recognized:recognized[i].text});
if(mismatch.length){await fs.writeFile(path.join(folder,'alignment-errors.json'),JSON.stringify(mismatch,null,2)+'\n');throw new Error('Narration transcript does not match approved script.');}
const cues=source.map((w,i)=>{const matches=recognized.filter((r,j)=>expected[j].index===i);return {text:w.text,start:Math.min(...matches.map(m=>m.start)),end:Math.max(...matches.map(m=>m.end))};});
for(let i=0;i<cues.length;i++){if(!(cues[i].end>cues[i].start&&cues[i].start>=0&&cues[i].end<=metadata.durationSeconds+.1))throw new Error('Invalid word timing.');if(i&&cues[i].start<cues[i-1].start)throw new Error('Word order timing failed.');}
const frames=[...storyboard.matchAll(/## Frame (\d+) — ([^\n]+)\n([\s\S]*?)(?=\n## Frame |$)/g)].map(m=>({id:Number(m[1]),title:m[2],voiceover:m[3].match(/- voiceover: "([^"]+)"/)[1],planned:Number(m[3].match(/- duration: ([\d.]+)s/)[1])}));
if(frames.map(f=>f.voiceover).join(' ')!==script)throw new Error('Frame script differs from exact narration.');
let wordIndex=0;
for(const f of frames){f.firstWord=wordIndex;wordIndex+=f.voiceover.split(/\s+/).filter(w=>parts(w).length).length;f.lastWord=wordIndex-1;}
if(wordIndex!==cues.length)throw new Error('Frame word partition failed.');
const cuts=[0,...frames.slice(1).map(f=>(cues[f.firstWord-1].end+cues[f.firstWord].start)/2),metadata.durationSeconds];
for(let i=0;i<frames.length;i++){const f=frames[i];f.sourceStart=cuts[i];f.sourceEnd=cuts[i+1];f.rawDuration=f.sourceEnd-f.sourceStart;f.duration=Math.max(f.planned,f.rawDuration+.3);}
const excess=frames.reduce((n,f)=>n+f.duration,0)-60;
if(excess>0){const available=frames.reduce((n,f)=>n+Math.max(0,f.duration-f.rawDuration-.3),0);if(available<excess)throw new Error('Narration cannot fit 60 seconds without changing speech.');for(const f of frames)f.duration-=excess*Math.max(0,f.duration-f.rawDuration-.3)/available;}
for(let i=0;i<frames.length-1;i++)frames[i].duration=Math.round(frames[i].duration*1000)/1000;
frames.at(-1).duration=Math.round((60-frames.slice(0,-1).reduce((n,f)=>n+f.duration,0))*1000)/1000;
let timelineStart=0;
const timelineCues=[];
const runtime=path.resolve(root,`../../hsk-tu-vous/node_modules/@remotion/compositor-${process.platform}-${process.arch}`);
const env={...process.env,DYLD_LIBRARY_PATH:runtime};
const chunks=[];
for(const f of frames){
 f.start=timelineStart;f.end=f.start+f.duration;f.pauseAdded=f.duration-f.rawDuration;
 f.words=cues.slice(f.firstWord,f.lastWord+1).map(c=>({...c,start:c.start-f.sourceStart,end:c.end-f.sourceStart}));
 timelineCues.push(...f.words.map(w=>({...w,start:w.start+f.start,end:w.end+f.start})));
 const chunk=path.join(folder,`scene-${String(f.id).padStart(2,'0')}.wav`);
 execFileSync(path.join(runtime,'ffmpeg'),['-hide_banner','-loglevel','error','-nostdin','-i',path.join(folder,'voice.wav'),'-af',`atrim=start=${f.sourceStart}:end=${f.sourceEnd},asetpts=PTS-STARTPTS,apad=pad_dur=${Math.max(0,f.pauseAdded)},atrim=duration=${f.duration}`,'-ar','48000','-ac','1','-c:a','pcm_s16le','-y',chunk],{env,stdio:['ignore','pipe','pipe']});
 chunks.push(chunk);timelineStart=f.end;
}
const concat=path.join(folder,'concat.txt');
await fs.writeFile(concat,chunks.map(p=>`file '${p.replaceAll("'","'\\''")}'`).join('\n')+'\n');
execFileSync(path.join(runtime,'ffmpeg'),['-hide_banner','-loglevel','error','-nostdin','-f','concat','-safe','0','-i',concat,'-t','60','-ar','48000','-ac','1','-c:a','pcm_s16le','-y',path.join(folder,'timeline.wav')],{env,stdio:['ignore','pipe','pipe']});
await fs.writeFile(path.join(root,'timeline.json'),JSON.stringify({duration:60,voice:metadata.voice,sourceDuration:metadata.durationSeconds,timestampRepairs:repairs,normalization:['Latin v → Russian в in ASR only','Hyphenated words normalized into lexical parts','ё/е equivalent in matching','One zero-length ASR cue expanded to the minimum 1 ms'],frames},null,2)+'\n');
await fs.writeFile(path.join(root,'caption-words.json'),JSON.stringify(timelineCues,null,2)+'\n');
const timestamp=t=>{const ms=Math.round(t*1000);return `${String(Math.floor(ms/3600000)).padStart(2,'0')}:${String(Math.floor(ms/60000)%60).padStart(2,'0')}:${String(Math.floor(ms/1000)%60).padStart(2,'0')}.${String(ms%1000).padStart(3,'0')}`;};
await fs.writeFile(path.join(root,'captions.vtt'),'WEBVTT\n\n'+timelineCues.map(w=>`${timestamp(w.start)} --> ${timestamp(w.end)}\n${w.text}`).join('\n\n')+'\n');
metadata.reviewApprovalPending=false;metadata.transcriptVerified=true;metadata.exactScriptWordCount=cues.length;metadata.timelineDurationSeconds=60;
await fs.writeFile(path.join(folder,'metadata.json'),JSON.stringify(metadata,null,2)+'\n');
console.log(JSON.stringify({status:'verified',wordCount:cues.length,duration:60,frames:frames.map(f=>({id:f.id,start:Number(f.start.toFixed(3)),duration:Number(f.duration.toFixed(3)),pause:Number(f.pauseAdded.toFixed(3))}))}));
