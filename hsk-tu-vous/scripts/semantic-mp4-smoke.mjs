/** Real MP4 render smoke with synthetic test tone ONLY. No Gemini claim, no social post. */
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PROJECT_ROOT } from "./lib.mjs";
import { prepareSemanticRender } from "./semantic-review-integration.mjs";
import { renderSharedPlatformVideos } from "./render-platform-videos.mjs";

const output=process.argv[2];
if(!output || !path.isAbsolute(output))throw Error("Usage: node scripts/semantic-mp4-smoke.mjs /absolute/test-output-dir");
const toneName="semantic-ci-tone-"+process.pid+".wav";
const toneDir=path.join(PROJECT_ROOT,"public/generated");
const tone=path.join(toneDir,toneName);
await fs.mkdir(output,{recursive:true});
await fs.mkdir(toneDir,{recursive:true});
try{
  const ff=spawnSync("ffmpeg",["-hide_banner","-loglevel","error","-y","-f","lavfi",
    "-i","sine=frequency=480:duration=3.5","-ar","24000","-ac","1",tone],
    {encoding:"utf8"});
  if(ff.error || ff.status!==0)throw Error("Synthetic tone generation failed: "+(ff.stderr??ff.error));
  const base={
    id:"semantic-ci-mp4-smoke",title:"Semantic smoke: 来 / 去",languageCode:"ru-RU",
    semanticVisual:{schemaVersion:1,mode:"review-only"},
    captionSource:"gemini-word-timestamps",voiceTextHash:"FAKE-TEST-AUDIO-NOT-GEMINI",
    audioSrc:"generated/"+toneName,audioDurationMs:3500,
    scenes:[
      {id:"direction",kind:"example",headline:"来 / 去",narration:"Приходит, потом уходит.",
        durationFrames:75,startMs:0,endMs:2500,
        semanticShot:{environmentId:"street",shotType:"medium",cameraStyle:"follow",actorIds:["traveler"],objectIds:[]},
        visualBeats:[
          {hero:"来",pinyin:"lái",meaning:"приходит",syncCueText:"Приходит",
            semanticAction:{type:"approach-camera",subjectId:"traveler",durationMs:450}},
          {hero:"去",pinyin:"qù",meaning:"уходит",syncCueText:"уходит",
            semanticAction:{type:"move-away",subjectId:"traveler",durationMs:450}}
        ]},
      {id:"cta",kind:"cta",headline:"HSK AI",narration:"HSK AI",durationFrames:30,startMs:2500,endMs:3500,
        visualBeats:[{hero:"HSK AI"}]}
    ],
    captions:[
      {text:"Приходит",startMs:500,endMs:740},
      {text:"потом",startMs:850,endMs:1100},
      {text:"уходит",startMs:1600,endMs:1800},
      {text:"HSK",startMs:2700,endMs:2900},
      {text:"AI",startMs:2900,endMs:3050}
    ]
  };
  const semanticTimeline=prepareSemanticRender(base);
  const episodes={instagram:base,youtube:structuredClone(base)};
  const outputs={
    instagram:path.join(output,"instagram-smoke.mp4"),
    youtube:path.join(output,"youtube-smoke.mp4")
  };
  const range=await renderSharedPlatformVideos({
    episodes,outputs,semanticTimeline,workDir:path.join(output,"render-work"),
    renderOptions:["--concurrency","1"],log:message=>console.log(message)
  });
  for(const p of Object.values(outputs)) {
    const stat=await fs.stat(p);
    if(stat.size<8000)throw Error("Smoke MP4 too small: "+p);
    console.log("Verified synthetic-audio MP4",p,"bytes:",stat.size);
  }
  if(range.totalFrames!==105)throw Error("Wrong smoke frame count");
  console.log("Synthetic semantic MP4 export passed. NOT real Gemini narration or an authorized publication.");
}finally{
  await fs.rm(tone,{force:true});
}
