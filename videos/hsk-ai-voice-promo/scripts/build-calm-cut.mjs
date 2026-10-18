import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const timing = JSON.parse(await fs.readFile(path.join(root, 'timeline.json'), 'utf8'));
const segments = [
  {id: '01-hook', from: 0, to: 11.597, title: 'Speaking pause', voiceFrames: [1, 2]},
  {id: '02-study', from: 11.597, to: 18.947, title: 'Course to conversation', voiceFrames: [3]},
  {id: '03-ai-voice', from: 18.947, to: 49.606, title: 'AI Voice demonstration', voiceFrames: [4, 5, 6, 7]},
  {id: '04-cta', from: 49.606, to: 60, title: 'Download HSK AI', voiceFrames: [8]},
];

const css = `
@font-face{font-family:Inter;src:url('assets/fonts/InterVariable.woff2') format('woff2');font-weight:100 900;font-style:normal;font-display:block}
*{box-sizing:border-box}
html,body,#root{margin:0;width:100%;height:100%;overflow:hidden}
#root{position:absolute;inset:0;background:#211D17;color:#FDF9F0;font-family:Inter,sans-serif}
.shot{position:absolute;inset:0;overflow:hidden;background:#211D17;color:#FDF9F0}
.accent{color:#E9A916}
.brand-mark{position:absolute;z-index:3;left:68px;top:66px;display:flex;align-items:center;gap:18px;color:#FDF9F0;font-size:34px;font-weight:800;letter-spacing:.045em}
.brand-mark img{display:block;width:78px;height:78px;object-fit:contain}
.hook-photo{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform-origin:50% 42%}
.hook-band{position:absolute;inset:auto 0 0;height:690px;padding:66px 72px 160px;background:#E9A916;color:#211D17}
.hook-title{margin:0;font-size:92px;line-height:.98;font-weight:850;letter-spacing:-.045em;text-transform:lowercase}
.course-title{position:absolute;z-index:2;left:72px;right:72px;top:80px;margin:0;font-size:108px;line-height:.94;font-weight:850;letter-spacing:-.045em;text-transform:lowercase}
.course-window{position:absolute;inset:405px 0 0;overflow:hidden;background:#FDF9F0}
.course-window img{position:absolute;top:-370px;left:0;width:1080px;height:auto;max-width:none}
.voice-full{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center center;transform-origin:50% 52%}
.cta-title{position:absolute;left:68px;right:68px;top:212px;margin:0;font-size:96px;line-height:1.02;font-weight:850;letter-spacing:-.045em;text-transform:lowercase}
.links-screen{position:absolute;left:38px;right:38px;top:420px}
.links-screen img{display:block;width:100%;height:auto}
`;

const brand = `<div class="brand-mark"><img src="assets/brand-logo.png" alt=""><span>HSK AI</span></div>`;
const files = [
  `<div class="shot"><img class="hook-photo" src="assets/editorial/speaking-pause.png" alt="A Chinese-language learner pauses before speaking">${brand}<div class="hook-band"><h1 class="hook-title">знаешь слова.<br>трудно заговорить?</h1></div></div>`,
  `<div class="shot"><h1 class="course-title">от слов —<br><span class="accent">к разговору</span></h1><div class="course-window"><img data-layout-allow-overflow src="assets/product/course.png" alt="Genuine HSK AI course map and lessons"></div></div>`,
  `<div class="shot"><img class="voice-full" src="assets/product/voice.png" alt="Genuine HSK AI AI Voice conversation screen"></div>`,
  `<div class="shot">${brand}<h1 class="cta-title">попробуй <span class="accent">HSK AI</span></h1><div class="links-screen"><img src="assets/cta/links.png" alt="Genuine HSK AI download and Telegram links page"></div></div>`,
];

const motion = [
  (id, duration) => `const tl=gsap.timeline({paused:true});tl.fromTo('#f-${id}-photo',{scale:1},{scale:1.035,duration:${duration},ease:'none'},0);tl.fromTo('#f-${id}-band',{y:18,opacity:0},{y:0,opacity:1,duration:.45,ease:'power3.out'},.12);window.__timelines['${id}']=tl;`,
  (id, duration) => `const tl=gsap.timeline({paused:true});tl.fromTo('#f-${id}-title',{y:18,opacity:0},{y:0,opacity:1,duration:.42,ease:'power2.out'},.12);tl.fromTo('#f-${id}-course-window img',{y:0},{y:-80,duration:${duration},ease:'none'},0);window.__timelines['${id}']=tl;`,
  (id, duration) => `const tl=gsap.timeline({paused:true});tl.fromTo('#f-${id}-screen',{scale:1},{scale:1.09,duration:${duration},ease:'none'},0);window.__timelines['${id}']=tl;`,
  (id, duration) => `const tl=gsap.timeline({paused:true});tl.fromTo('#f-${id}-brand',{opacity:0,y:8},{opacity:1,y:0,duration:.35,ease:'power2.out'},.08);tl.fromTo('#f-${id}-title',{opacity:0,y:12},{opacity:1,y:0,duration:.42,ease:'power2.out'},.18);tl.fromTo('#f-${id}-links',{opacity:0},{opacity:1,duration:.48,ease:'power2.out'},.3);window.__timelines['${id}']=tl;`,
];

for (let i = 0; i < segments.length; i++) {
  const segment = segments[i];
  const duration = segment.to - segment.from + (i < segments.length - 1 ? .6 : 0);
  const id = segment.id;
  let markup = files[i].replace('<div class="shot">', '').replace(/<\/div>$/, '');
  if (i === 0) markup = markup.replace('class="hook-photo"', `id="f-${id}-photo" class="hook-photo"`).replace('class="hook-band"', `id="f-${id}-band" class="hook-band"`);
  if (i === 1) markup = markup.replace('class="course-title"', `id="f-${id}-title" class="course-title"`).replace('class="course-window"', `id="f-${id}-course-window" class="course-window"`);
  if (i === 2) markup = markup.replace('class="voice-full"', `id="f-${id}-screen" class="voice-full"`);
  if (i === 3) markup = markup.replace('class="brand-mark"', `id="f-${id}-brand" class="brand-mark"`).replace('class="cta-title"', `id="f-${id}-title" class="cta-title"`).replace('class="links-screen"', `id="f-${id}-links" class="links-screen"`).replace('class="cta-copy"', `id="f-${id}-copy" class="cta-copy"`);
  const finalInner = `<div id="root" data-composition-id="${id}" data-width="1080" data-height="1920" data-duration="${duration.toFixed(6)}"><div id="f-${id}-shot" class="clip shot" data-start="0" data-duration="${duration.toFixed(6)}" data-track-index="0">${markup}</div></div>`;
  const js = motion[i](id, duration);
  const html = `<!doctype html><template><style>${css}</style>${finalInner}<script>${js}</script></template>`;
  await fs.writeFile(path.join(root, 'compositions/frames', `${id}.html`), html);
}

const audio = timing.frames.map(frame => `<audio id="voice-${frame.id}" src="assets/voiceover/narration/scene-${String(frame.id).padStart(2, '0')}.wav" data-start="${frame.start}" data-duration="${frame.duration}" data-track-index="10" data-volume="1"></audio>`).join('\n');
const comps = segments.map((segment, i) => {
  const duration = segment.to - segment.from + (i < segments.length - 1 ? .6 : 0);
  return `<div id="scene-${segment.id}" class="scene" data-composition-id="${segment.id}" data-composition-src="compositions/frames/${segment.id}.html" data-start="${segment.from}" data-duration="${duration.toFixed(6)}" data-track-index="${i}"></div>`;
}).join('\n');
const fades = segments.slice(1).map((segment, i) => `tl.to('#scene-${segments[i].id}',{opacity:0,duration:.6,ease:'power2.inOut'},${segment.from});tl.fromTo('#scene-${segment.id}',{opacity:0},{opacity:1,duration:.6,ease:'power2.inOut'},${segment.from});`).join('\n');
const index = `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=1080,height=1920"><script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script><style>*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#211D17}#root{position:relative;width:1080px;height:1920px;overflow:hidden;background:#211D17}.scene{position:absolute;inset:0;width:100%;height:100%}</style></head><body><div id="root" data-composition-id="main" data-start="0" data-duration="60" data-width="1080" data-height="1920">${comps}${audio}<div id="el-captions" data-track-kind="captions" class="scene" data-composition-id="captions" data-composition-src="compositions/captions.html" data-start="0" data-duration="60" data-track-index="2"></div></div><script>window.__timelines=window.__timelines||{};window.__timelines.main=gsap.timeline({paused:true});(function(){const tl=window.__timelines.main;tl.fromTo('#scene-${segments[0].id}',{opacity:0},{opacity:1,duration:.5,ease:'power2.out'},0);${fades}tl.to({}, {duration:60},0)})();</script></body></html>`;
await fs.writeFile(path.join(root, 'index.html'), index);

let captionHtml = await fs.readFile(path.join(root, 'compositions/captions.html'), 'utf8');
captionHtml = captionHtml.replace(/tl\.fromTo\('#cap-[^;]+;tl\.to\('#cap-[^;]+;/g, '');
captionHtml = captionHtml.replace(/<span id="cap-[^"]+">([^<]*)<\/span>/g, '$1');
captionHtml = captionHtml.replace(/\.caption-text span\{[^}]*\}/g, '');
captionHtml = captionHtml.replace(/\.caption-text\{[^}]*\}/, '.caption-text{position:absolute;left:4%;right:4%;top:80%;margin:0;padding:18px 36px;background:rgba(33,29,23,.96);border-top:2px solid #E9A916;color:#FDF9F0;font-size:46px;line-height:1.2;font-weight:650;text-align:center}');
await fs.writeFile(path.join(root, 'compositions/captions.html'), captionHtml);

const production = {...timing, frames: segments.map((segment, i) => ({id: i + 1, title: segment.title, start: segment.from, end: segment.to, duration: segment.to - segment.from, src: `compositions/frames/${segment.id}.html`, voiceFrames: segment.voiceFrames}))};
await fs.writeFile(path.join(root, 'calm-cut-timeline.json'), JSON.stringify(production, null, 2) + '\n');
await fs.writeFile(path.join(root, 'STORYBOARD.md'), `# HSK AI · AI Voice promo\n\n- Format: 1080×1920, portrait, 60 seconds\n- Narration: previously approved Gemini Kore track kept unchanged\n- Cut: four continuous story sections with restrained 0.6-second dissolves\n- Opening: one natural, text-free illustrative photograph; it contains no app interface\n- Product demonstration: only genuine existing HSK AI course, AI Voice, and download-link screenshots\n- Language: Russian narration/captions; the genuine mobile AI Voice screenshot is in Tajik\n\n| Time | Picture |\n| --- | --- |\n${segments.map(segment => `| ${segment.from.toFixed(3)}–${segment.to.toFixed(3)} | ${segment.title} |`).join('\n')}\n`);
console.log(JSON.stringify({shots: segments.length, duration: 60, voiceClips: timing.frames.length, voiceUnchanged: true}));
