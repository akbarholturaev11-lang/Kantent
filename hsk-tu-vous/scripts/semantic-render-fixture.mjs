/** Visual-only synthetic test fixture. Never a production lesson or publication asset. */
import fs from "node:fs";
import { compileSemanticVisualTimeline } from "./semantic-visual-plan.mjs";
const output=process.argv[2];
if(!output) throw Error("Usage: node scripts/semantic-render-fixture.mjs /tmp/props.json");
const episode={
  id:"semantic-direction-render-test",languageCode:"ru-RU",title:"来 / 去 visual QA",
  level:"HSK 1",topic:"movement directions",semanticVisual:{schemaVersion:1,mode:"review-only"},
  captionSource:"gemini-word-timestamps",voiceTextHash:"synthetic-preview-only",
  scenes:[{
    id:"walk",kind:"example",durationFrames:123,startMs:0,endMs:4100,
    headline:"来 / 去",narration:"Человек приходит, а потом уходит.",
    semanticShot:{environmentId:"street",shotType:"medium",cameraStyle:"static",
      actorIds:["walker"],objectIds:[]},
    visualBeats:[
      {hero:"来",pinyin:"lái",meaning:"приходить",chinese:true,
        syncCueText:"приходит",semanticAction:{type:"approach-camera",subjectId:"walker",durationMs:600}},
      {hero:"去",pinyin:"qù",meaning:"уходить",chinese:true,
        syncCueText:"уходит",semanticAction:{type:"move-away",subjectId:"walker",durationMs:650}}
    ]
  }],
  captions:[
    {text:"Человек",startMs:100,endMs:500},
    {text:"приходит",startMs:1000,endMs:1450},
    {text:"а",startMs:1710,endMs:1790},
    {text:"потом",startMs:1800,endMs:2100},
    {text:"уходит",startMs:2500,endMs:2950}
  ]
};
const semanticTimeline=compileSemanticVisualTimeline(episode);
fs.writeFileSync(output,JSON.stringify({episode,semanticTimeline},null,2));
console.log("Visual fixture timeline ready; NO actual narration/audio created",output);
