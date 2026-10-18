from pathlib import Path
import json, shutil, hashlib
from datetime import datetime, timezone

project = Path(__file__).resolve().parents[1]
report = project.parents[1] / 'reports' / 'hsk-ai-voice-60s'
video = project / 'renders' / 'hsk-ai-ai-voice-60s.mp4'
probe = json.loads((project / '.hyperframes/final-probe.json').read_text())
streams = probe.get('output', {}).get('streams', [])
if not video.is_file() or video.stat().st_size < 100000:
    raise SystemExit('A completed video is required.')
qa = json.loads((project / 'QA.json').read_text())
if not qa.get('mediaValidation', {}).get('decodePassed'):
    raise SystemExit('Verify video decoding before creating the handoff.')

filename = video.name
shutil.copy2(video, report / filename)
for name in ['captions.srt', 'captions.vtt']:
    shutil.copy2(project / name, report / name)
shutil.copy2(project / 'renders' / 'poster.png', report / 'poster.png')
shutil.copy2(project / 'STORYBOARD.md', report / 'STORYBOARD.md')
page = report / 'storyboard.html'
backup = report / 'storyboard-v3-approved.html'
if not backup.exists():
    shutil.copy2(page, backup)
s = backup.read_text()
s = s.replace('<title>HSK AI · AI Voice — 60s storyboard v3</title>', '<title>HSK AI · AI Voice — 60 soniyalik rolik</title>')
style = '''
.review{display:grid;grid-template-columns:minmax(0,390px) minmax(0,1fr);gap:48px;align-items:center;margin:18px 0 40px}.review video{display:block;width:100%;height:auto;aspect-ratio:9/16;background:#FDF9F0;border-radius:18px;box-shadow:0 12px 40px #211D1712}.review h2{font-size:30px;line-height:1.15;letter-spacing:-.03em;margin:0 0 18px}.review p{line-height:1.6;color:var(--muted);max-width:540px}.download{display:inline-block;background:var(--ink);color:var(--paper);padding:14px 20px;text-decoration:none;border-radius:10px;font-weight:700;margin-top:12px}.subtitles{display:block;margin-top:18px;color:var(--muted);font-size:14px}.approved-plan>summary{font-size:16px;padding:18px 0;border-top:1px solid var(--line)}.approved-plan{margin-top:24px}
@media(max-width:760px){.review{grid-template-columns:1fr;gap:24px}.review video{max-width:390px;margin:auto}.review h2{font-size:25px}}
'''
s = s.replace('</style>', style + '</style>')
start = s.index('<header>')
end = s.index('</header>', start) + len('</header>')
header = '''<header>
<div class="eyebrow">HSK AI · AI Voice · reklama roligi</div>
<h1>So‘zlardan — <span>suhbatga.</span></h1>
<div class="meta"><span>60 soniya</span><span>4 ta sahna</span><span>1080 × 1920 · 9:16</span><span>Gemini Kore · ruscha ovoz</span><span>Subtitrli MP4</span></div>
</header>
<section class="review" aria-label="Tayyor reklama roligi">
<video id="ad-video" controls playsinline preload="metadata" poster="poster.png?v=6" aria-label="HSK AI va AI Voice — 60 soniyalik reklama"><source src="hsk-ai-ai-voice-60s.mp4?v=6" type="video/mp4"></video>
<div><h2>60 soniyalik rolik tayyor.</h2><p>Gapirishdagi qiyinchilikdan boshlanadi. Kirishdagi foto faqat vaziyatni ifodalovchi illyustratsiya; kurs, AI Voice va yuklab olish lavhalari HSK AI’ning haqiqiy ekranlaridir. Tasdiqlangan ovoz va ruscha subtitrlar o‘zgarishsiz.</p><p>AI Voice ekranidagi matn tojikcha; ovoz, sarlavhalar va subtitrlar ruscha.</p><a class="download" href="hsk-ai-ai-voice-60s.mp4?v=6" download>MP4 videoni yuklab olish</a><a class="subtitles" href="captions.srt" download>SRT subtitrlarni yuklab olish</a></div>
</section>
<details class="approved-plan"><summary>Tasdiqlangan kadrlar rejasi — v3 eskiz</summary>
'''
s = s[:start] + header + s[end:]
s = s.replace('<footer>To‘liq ssenariy:', '</details>\n<footer>To‘liq ssenariy:')
s = s.replace('Versiya v3 · Och asos va mazmunga mos rangli qismlar · Ssenariy 60 soniya · Ovoz va animatsiya keyingi bosqichda.', 'Tayyor MP4 · 60 soniya · Gemini Kore ovozi · Ruscha subtitrlar · Mavjud haqiqiy HSK AI ekranlari.')
page.write_text(s)
status = {
    'stage':'complete', 'scriptApproved':True, 'visualVersion':6, 'visualApproved':False,
    'visualApprovalMessage':'Rebuilt as a restrained four-scene cut with genuine HSK AI screens; the opening photo is illustrative. Preview is ready for review.',
    'visualScenes':4, 'visualSceneMerge':'8 cuts to 4 continuous scenes; owner requested fewer cringe scenes',
    'targetDurationSeconds':60, 'actualDurationSeconds':qa['mediaValidation']['durationSeconds'],
    'voice':'Gemini Kore', 'voiceApproved':True, 'audioCreated':True,
    'wordCuesCreated':True, 'animationBuilt':True, 'finalVideoCreated':True,
    'videoFile':filename, 'captionsFile':'captions.srt',
    'videoSha256':hashlib.sha256(video.read_bytes()).hexdigest(),
    'sourceMode':'Illustrative opening photograph; all product screens use the owner-provided genuine screenshots.',
    'appLanguageRestored':True, 'publishingAuthorized':False,
    'completedAt':datetime.now(timezone.utc).isoformat(),
}
(report / 'production-status.json').write_text(json.dumps(status,ensure_ascii=False,indent=2)+'\n')
print(f'Review prepared: {page}')
print(f'Video: {report / filename}')
