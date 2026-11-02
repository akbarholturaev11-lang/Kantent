import manifest from "../content/motion-assets.json" with {type:"json"};

const idPattern=/^[a-z][a-z0-9-]{0,63}$/;
const digest=/^[a-f0-9]{64}$/;
const safePath=/^motion-assets\/[a-z][a-z0-9-]{0,63}\.svg$/;
const object=v=>v!==null&&typeof v==="object"&&!Array.isArray(v);
const fail=message=>{throw Error("Motion asset registry: "+message)};
const knownFields={
  manifest:["schemaVersion","assetRoot","assets"],
  asset:["id","kind","path","sha256","width","height","transparent","safeBounds","stageScale","subject","description","locales","palette","provenance","status"],
  provenance:["kind","author","createdOn","license","sourceReference"],
  bounds:["x","y","width","height"]
};
const onlyKeys=(entry,keys,label)=>{
  if(!object(entry)||Object.keys(entry).some(k=>!keys.includes(k)))fail(label+" has missing structure or unknown fields");
};
export function validateMotionAssetManifest(value=manifest){
  onlyKeys(value,knownFields.manifest,"manifest");
  if(value.schemaVersion!==1||value.assetRoot!=="public/motion-assets"||!Array.isArray(value.assets)||value.assets.length<1||value.assets.length>100)
    fail("unsupported version, root or asset count");
  const seenId=new Set(),seenFile=new Set(),seenDigest=new Set();
  for(const asset of value.assets){
    onlyKeys(asset,knownFields.asset,"asset");
    if(!idPattern.test(asset.id??"")||seenId.has(asset.id))fail("duplicate or invalid asset ID");
    seenId.add(asset.id);
    if(asset.kind!=="svg"||asset.path!==`motion-assets/${asset.id}.svg`||!safePath.test(asset.path)||
       seenFile.has(asset.path)||!digest.test(asset.sha256)||seenDigest.has(asset.sha256))
      fail("unsafe/duplicate asset path or digest");
    seenFile.add(asset.path);seenDigest.add(asset.sha256);
    if(!Number.isInteger(asset.width)||asset.width<320||asset.width>2048||
       !Number.isInteger(asset.height)||asset.height<240||asset.height>2048||
       asset.transparent!==true)
      fail("unsupported dimensions or transparency");
    if(typeof asset.stageScale!=="number"||!Number.isFinite(asset.stageScale)||asset.stageScale<1||asset.stageScale>1.18)
      fail("asset stageScale must be bounded [1,1.18]");
    onlyKeys(asset.safeBounds,knownFields.bounds,"safeBounds");
    const b=asset.safeBounds;
    if(![b.x,b.y,b.width,b.height].every(Number.isFinite)||
       b.x<0||b.y<0||b.width<asset.width*0.3||b.height<asset.height*0.3||
       b.x+b.width>asset.width||b.y+b.height>asset.height)fail("invalid safe bounds");
    if(!idPattern.test(asset.subject??"")||typeof asset.description!=="string"||
       asset.description.length<15||asset.description.length>180||
       asset.palette!=="HSK AI canonical")
      fail("subject, description or palette invalid");
    if(!Array.isArray(asset.locales)||asset.locales.length!==2||
       asset.locales[0]!=="ru-RU"||asset.locales[1]!=="tg-TJ")fail("unverified locale coverage");
    onlyKeys(asset.provenance,knownFields.provenance,"provenance");
    const p=asset.provenance;
    if(p.kind!=="first-party-original"||p.license!=="project-owned-original"||
       p.author!=="HSK AI Content Studio"||
       !/^20\d\d-\d\d-\d\d$/.test(p.createdOn??"")||
       typeof p.sourceReference!=="string"||p.sourceReference.length<12)
      fail("invalid copyright/provenance");
    if(!["review-only","production-approved"].includes(asset.status))
      fail("unreviewed/unsupported approval state");
  }
  return value;
}
validateMotionAssetManifest();

export function getMotionAsset(id){
  if(!idPattern.test(id??""))fail("invalid requested asset ID");
  const asset=manifest.assets.find(entry=>entry.id===id);
  if(!asset)fail("unknown asset ID: "+id);
  return asset;
}
export function assertMotionAssetsProductionApproved(episode){
  for(const scene of episode?.scenes??[]){
    for(const beat of scene.motionBeats??[]){
      if(beat.kind!=="asset")continue;
      const asset=getMotionAsset(beat.visual?.assetId);
      if(asset.status!=="production-approved")
        fail("asset "+asset.id+" is review-only; cannot make a production video");
      if(episode.languageCode&&!asset.locales.includes(episode.languageCode))
        fail("asset "+asset.id+" is not approved for locale "+episode.languageCode);
    }
  }
}
