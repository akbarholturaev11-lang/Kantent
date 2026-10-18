import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const studio = path.resolve(root, '../../hsk-tu-vous');
try { process.loadEnvFile(path.join(studio, '.env.local')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const profile = JSON.parse(await fs.readFile(path.join(studio, 'content/voice-profile.json'), 'utf8'));
if (profile.provider !== 'gemini-api') throw new Error('Current voice profile is not Gemini API.');
if (!process.env.GEMINI_API_KEY) throw new Error('Gemini API key is unavailable.');
const mode = process.argv[2] ?? 'sample';
if (!['sample', 'narration'].includes(mode)) throw new Error('Use sample or narration.');
const fullText = (await fs.readFile(path.join(root, 'tts-input.txt'), 'utf8')).trim();
const text = mode === 'sample' ? fullText.split(' Проходи уроки,')[0] : fullText;
const output = path.join(root, 'assets/voiceover', mode);
await fs.mkdir(output, {recursive:true});
const wavPath = path.join(output, 'voice.wav');
const mp3Path = path.join(output, 'voice.mp3');
try { await fs.access(wavPath); throw new Error('Audio already exists; refusing to regenerate.'); } catch(error) { if (error.code !== 'ENOENT') throw error; }
const content = {type:'text', text};
if (profile.spokenStyle) content.annotations = [{type:'speech_metadata', style:profile.spokenStyle}];
const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
  method:'POST', signal:AbortSignal.timeout(180000),
  headers:{'x-goog-api-key':process.env.GEMINI_API_KEY, 'Content-Type':'application/json', 'Api-Revision':'2026-05-20'},
  body:JSON.stringify({model:profile.ttsModel,input:[{type:'user_input',content:[content]}],response_format:{type:'audio'},generation_config:{speech_config:[{voice:profile.voiceName}]}})
});
const result = await response.json();
if (!response.ok) throw new Error(`Gemini speech failed (HTTP ${response.status}): ${String(result.error?.message??'').replace(/AIza[\w-]+/g,'[redacted]')}`);
const blocks = (result.steps??[]).filter(s=>s.type==='model_output').flatMap(s=>s.content??[]).filter(b=>b.type==='audio'&&b.data);
const encoded = result.output_audio?.data ?? blocks.at(-1)?.data;
if (!encoded) throw new Error('Gemini returned no audio.');
const bytes = Buffer.from(encoded,'base64');
if (bytes.subarray(0,4).toString() !== 'RIFF' || bytes.subarray(8,12).toString() !== 'WAVE') throw new Error('Expected WAV audio.');
await fs.writeFile(wavPath,bytes);
const runtime=path.join(studio,`node_modules/@remotion/compositor-${process.platform}-${process.arch}`);
const ffmpeg=path.join(runtime,'ffmpeg');
const ffprobe=path.join(runtime,'ffprobe');
const env={...process.env,DYLD_LIBRARY_PATH:runtime};
execFileSync(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-i',wavPath,'-map','0:a:0','-vn','-c:a','libmp3lame','-b:a',`${profile.mp3BitrateKbps??128}k`,'-map_metadata','-1','-n',mp3Path],{env,stdio:['ignore','pipe','pipe']});
const probe=JSON.parse(execFileSync(ffprobe,['-v','error','-show_entries','format=duration:stream=sample_rate,channels,codec_name','-of','json',mp3Path],{env,encoding:'utf8'}));
const metadata={status:'audio-generated',mode,provider:'gemini-api',model:profile.ttsModel,voice:profile.voiceName,sourceProfile:profile.profileId,ownerInstruction:'gemini API orqaliy ishlat',textSha256:createHash('sha256').update(text).digest('hex'),durationSeconds:Number(probe.format.duration),streams:probe.streams,reviewApprovalPending:true,documentation:'https://ai.google.dev/gemini-api/docs/speech-generation'};
await fs.writeFile(path.join(output,'metadata.json'),JSON.stringify(metadata,null,2)+'\n');
await fs.writeFile(path.join(output,'tts-input.txt'),text+'\n');
console.log(JSON.stringify({status:metadata.status,mode,voice:metadata.voice,durationSeconds:metadata.durationSeconds,file:mp3Path}));
