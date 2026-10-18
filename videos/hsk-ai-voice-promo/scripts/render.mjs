import {spawn} from 'node:child_process';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const project = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const child = spawn('npx', [
  '--yes', 'hyperframes@0.8.148', 'render',
  '--skill', 'product-launch-video', '--quality', 'high', '--fps', '30',
  '--output', 'renders/hsk-ai-ai-voice-60s.mp4', ...process.argv.slice(2),
], {
  cwd: project, stdio: 'inherit',
  env: {...process.env, PATH: `${resolve(project, '.hyperframes/runtime-bin')}:${process.env.PATH ?? ''}`},
});
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
