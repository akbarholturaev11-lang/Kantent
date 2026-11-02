import test from "node:test";
import assert from "node:assert/strict";
import assetCatalog from "../content/motion-assets.json" with {type:"json"};
import {getMotionAsset,validateMotionAssetManifest,assertMotionAssetsProductionApproved} from "./motion-assets.mjs";
import {verifyMotionAssetFiles} from "./verify-motion-assets.mjs";
import {validateActionLesson,validateActionVisual} from "./action-design-plan.mjs";
import {resolveMotionBeats} from "./motion-design-plan.mjs";
import {compileMotionDirectorScene} from "./motion-director-plan.mjs";

const clone=()=>structuredClone(assetCatalog);
const action=(id,assetId,cue)=>({id,kind:"asset",cueText:cue,explains:"Show the exactly narrated concept",visual:{title:"Test",hanzi:"书",pinyin:"shū",meaning:"book",assetId}});
test("all first-party original SVG files match their SHA-256 provenance and paths",()=>{
  const value=verifyMotionAssetFiles();
  assert.equal(value.verified.length,3);
  assert.deepEqual(value.verified,["study-book","tea-cup","market-stall"]);
  assert.equal(getMotionAsset("tea-cup").status,"review-only");
});
test("path traversal, missing provenance and unapproved status cannot enter canonical manifest",()=>{
  const e=clone();e.assets[0].path="../secret.svg";
  assert.throws(()=>validateMotionAssetManifest(e),/unsafe\/duplicate/);
  const u=clone();u.assets[0].provenance.license="unknown";
  assert.throws(()=>validateMotionAssetManifest(u),/copyright/);
  const bad=clone();bad.assets[0].status="auto-approved";
  assert.throws(()=>validateMotionAssetManifest(bad),/approval/);
  const dupe=clone();dupe.assets[1].sha256=dupe.assets[0].sha256;
  assert.throws(()=>validateMotionAssetManifest(dupe),/unsafe\/duplicate/);
  assert.throws(()=>getMotionAsset("../secret"),/invalid requested/);
  assert.throws(()=>getMotionAsset("invented-asset"),/unknown/);
});
test("filesystem verifier refuses missing SVG or mismatched digest before production",()=>{
  const broken=clone();broken.assets[0].sha256="a".repeat(64);
  assert.throws(()=>verifyMotionAssetFiles(broken),/hash update/);
  const missing=clone();missing.assets[0].id="missing-asset";missing.assets[0].path="motion-assets/missing-asset.svg";
  assert.throws(()=>verifyMotionAssetFiles(missing),/missing/);
});
test("new asset action kind keeps existing action validation strict",()=>{
  const book=action("first","study-book","книга"),tea=action("second","tea-cup","чай");
  assert.doesNotThrow(()=>validateActionVisual(book));
  assert.doesNotThrow(()=>validateActionLesson({scenes:[{id:"lesson",kind:"example",motionBeats:[book,tea]}]},{requireVisibleChange:true}));
  assert.throws(()=>validateActionVisual(action("bad","made-up","чай")),/unknown/);
  const wrong={...book,visual:{...book.visual,graphic:{}}};
  assert.throws(()=>validateActionVisual(wrong),/cannot duplicate/);
  assert.throws(()=>validateActionVisual({...book,kind:"quantity"}),/explicit asset/);
});
test("review-only assets block full production regardless of cue validity",()=>{
  const episode={languageCode:"ru-RU",scenes:[{motionBeats:[action("one","study-book","книга")]}]};
  assert.throws(()=>assertMotionAssetsProductionApproved(episode),/review-only/);
  assert.doesNotThrow(()=>assertMotionAssetsProductionApproved({scenes:[{motionBeats:[{kind:"graphic"}]}]}));
});
test("Motion Director recognizes only exact authored registry asset and exact word cue",()=>{
  const scene={id:"scene",kind:"example",startMs:0,endMs:4000,motionBeats:[action("first","study-book","книга"),action("second","tea-cup","чай")]};
  const caps=[{text:"книга",startMs:800,endMs:1050},{text:"потом",startMs:1600,endMs:1890},{text:"чай",startMs:2200,endMs:2520}];
  const timeline=resolveMotionBeats(scene,caps);
  scene.motionDirection={schemaVersion:1,shots:[
    {shotId:"book-shot",beatId:"first",meaningCue:"книга",assetIds:["asset:study-book"],camera:{xPx:0,yPx:0,scale:1},transition:{kind:"cut",frames:0},focalRole:"object",zIndex:0},
    {shotId:"tea-shot",beatId:"second",meaningCue:"чай",assetIds:["asset:tea-cup"],camera:{xPx:20,yPx:-10,scale:1.03},transition:{kind:"crossfade",frames:12},focalRole:"action",zIndex:0}
  ]};
  assert.deepEqual(compileMotionDirectorScene(scene,timeline).shots.map(x=>x.cueFrame),[24,66]);
  scene.motionDirection.shots[1].assetIds=["asset:market-stall"];
  assert.throws(()=>compileMotionDirectorScene(scene,timeline),/unknown\/unsupported/);
  scene.motionDirection.shots[1].assetIds=["asset:tea-cup"];
  scene.motionDirection.shots[1].persistentElementIds=["asset:tea-cup"];
  assert.throws(()=>compileMotionDirectorScene(scene,timeline),/identical drawable geometry|persistent/);
});
