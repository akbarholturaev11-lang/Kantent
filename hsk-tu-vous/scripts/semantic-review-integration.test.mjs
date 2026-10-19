import assert from "node:assert/strict";
import test from "node:test";
import { getPlannedEpisode, synchronizeAutoStoryboard } from "./lib.mjs";
import { applySemanticReviewDraft, prepareSemanticRender } from "./semantic-review-integration.mjs";
import { validateSemanticVisualEpisode } from "./semantic-visual-plan.mjs";
import { renderSharedPlatformVideos } from "./render-platform-videos.mjs";
import { requireApprovedPlatformPackages } from "./platform-exports.mjs";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("normal dated loader automatically creates semantic review scenes BEFORE central CTA",async()=>{
  const {episode}=await getPlannedEpisode("2026-10-21");
  assert.deepEqual(episode.semanticVisual,{schemaVersion:1,mode:"review-only"});
  assert.equal(episode.autoSemantic.status,"review-video-required");
  assert.ok(episode.scenes.filter(s=>s.kind!=="cta").every(s=>s.semanticShot));
  assert.ok(episode.scenes.some(s=>s.semanticShot?.actorIds?.length===0));
  assert.equal(episode.scenes.at(-1).kind,"cta");
  assert.equal(episode.scenes.at(-1).semanticShot,undefined);
});
test("old lessons do not retroactively receive semantic metadata",async()=>{
  const {episode}=await getPlannedEpisode("2026-10-19");
  assert.equal(episode.semanticVisual,undefined);
  assert.ok(episode.scenes.some(s=>s.storyboard?.character==="student"));
});
test("real planned pool topic proposes contextual pool not another school front",async()=>{
  const {episode}=await getPlannedEpisode("2026-10-28");
  const hook=episode.scenes.find(s=>s.id==="hook");
  assert.equal(hook.semanticShot.environmentId,"pool");
  assert.equal(hook.semanticShot.actorIds.length,0);
  assert.equal(validateSemanticVisualEpisode(episode).length,0);
});
test("can migrate only untouched prevoice draft, even if old storyboard format already matches",async()=>{
  const {episode:desired}=await getPlannedEpisode("2026-10-21");
  const old=structuredClone(desired);
  delete old.semanticVisual;delete old.autoSemantic;
  for(const scene of old.scenes){
    delete scene.semanticShot;
    for(const beat of scene.visualBeats??[]){
      if(beat.semanticAction) {delete beat.semanticAction;delete beat.syncCueText;delete beat.syncCueOccurrence;}
    }
  }
  assert.deepEqual(synchronizeAutoStoryboard(old,desired,{stage:"plan-ready"}),desired);
  assert.throws(()=>synchronizeAutoStoryboard({...old,audioSrc:"already-approved.mp3"},desired,{stage:"voice-and-captions-imported"}),/Do not silently replace|review copy differs/);
  assert.throws(()=>synchronizeAutoStoryboard(old,desired,{stage:"owner-approved-for-zernio-publishing"}),/Do not silently replace|review copy differs/);
});
test("actual Come/Go synthetic narration becomes executable word-aligned review motion",()=>{
  const source={id:"new-direction-video",date:"2026-10-21",topic:"на улице направление",
    scenes:[{id:"lesson",kind:"example",headline:"来 / 去",narration:"На улице человек приходит и уходит.",
      visualBeats:[{hero:"来"},{hero:"去"}]}]};
  const original=JSON.stringify(source);
  const planned=applySemanticReviewDraft(source);
  assert.equal(JSON.stringify(source),original);
  assert.deepEqual(planned.scenes[0].visualBeats.map(b=>b.semanticAction?.type),["approach-camera","move-away"]);
  const imported=structuredClone(planned);
  imported.captionSource="gemini-word-timestamps";imported.voiceTextHash="synthetic-test-only";
  imported.scenes[0].startMs=0;imported.scenes[0].endMs=4000;
  imported.captions=[{text:"на",startMs:100,endMs:220},{text:"улице",startMs:230,endMs:400},
    {text:"человек",startMs:450,endMs:610},{text:"приходит",startMs:1000,endMs:1250},
    {text:"и",startMs:1300,endMs:1380},{text:"уходит",startMs:2300,endMs:2500}];
  const timeline=prepareSemanticRender(imported);
  assert.deepEqual(timeline.scenes[0].actions.map(x=>[x.action,x.startFrame]),
    [["approach-camera",30],["move-away",69]]);
  imported.captions[3].text="приезжает";
  assert.throws(()=>prepareSemanticRender(imported),/spoken cue not found/);
});
test("synthetic shared-platform review renders carry same semantic timeline in both props",async()=>{
  const folder=await mkdtemp(path.join(os.tmpdir(),"semantic-platform-wiring-"));
  try{
    const scene={id:"lesson",kind:"example",durationFrames:90,narration:"Приходит",semanticShot:{
      environmentId:"street",shotType:"medium",cameraStyle:"follow",actorIds:["traveler"]}};
    const cta={id:"cta",kind:"cta",durationFrames:60,narration:"HSK AI"};
    const base={id:"test-render",semanticVisual:{schemaVersion:1,mode:"review-only"},scenes:[scene,cta],captions:[
      {text:"Приходит",startMs:100,endMs:500}],voiceTextHash:"synthetic",
      captionSource:"gemini-word-timestamps",audioSrc:"test.mp3",audioDurationMs:5000};
    const episodes={instagram:base,youtube:structuredClone(base)};
    const timeline={episodeId:base.id,schemaVersion:1,mode:"review-only",fps:30,
      scenes:[{sceneId:"lesson",shot:scene.semanticShot,actions:[]}]};
    const seen=[];
    const execute=(args)=>{
      if(args[0]==="render"){
        const propsPath=args[args.indexOf("--props")+1];
        const props=JSON.parse(fs.readFileSync(propsPath,"utf8"));
        seen.push({kind:args[3],props});
        assert.deepEqual(props.semanticTimeline,timeline);
        return "";
      }
      if(args[0]==="ffmpeg"){
        fs.writeFileSync(args[args.length-1],"synthetic-video-only");
        return "";
      }
      if(args[0]==="ffprobe") return JSON.stringify({streams:[
        {codec_type:"video",codec_name:"h264",width:1080,height:1920,pix_fmt:"yuv420p",
          color_space:"bt709",r_frame_rate:"30/1",nb_frames:"150",duration:"5"},
        {codec_type:"audio",codec_name:"aac",duration:"5"}
      ]});
      throw Error("Unexpected command "+args[0]);
    };
    await renderSharedPlatformVideos({
      episodes,
      outputs:{instagram:path.join(folder,"insta.mp4"),youtube:path.join(folder,"yt.mp4")},
      workDir:path.join(folder,"render-work"),semanticTimeline:timeline,execute,log:()=>{}
    });
    assert.equal(seen.length,4);
    assert.ok((await readFile(path.join(folder,"insta.mp4"))).length>0);
    assert.ok((await readFile(path.join(folder,"yt.mp4"))).length>0);
  }finally{await rm(folder,{recursive:true,force:true});}
});

test("social publication stays blocked even for an owner-approved semantic review while production flag is off",async()=>{
  await assert.rejects(()=>requireApprovedPlatformPackages(
    {id:"semantic-reviewed",semanticVisual:{schemaVersion:1,mode:"review-only"}},
    {stage:"owner-approved-for-zernio-publishing"},
    {publicationIntent:{platforms:[]}}
  ),/review-only; production publishing remains disabled/);
});
