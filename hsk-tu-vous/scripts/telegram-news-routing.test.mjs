import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {fileURLToPath} from "node:url";

const root=fileURLToPath(new URL("../content/",import.meta.url));
const news=JSON.parse(fs.readFileSync(root+"telegram-agent.json","utf8"));
const routes=JSON.parse(fs.readFileSync(root+"publication-destinations.json","utf8"));

test("three-day agent and original Telegram authorization are preserved",()=>{
  assert.equal(news.schedule.automationId,"6ae1893b53a08191803177bea34d82b5");
  assert.equal(news.schedule.everyDays,3);
  assert.equal(news.schedule.timezone,"Asia/Shanghai");
  assert.equal(news.source.repository,"akbarholturaev11-lang/HSK-AI-Bot");
  assert.equal(news.source.branch,"main");
  assert.equal(news.source.lookbackDays,3);
  assert.equal(news.channel.account,"@aibotsakbar");
  assert.equal(news.channel.accountId,"6ae1661bf80a20df8f31158e");
  assert.equal(news.channel.allowVideo,false);
  assert.equal(news.output.noApprovalNeeded,true);
  assert.equal(news.output.image.ratio,"4:3");
  assert.equal(news.output.image.required,true);
  assert.equal(news.output.image.mediaHosting.fileRequirements.mustBeGenuineBinary,true);
});

test("static photo news has exactly four language-strict owner-authorized accounts",()=>{
  const d=news.socialNewsDistribution;
  assert.equal(d.postType,"photo-feed-post");
  assert.equal(d.perPostOwnerApprovalRequired,false);
  const expected=[
    ["telegram","tg","@aibotsakbar","6ae1661bf80a20df8f31158e","tiktok-telegram"],
    ["instagram","ru","@hskai.app","6a411e989d9472faae10a430","ru-primary"],
    ["instagram","tg","@hskai.apptj","6ae0f16205fd6f5357f8503d","tg-primary"],
    ["facebook","tg","Akbarholturaev","6ae161de384955d3b3ff194b","tiktok-facebook"],
  ];
  const targets=routes.newsPhotoDestinations.targets;
  assert.equal(targets.length,expected.length);
  assert.equal(d.destinations.length,3);
  for(const [platform,language,account,id,group] of expected){
    const t=targets.filter(x=>x.platform===platform&&x.language===language);
    assert.equal(t.length,1);
    assert.equal(t[0].account,account);
    assert.equal(t[0].verifiedAccountId,id);
    assert.equal(t[0].credentialGroup,group);
    assert.equal(t[0].photoWithCaption,true);
    if(platform!=="telegram"){
      const detail=d.destinations.find(x=>x.platform===platform&&x.languageCode===language);
      assert.equal(detail?.account,account);
      assert.equal(detail?.accountId,id);
      assert.equal(detail?.credentialGroup,group);
      assert.equal(routes.videoDestinations[language].platforms[platform].verifiedAccountId,id);
    }
  }
  assert.equal(targets.filter(x=>x.platform==="facebook"&&x.language==="ru").length,0);
  assert.equal(targets.filter(x=>/tiktok|youtube/.test(x.platform)).length,0);
});

test("latest MAIN Facebook TJ-only Zernio rule and independent video owner gate remain untouched",()=>{
  assert.equal(routes.videoDestinations.ru.platforms.facebook.zernioPublishingAuthorized,false);
  assert.equal(routes.videoDestinations.tg.platforms.facebook.zernioPublishingAuthorized,true);
  assert.equal(routes.videoDestinations.tg.platforms.tiktok.account,"@hskai.ru");
  assert.equal(routes.videoDestinations.ru.platforms.instagram.account,"@hskai.app");
  assert.equal(routes.videoDestinations.tg.platforms.instagram.account,"@hskai.apptj");
  assert.equal(news.socialNewsDistribution.videoPolicy.includes("manual video"),true);
  assert.equal(routes.newsPhotoDestinations.excluded.some(x=>x.includes("Russian Facebook")),true);
  assert.equal(routes.newsPhotoDestinations.excluded.some(x=>x.includes("video")),true);
});
