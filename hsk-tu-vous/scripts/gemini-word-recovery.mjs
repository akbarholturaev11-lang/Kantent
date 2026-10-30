/**
 * Recovery planning for Gemini word annotations. This module NEVER generates
 * a timestamp: every accepted word keeps its provider-reported time.
 * The source narration is only used as an exact-token validation gate.
 */
export function selectExactBlocks(expected, blocks) {
  if (!Array.isArray(expected) || !Array.isArray(blocks)) throw Error("Expected tokens and timed annotation blocks are required.");
  const n = expected.length, m = blocks.length;
  const scores = Array.from({length:m + 1}, () => Array(n + 1).fill(-Infinity));
  const back = Array.from({length:m + 1}, () => Array(n + 1).fill(null));
  scores[0][0] = 0;
  const set = (i,j,v,previous) => {
    if (v > scores[i][j]) {
      scores[i][j] = v;
      back[i][j] = previous;
    }
  };
  for (let i=0;i<=m;i++) {
    for (let j=0;j<=n;j++) {
      const score=scores[i][j];
      if (!Number.isFinite(score)) continue;
      if (i < m) {
        const block=blocks[i];
        const tokens=block.tokens ?? [];
        if (tokens.length && j+tokens.length<=n &&
            tokens.every((x,k)=>x===expected[j+k].text)) {
          set(i+1,j+tokens.length,score+tokens.length,{i,j,matched:true});
        }
        set(i+1,j,score,{i,j,matched:false});
      }
      if (j < n) set(i,j+1,score,{i,j,matched:false});
    }
  }
  const matches=[];
  let i=m,j=n;
  while(i||j) {
    const prev=back[i][j];
    if (!prev) throw Error("Word selection could not be reconstructed.");
    if(prev.matched)matches.push({blockIndex:prev.i,from:prev.j,to:j});
    i=prev.i;j=prev.j;
  }
  matches.reverse();
  return matches;
}

export function buildRecoveryPlan(expected, blocks, durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) throw Error("Exact source audio duration required.");
  for (const b of blocks) {
    if (!Number.isFinite(b.startMs)||!Number.isFinite(b.endMs)||
        b.startMs<0||b.endMs<=b.startMs||b.endMs>durationMs+100)
      throw Error("Invalid provider timing in original transcription.");
  }
  const matched=selectExactBlocks(expected,blocks);
  const gaps=[];
  let cursor=0, previous=null;
  for(const match of [...matched,{from:expected.length,to:expected.length,blockIndex:null}]) {
    if(cursor<match.from) {
      const next=match.blockIndex===null?null:blocks[match.blockIndex];
      const startMs=previous?previous.endMs:0;
      const endMs=next?next.startMs:durationMs;
      if(endMs<=startMs)throw Error("No audible clip between verified word boundaries.");
      const tokens=expected.slice(cursor,match.from);
      const languages=[...new Set(tokens.map(x=>x.language))];
      if(languages.length!==1||!["zh","locale"].includes(languages[0]))
        throw Error("Missing passage mixes languages without a verified word boundary.");
      gaps.push({from:cursor,to:match.from,startMs,endMs,language:languages[0],
        tokens:tokens.map(x=>x.text)});
    }
    if(match.blockIndex!==null)previous=blocks[match.blockIndex];
    cursor=match.to;
  }
  return {matches,gaps,matchedTokenCount:matched.reduce((s,x)=>s+x.to-x.from,0)};
}

export function selectRecoveredBlocks(tokens,blocks) {
  const expected=tokens.map(text=>({text}));
  const matches=selectExactBlocks(expected,blocks);
  if(matches.reduce((s,m)=>s+m.to-m.from,0)!==tokens.length)
    throw Error("Gemini recovery clip did not exactly transcribe every missing word.");
  if(!matches.length)throw Error("Recovery has no verified provider word annotations.");
  let cursor=0,lastStart=-1;
  for(const m of matches) {
    if(m.from!==cursor)throw Error("Missing exact recovered word.");
    const b=blocks[m.blockIndex];
    if(b.startMs<lastStart)throw Error("Recovered word timing moves backwards.");
    lastStart=b.startMs;
    cursor=m.to;
  }
  return matches.map(m=>blocks[m.blockIndex]);
}

export function mergeRecoveredBlocks(expected,original,plan,recovered) {
  const combined=[];
  for(const m of plan.matches)combined.push({from:m.from,to:m.to,block:original[m.blockIndex]});
  for(let i=0;i<plan.gaps.length;i++){
    const gap=plan.gaps[i], blocks=recovered[i];
    if(!Array.isArray(blocks))throw Error("Missing recovered clip blocks.");
    let j=gap.from;
    for(const b of blocks){
      combined.push({from:j,to:j+b.tokens.length,block:b});
      j+=b.tokens.length;
    }
    if(j!==gap.to)throw Error("Recovered clip did not cover the full missing passage.");
  }
  combined.sort((a,b)=>a.from-b.from);
  let cursor=0,lastStart=-1;
  for(const item of combined){
    if(item.from!==cursor)throw Error("Missing/overlapping annotation in merged transcript.");
    if(item.block.startMs<lastStart)throw Error("Merged source timestamps run backwards.");
    lastStart=item.block.startMs;
    cursor=item.to;
  }
  if(cursor!==expected.length)throw Error("Merged transcript does not exactly cover narration.");
  return combined.map(x=>x.block);
}
