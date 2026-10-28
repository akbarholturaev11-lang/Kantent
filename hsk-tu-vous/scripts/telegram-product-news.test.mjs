import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {selectNews,executeNews,shanghaiDay} from "./telegram-product-news.mjs";

const content="📢 HSK AI навсозӣ шуд: машқи нав барои омӯзиши чинӣ дастрас аст.\nМанбаъ: https://hskai.app/tj/";
const base=()=>({schemaVersion:1,language:"tg",platform:"telegram",account:"@aibotsakbar",
 timezone:"Asia/Shanghai",cadenceDays:3,firstCycleDate:"2026-10-29",posts:[]});
const post=()=>({id:"verified-lesson-update-20261029",date:"2026-10-29",ownerApproved:true,
 text:content,sourceUrl:"https://hskai.app/tj/",
 approvedSha256:createHash("sha256").update(content).digest("hex")});

test("strict Asia/Shanghai 3-day schedule does not drift at month boundary",()=>{
 assert.equal(shanghaiDay(new Date("2026-10-29T01:00:00Z")),"2026-10-29");
 assert.equal(selectNews(base(),new Date("2026-10-28T02:00:00Z")).status,"not-a-cycle-day");
 assert.equal(selectNews(base(),new Date("2026-10-29T01:00:00Z")).status,"no-approved-user-facing-news");
 assert.equal(selectNews(base(),new Date("2026-10-30T01:00:00Z")).status,"not-a-cycle-day");
 assert.equal(selectNews(base(),new Date("2026-11-01T01:00:00Z")).status,"no-approved-user-facing-news");
 assert.equal(selectNews(base(),new Date("2026-11-04T01:00:00Z")).status,"no-approved-user-facing-news");
});

test("Telegram is TAJIK TEXT ONLY, never invented news or video",()=>{
 const q=base();q.posts.push(post());
 assert.equal(selectNews(q,new Date("2026-10-29T01:00:00Z")).status,"approved-news-ready");
 assert.equal(selectNews(q,new Date("2026-10-31T01:00:00Z")).status,"not-a-cycle-day");
 assert.equal(selectNews({...q,posts:[{...post(),ownerApproved:false}]},new Date("2026-10-29T01:00:00Z")).status,"no-approved-user-facing-news");
 assert.throws(()=>selectNews({...q,posts:[{...post(),text:content+" NEW UNAPPROVED"}]},new Date("2026-10-29T01:00:00Z")),/exact-text hash/);
 assert.throws(()=>selectNews({...q,posts:[{...post(),text:"Видео.mp4 "+content}]},new Date("2026-10-29T01:00:00Z")),/text-only policy/);
 assert.throws(()=>selectNews({...q,posts:[{...post(),sourceUrl:"https://other.example.com/"}]},new Date("2026-10-29T01:00:00Z")),/incorrect source/);
 assert.throws(()=>selectNews({...q,platform:"instagram"},new Date("2026-10-29T01:00:00Z")),/owner requirements/);
});

test("disabled or empty queue never performs network actions or posts",async()=>{
 const q=base();q.posts.push(post());
 const original=globalThis.fetch;globalThis.fetch=()=>{throw Error("MUST NOT SEND")};
 try {
  assert.equal((await executeNews(q,{},new Date("2026-10-29T01:00:00Z"))).status,"disabled-until-owner-enables-sender");
  assert.equal((await executeNews(base(),{HSK_TG_TELEGRAM_NEWS_ENABLED:"true"},new Date("2026-10-29T01:00:00Z"))).status,"no-approved-user-facing-news");
  await assert.rejects(executeNews(q,{HSK_TG_TELEGRAM_NEWS_ENABLED:"true",GITHUB_REF:"refs/heads/not-main"},new Date("2026-10-29T01:00:00Z")),/trusted main/);
 } finally {globalThis.fetch=original;}
});

test("verified exact Tajik Telegram account, history de-dupe and signed text-only API",async()=>{
 const q=base();q.posts.push(post());
 const env={HSK_TG_TELEGRAM_NEWS_ENABLED:"true",GITHUB_REF:"refs/heads/main",
  GITHUB_REPOSITORY:"akbarholturaev11-lang/Kantent",GITHUB_EVENT_NAME:"schedule",
  ZERNIO_TIKTOK_TELEGRAM_API_KEY:"mock-safe"};
 const saved=globalThis.fetch;
 const calls=[];
 let created=false;
 const response=(json,status=200)=>new Response(JSON.stringify(json),{status,headers:{"content-type":"application/json"}});
 const id="6ae1661bf80a20df8f31158e",pid="6af000000000000000000001";
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url); const method=options.method??"GET";
  calls.push({path:u.pathname,method,body:options.body&&JSON.parse(options.body),key:options.headers?.["Idempotency-Key"]});
  if(u.pathname==="/api/v1/accounts")return response({accounts:[{_id:id,platform:"telegram",username:"aibotsakbar",isActive:true}]});
  if(u.pathname==="/api/v1/posts"&&method==="GET")return response({posts:[]});
  if(u.pathname==="/api/v1/posts"&&method==="POST"){created=true;return response({post:{_id:pid}},201)}
  if(u.pathname==="/api/v1/posts/"+pid)return response({post:{_id:pid,content,status:"published",platforms:[{platform:"telegram",accountId:id}]}});
  throw Error("Unexpected API "+method+" "+u.pathname);
 };
 try {
  const result=await executeNews(q,env,new Date("2026-10-29T01:00:00Z"));
  assert.equal(result.status,"published");
  assert.equal(result.accountId,id);
  assert.equal(created,true);
  const body=calls.find(x=>x.method==="POST").body;
  assert.equal(body.content,content);
  assert.equal(body.mediaItems,undefined);
  assert.deepEqual(body.platforms,[{platform:"telegram",accountId:id}]);
  assert.match(calls.find(x=>x.method==="POST").key,/^hsk-tj-telegram-[a-f0-9]{40}$/);
 } finally {globalThis.fetch=saved;}
});
