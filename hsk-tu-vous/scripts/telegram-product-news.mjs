/**
 * Three-day Tajik Telegram PRODUCT UPDATE lane. No media upload of any kind.
 * Never generates release claims or chooses a video. A human-authored post with
 * exact content digest, source and owner approval is prerequisite for sending.
 * GitHub schedule checks 09:00 Shanghai daily and performs actions every third
 * day beginning 2026-10-29. No available approved news => do not post.
 */
import fs from "node:fs/promises";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
import {telegramNewsRoute} from "./video-credentials.mjs";

const PATH=fileURLToPath(new URL("../content/telegram-product-news.json",import.meta.url));
const SHA=/^[a-f0-9]{64}$/;
const POST_ID=/^[a-f0-9]{24}$/;
const ID=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const API="https://zernio.com/api/v1";

export function shanghaiDay(now=new Date()) {
  return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Shanghai",
    year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
}
const dayNumber=(date)=>Math.floor(Date.parse(date+"T00:00:00Z")/86400000);
const hash=(value)=>createHash("sha256").update(value).digest("hex");
export function selectNews(queue,now=new Date()) {
  if(queue?.schemaVersion!==1||queue.language!=="tg"||queue.platform!=="telegram"||
      queue.account!=="@aibotsakbar"||queue.cadenceDays!==3||queue.timezone!=="Asia/Shanghai"||
      queue.firstCycleDate!=="2026-10-29"||!Array.isArray(queue.posts))
    throw Error("Tajik Telegram news queue does not match canonical owner requirements.");
  const today=shanghaiDay(now);
  const delta=dayNumber(today)-dayNumber(queue.firstCycleDate);
  if(delta<0||delta%3!==0)return {status:"not-a-cycle-day",today,checked:false};
  const due=queue.posts.filter(p=>p.date<=today&&p.ownerApproved===true);
  for(const post of due) {
    if(!ID.test(post.id??"")||!/^20\d\d-\d\d-\d\d$/.test(post.date??"") ||
        post.date!==new Date(post.date+"T00:00:00Z").toISOString().slice(0,10)||
        typeof post.text!=="string"||post.text.trim()!==post.text||
        post.text.length<30||post.text.length>2500||
        !/[\u0400-\u052f]/u.test(post.text)||
        /(?:\.mp4|<video|video\/mp4|mediaItems|base64,)/i.test(post.text)||
        typeof post.sourceUrl!=="string"||!/^https:\/\/[^\s<>]+$/i.test(post.sourceUrl)||
        !(post.text.includes(post.sourceUrl))||!SHA.test(post.approvedSha256??"")||
        post.approvedSha256!==hash(post.text))
      throw Error("Approved Telegram news item has incorrect source, exact-text hash or text-only policy: "+String(post.id));
  }
  const target=due.sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id))[0];
  if(!target)return {status:"no-approved-user-facing-news",today,checked:true};
  return {status:"approved-news-ready",today,checked:true,post:target};
}

async function api(url,token,{method="GET",body,requestKey}={}) {
  const headers={"Authorization":"Bearer "+token,"Accept":"application/json"};
  if(body!==undefined) headers["Content-Type"]="application/json";
  if(requestKey) headers["Idempotency-Key"]=requestKey;
  const res=await fetch(url,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(35000)});
  if(!res.ok)throw Error("Zernio Telegram API "+method+" failed (HTTP "+res.status+"); do not retry without readback.");
  return res.json();
}
export async function executeNews(queue,env=process.env,now=new Date()) {
  const selected=selectNews(queue,now);
  if(selected.status!=="approved-news-ready")return selected;
  if(env.HSK_TG_TELEGRAM_NEWS_ENABLED!=="true")return {status:"disabled-until-owner-enables-sender",today:selected.today,id:selected.post.id};
  if(env.GITHUB_REPOSITORY!=="akbarholturaev11-lang/Kantent"||
      env.GITHUB_REF!=="refs/heads/main"||
      !["schedule","workflow_dispatch"].includes(env.GITHUB_EVENT_NAME))
    throw Error("Telegram sender is restricted to GitHub's trusted main workflow.");
  const route=telegramNewsRoute(env);
  // Verify exact live connection; the credential that owns RU TikTok also
  // owns this TJ Telegram target, NOT the TJ Instagram/YouTube credential.
  const list=await api(API+"/accounts?platform=telegram",route.secret);
  if(!Array.isArray(list.accounts))throw Error("Missing verified Zernio Telegram accounts response.");
  const entry=list.accounts.find(x=>(x._id??x.id)===route.accountId&&x.platform==="telegram");
  if(!entry||(entry.isActive!==true&&!["connected","active"].includes(entry.status))||
      String(entry.username??"").replace(/^@/,"").toLowerCase()!==route.expectedUsername)
    throw Error("Tajik Telegram account was not verified connected under the correct API token.");
  // Fail closed if prior posts cannot be enumerated. A retry after an ambiguous
  // POST is NOT allowed to blindly create a duplicate.
  const previous=await api(API+"/posts?platform=telegram&limit=100",route.secret);
  if(!Array.isArray(previous.posts))throw Error("No reliable Zernio post history; refuse potentially duplicate send.");
  if(previous.posts.some(p=>p.content===selected.post.text&&
      ["published","scheduled","processing","queued","pending_approval"].includes(p.status)))
    return {status:"already-sent",today:selected.today,id:selected.post.id};
  const key="hsk-tj-telegram-"+hash(selected.post.id+"\n"+selected.post.approvedSha256).slice(0,40);
  const created=await api(API+"/posts",route.secret,{
    method:"POST",requestKey:key,
    body:{content:selected.post.text,platforms:[{platform:"telegram",accountId:route.accountId}],publishNow:true},
  });
  const pid=created.post?._id??created.post?.id;
  if(!POST_ID.test(pid??""))throw Error("Telegram send was not confirmed: inspect Zernio before retrying.");
  const verified=await api(API+"/posts/"+pid,route.secret);
  const post=verified.post??verified;
  if((post._id??post.id)!==pid||post.content!==selected.post.text||
      post.status!=="published"||
      !post.platforms?.some(p=>p.platform==="telegram"&&p.accountId===route.accountId))
    throw Error("Telegram readback is not verified published; do not retry automatically.");
  return {status:"published",id:selected.post.id,postId:pid,accountId:route.accountId,today:selected.today};
}

const main=async()=>{
  const command=process.argv[2]??"preview";
  if(!["preview","send"].includes(command))throw Error("Use preview or send only.");
  const queue=JSON.parse(await fs.readFile(PATH,"utf8"));
  const result=command==="preview"?selectNews(queue):await executeNews(queue);
  console.log(JSON.stringify(result,null,2));
};
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  main().catch(error=>{console.error("HSK_TELEGRAM_NEWS_BLOCKED: "+error.message);process.exitCode=1;});
}
