import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const studio=path.resolve(root,'../../hsk-tu-vous');
process.loadEnvFile(path.join(studio,'.env.local'));
const profile=JSON.parse(await fs.readFile(path.join(studio,'content/voice-profile.json'),'utf8'));
const folder=path.join(root,'assets/voiceover/narration');
const repair=process.argv[2]==='timing-repair';
const mp3=await fs.readFile(path.join(folder,repair?'timing-repair.mp3':'voice.mp3'));
const prefix=repair?'timing-repair':'word';
const headers={'x-goog-api-key':process.env.GEMINI_API_KEY,'Content-Type':'application/json','Api-Revision':'2026-05-20'};
const api='https://generativelanguage.googleapis.com';
async function json(url,options,label){
 const response=await fetch(url,{...options,signal:AbortSignal.timeout(180000)});
 const body=await response.text();
 let data={};
 if(body){try{data=JSON.parse(body);}catch{throw new Error(`${label}: non-JSON response (HTTP ${response.status})`);}}
 if(!response.ok)throw new Error(`${label}: HTTP ${response.status}: ${String(data.error?.message??'').replace(/AIza[\w-]+/g,'[redacted]')}`);
 return {data,headers:response.headers};
}
const start=await json(`${api}/upload/v1beta/files`,{method:'POST',headers:{...headers,'X-Goog-Upload-Protocol':'resumable','X-Goog-Upload-Command':'start','X-Goog-Upload-Header-Content-Length':String(mp3.length),'X-Goog-Upload-Header-Content-Type':'audio/mpeg'},body:JSON.stringify({file:{display_name:'hsk-ai-voice-promo-narration'}})},'Upload initialization');
const uploadURL=start.headers.get('x-goog-upload-url');
if(!uploadURL||new URL(uploadURL).protocol!=='https:'||!new URL(uploadURL).hostname.endsWith('.googleapis.com'))throw new Error('Invalid secure upload URL.');
const upload=await json(uploadURL,{method:'POST',headers:{'Content-Length':String(mp3.length),'X-Goog-Upload-Offset':'0','X-Goog-Upload-Command':'upload, finalize','Content-Type':'audio/mpeg'},body:mp3},'Audio upload');
const file=upload.data.file??upload.data;
if(!/^files\/[a-z0-9-]+$/.test(file.name??''))throw new Error('Invalid temporary file reference.');
try{
 const result=await json(`${api}/v1beta/interactions`,{method:'POST',headers,body:JSON.stringify({model:profile.transcriptionModel,input:[{type:'audio',uri:file.uri,mime_type:'audio/mpeg'}],generation_config:{transcription_config:{language_codes:[],mode:{type:'verbatim',timestamp_granularities:['word']}}}})},'Word transcription');
 await fs.writeFile(path.join(folder,repair?'timing-repair-response.json':'transcription-response.json'),JSON.stringify(result.data,null,2)+'\n');
 const words=(result.data.steps??[]).flatMap(s=>s.content??[]).flatMap(c=>c.annotations??[]).filter(a=>a.type==='word_info'&&a.text&&a.start_offset!==undefined&&a.end_offset!==undefined);
 if(!words.length)throw new Error('No word timestamps returned.');
 const raw={model:profile.transcriptionModel,words:words.map(w=>({text:w.text,startOffset:w.start_offset,endOffset:w.end_offset}))};
 await fs.writeFile(path.join(folder,`${prefix}-timestamps.json`),JSON.stringify(raw,null,2)+'\n');
 console.log(JSON.stringify({status:'word-timestamps-generated',wordCount:words.length,file:path.join(folder,`${prefix}-timestamps.json`)}));
}finally{
 const result=await fetch(`${api}/v1beta/${file.name}`,{method:'DELETE',headers:{'x-goog-api-key':process.env.GEMINI_API_KEY,'Api-Revision':'2026-05-20'}});
 if(!result.ok)console.error(`Temporary generated audio cleanup: HTTP ${result.status}`);
}
