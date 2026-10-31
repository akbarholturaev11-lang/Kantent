#!/usr/bin/env python3
"""Read-only, scene-level HSK AI review MP4 from an existing Gemini WAV.

Not for publication: scenes use real audio + estimated scene boundaries;
word-level subtitles, CTA-sync claims and production approval are NOT generated.
No API keys, no TTS, no edit of the original episode or canonical renderer.
"""
from __future__ import annotations
import argparse,hashlib,json,math,re,subprocess,tempfile,wave
from pathlib import Path

import numpy as np
from PIL import Image,ImageDraw,ImageFont

W,H,FPS=1080,1920,30

def digest(raw):return hashlib.sha256(raw).hexdigest()
def ff(cmd):subprocess.run(cmd,check=True)
def ft(size,bold=False,cjk=False):
    choices=(["/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
              "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"] if cjk else
             ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"])
    for name in choices:
        if Path(name).exists():return ImageFont.truetype(name,size)
    raise RuntimeError("Missing review font; install fonts-noto-cjk fonts-dejavu-core")

def txtfont(s,size,bold=False):
    return ft(size,bold,cjk=bool(re.search(r"[\u3400-\u9fff]",str(s))))

def wrap(draw,text,font,maxwidth):
    words=str(text).split()
    lines=[];buf=""
    for word in words:
        candidate=(buf+" "+word).strip()
        if buf and draw.textbbox((0,0),candidate,font=font)[2]>maxwidth:
            lines.append(buf);buf=word
        else:buf=candidate
    return lines+([buf] if buf else [])

def centered(draw,text,size,y,color,bold=False,maxwidth=880,space=14):
    font=txtfont(text,size,bold)
    for line in wrap(draw,text,font,maxwidth):
        width=draw.textbbox((0,0),line,font=font)[2]
        draw.text(((W-width)/2,y),line,font=font,fill=color)
        y+=size+space

def slide(scene,index,n,lang,colors,path):
    bg=colors["background"];fg=colors["foreground"];teal=colors["brandTeal"]
    muted=colors["muted"];border=colors["border"]
    red=colors["brandRed"];gold=colors["brandGold"]
    canvas=Image.new("RGB",(W,H),bg);d=ImageDraw.Draw(canvas)
    d.rectangle((0,0,W,15),fill=red if index%2==0 else teal)
    d.rounded_rectangle((70,70,325,137),radius=23,fill=colors["surface"],outline=border,width=3)
    d.text((96,87),"HSK AI",font=ft(31,True),fill=fg)
    step=f"REVIEW  {index+1:02d}/{n:02d}"
    d.text((743,94),step,font=ft(24,True),fill=muted)
    d.text((84,213),"中文  •  HSK 2",font=ft(33,cjk=True),fill=teal)
    centered(d,scene.get("headline") or "",54,311,fg,bold=True)
    d.rounded_rectangle((70,520,1010,1120),radius=46,fill=colors["surface"],outline=border,width=4)
    d.rounded_rectangle((115,567,293,578),radius=4,fill=gold)
    card=(scene.get("cards") or [{}])[0]
    hanzi=(card.get("hanzi") or "").strip("。？")
    centered(d,hanzi,97 if len(hanzi)<8 else 76,662,fg)
    centered(d,card.get("pinyin",""),45,850,red)
    centered(d,card.get("meaning",""),40,986,muted)
    d.text((86,1225),"САҲНА" if lang=="tg" else "СЦЕНА",font=ft(29,True),fill=teal)
    narration=scene["narration"]
    for j,line in enumerate(wrap(d,narration,ft(39,cjk=True),880)[:7]):
        d.text((91,1305+j*70),line,font=txtfont(line,39),fill=fg)
    d.rounded_rectangle((65,1770,1015,1870),radius=24,fill="#F6E8D6",outline=border,width=2)
    label="REVIEW ONLY • ESTIMATED SCENE TIMING"
    font=ft(28,True);width=d.textbbox((0,0),label,font=font)[2]
    d.text(((W-width)/2,1804),label,font=font,fill=fg)
    canvas.save(path)

def source(wav,episode,sha_audio,sha_text,lang):
    raw=wav.read_bytes()
    if digest(raw)!=sha_audio:raise ValueError("WAV SHA-256 mismatch")
    ep=json.loads(episode.read_text(encoding="utf8"))
    if ep.get("languageCode")!=("ru-RU" if lang=="ru" else "tg-TJ"):
        raise ValueError("Episode locale doesn't match original audio")
    if not ep.get("scenes") or any(not s.get("narration") for s in ep["scenes"]):
        raise ValueError("Missing authored scene narration")
    narration=" ".join(" ".join(s["narration"].split()) for s in ep["scenes"])
    if digest(narration.encode())!=sha_text:
        raise ValueError("Approved source narration SHA-256 mismatch")
    metadata=json.loads((wav.parent/"metadata.json").read_text(encoding="utf8"))
    if metadata.get("ttsGenerationMode")!="continuous-pilot" or metadata.get("ttsRequestCount") not in (1,2):
        raise ValueError("Only archived owner-auditioned single-take voice accepted")
    with wave.open(str(wav),"rb") as stream:
        if(stream.getframerate(),stream.getnchannels(),stream.getsampwidth())!=(24000,1,2):
            raise ValueError("Original WAV format changed")
        samples=np.frombuffer(stream.readframes(stream.getnframes()),dtype=np.int16)
    return ep,samples,len(samples)/24000

def scene_cuts(ep,pcm,length):
    scenes=ep["scenes"]
    total=sum(float(s["durationSec"]) for s in scenes)
    if total<=0:raise ValueError("Invalid author scene durations")
    targets=np.cumsum([float(s["durationSec"]) for s in scenes])[:-1]/total*length
    block=960
    rms=np.array([np.sqrt(np.mean((pcm[i:i+block].astype(np.float64)/32768)**2)) for i in range(0,len(pcm),block)])
    rms=np.convolve(rms,np.ones(3)/3,mode="same")
    previous=0;cuts=[];evidence=[]
    for index,target in enumerate(targets):
        lo=max(target-1.0,previous+1.8)
        hi=min(target+1.0,length-(len(targets)-index)*1.8)
        if hi>lo:
            a=max(0,round(lo/.04));b=min(len(rms),round(hi/.04))
            sec=float(a+np.argmin(rms[a:b]))*.04 if b>a else float(target)
            method="nearby-measured-low-RMS"
        else:sec=float(target);method="authored-duration-proportion"
        previous=sec;cuts.append(sec)
        evidence.append({"plannedSec":round(float(target),3),"estimatedReviewCutSec":round(sec,3),"method":method})
    frames=[0]+[round(c*FPS) for c in cuts]+[math.ceil(length*FPS)]
    if any(b<=a for a,b in zip(frames,frames[1:])):raise ValueError("Invalid scene frame offsets")
    return frames,evidence

def main():
    p=argparse.ArgumentParser()
    for key in ("wav","episode","out","evidence","visual-system"):
        p.add_argument("--"+key,required=True,type=Path)
    for key in ("audio-sha256","narration-sha256"):
        p.add_argument("--"+key,required=True)
    p.add_argument("--language",required=True,choices=["ru","tg"])
    args=p.parse_args()
    if not re.fullmatch("[0-9a-f]{64}",args.audio_sha256) or not re.fullmatch("[0-9a-f]{64}",args.narration_sha256):
        raise ValueError("Explicit source SHA-256 required")
    episode,pcm,length=source(args.wav,args.episode,args.audio_sha256,args.narration_sha256,args.language)
    frames,cutEvidence=scene_cuts(episode,pcm,length)
    colors=json.loads(args.visual_system.read_text(encoding="utf8"))["colors"]
    args.out.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="hsk-scene-review-") as folder:
        root=Path(folder);entries=[]
        for i,(scene,start,end) in enumerate(zip(episode["scenes"],frames,frames[1:])):
            png=root/f"scene-{i:02d}.png";segment=root/f"scene-{i:02d}.mp4"
            slide(scene,i,len(episode["scenes"]),args.language,colors,png)
            ff(["ffmpeg","-hide_banner","-loglevel","error","-y","-loop","1","-framerate","30","-i",str(png),
                "-frames:v",str(end-start),"-vf","format=yuv420p","-c:v","libx264",
                "-preset","ultrafast","-crf","22","-r","30","-an",str(segment)])
            entries.append(f"file '{segment}'")
        playlist=root/"concat.txt";playlist.write_text("\n".join(entries)+"\n")
        ff(["ffmpeg","-hide_banner","-loglevel","error","-y","-f","concat","-safe","0","-i",str(playlist),
            "-i",str(args.wav),"-map","0:v:0","-map","1:a:0","-c:v","copy",
            "-c:a","aac","-b:a","128k","-t",f"{frames[-1]/FPS:.6f}","-movflags","+faststart",str(args.out)])
    meta=json.loads(subprocess.check_output(["ffprobe","-v","error","-show_entries",
        "stream=codec_type,codec_name,duration,width,height:format=duration","-of","json",str(args.out)]))
    video=next(x for x in meta["streams"] if x.get("codec_type")=="video")
    audio=next(x for x in meta["streams"] if x.get("codec_type")=="audio")
    if(video.get("width")!=W or video.get("height")!=H or
       abs(float(video["duration"])-length)>0.07 or
       abs(float(audio["duration"])-length)>0.11):
        raise ValueError("Rendered MP4 A/V duration or frame-size mismatch")
    args.evidence.parent.mkdir(parents=True,exist_ok=True)
    report={"status":"REVIEW_ONLY_NEVER_FOR_PUBLICATION","language":args.language,
        "sourceAudioSha256":args.audio_sha256,"sourceNarrationSha256":args.narration_sha256,
        "sourceDurationSec":round(length,3),"outputMp4Sha256":digest(args.out.read_bytes()),
        "audioRegenerationCalls":0,"verifiedWordTimestamps":False,
        "sceneFrameCounts":[b-a for a,b in zip(frames,frames[1:])],
        "timingEvidence":cutEvidence,
        "warning":"Scene transitions are low-RMS estimates; not verified word timestamps. Production rendering, CTA timing and approval are unchanged."}
    args.evidence.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
    print(json.dumps(report,ensure_ascii=False))

if __name__=="__main__":main()
