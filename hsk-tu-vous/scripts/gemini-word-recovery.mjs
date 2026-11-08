/**
 * Recovery planning for Gemini word annotations. This module NEVER generates
 * a timestamp: every accepted word keeps its provider-reported time.
 * The source narration is only used as an exact-token validation gate.
 */
export function selectExactBlocks(expected, blocks, match = (wanted, heard) => wanted === heard) {
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
            tokens.every((x,k)=>match(expected[j+k].text,x))) {
          set(i+1,j+tokens.length,score+tokens.length,{i,j,matched:true,count:1});
        }
        // One recognized token may be the exact join of 2–3 written locale
        // words ("тоже" for "то же"); the covered words share its span.
        if (tokens.length===1) {
          for (let words=2; words<=3 && j+words<=n; words++) {
            const span=expected.slice(j,j+words).map(x=>x.text);
            if (span.some(x=>/\p{Script=Han}/u.test(x))) break;
            if (match(span.join(""),tokens[0])) {
              set(i+1,j+words,score+words,{i,j,matched:true,count:1});
              break;
            }
          }
        }
        // A recognizer may split one written word into 2–3 timed words
        // ("қад"+"баландтар"); their exact concatenation can cover it.
        for (let count=2; count<=3 && j<n && i+count<=m; count++) {
          const span=blocks.slice(i,i+count);
          if (!span.every(b=>(b.tokens??[]).length===1)) break;
          if (match(expected[j].text,span.map(b=>b.tokens[0]).join("")))
            set(i+count,j+1,score+1,{i,j,matched:true,count});
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
    if(prev.matched)matches.push({blockIndex:prev.i,blockCount:prev.count,from:prev.j,to:j});
    i=prev.i;j=prev.j;
  }
  matches.reverse();
  return matches;
}

export function buildRecoveryPlan(expected, blocks, durationMs, { match } = {}) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) throw Error("Exact source audio duration required.");
  for (const b of blocks) {
    if (!Number.isFinite(b.startMs)||!Number.isFinite(b.endMs)||
        b.startMs<0||b.endMs<=b.startMs||b.endMs>durationMs+100)
      throw Error("Invalid provider timing in original transcription.");
  }
  const matched=selectExactBlocks(expected,blocks,match);
  const gaps=[];
  let cursor=0, previous=null;
  for(const match of [...matched,{from:expected.length,to:expected.length,blockIndex:null}]) {
    if(cursor<match.from) {
      const next=match.blockIndex===null?null:blocks[match.blockIndex];
      const startMs=previous?previous.endMs:0;
      const endMs=next?next.startMs:durationMs;
      const tokens=expected.slice(cursor,match.from);
      const languages=[...new Set(tokens.map(x=>x.language))].sort();
      // Real 2026-11-08 RU take: STT dropped the interleaved "с 比 или с 很".
      // A RU/TG+Mandarin gap with no verified inner boundary is transcribed
      // once with both language hints; the exact-token gate still decides.
      const language=languages.length===1&&["zh","locale"].includes(languages[0])?languages[0]:
        languages.join("+")==="locale+zh"?"mixed":null;
      if(!language)
        throw Error("Missing passage mixes languages without a verified word boundary.");
      // Verified neighbours that touch or overlap leave no audio to cut: the
      // gap is kept (a language pass may still fill it) but marked, and no
      // clip is ever cut for it. Real TG one-take 2026-11-08.
      gaps.push({from:cursor,to:match.from,startMs,endMs,language,
        tokens:tokens.map(x=>x.text),...(endMs<=startMs?{noAudio:true}:{})});
    }
    if(match.blockIndex!==null)previous=blocks[match.blockIndex+(match.blockCount??1)-1];
    cursor=match.to;
  }
  return {matches:matched,gaps,matchedTokenCount:matched.reduce((s,x)=>s+x.to-x.from,0)};
}

export function selectRecoveredBlocks(tokens,blocks,{ match } = {}) {
  const expected=tokens.map(text=>({text}));
  const matches=selectExactBlocks(expected,blocks,match);
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
  return matches.map(m=>spanBlock(blocks,m));
}

/** One annotation for a matched span (several split words → one word). */
export function spanBlock(blocks,m) {
  const count=m.blockCount??1;
  const covered=m.to-m.from;
  if(count===1)return covered>1&&(blocks[m.blockIndex].tokens??[]).length===1
    ?{...blocks[m.blockIndex],covers:covered}:blocks[m.blockIndex];
  const span=blocks.slice(m.blockIndex,m.blockIndex+count);
  return {...span[0],text:span.map(b=>b.text).join(""),tokens:[span.map(b=>b.tokens[0]).join("")],
    endMs:Math.max(...span.map(b=>b.endMs)),mergedBlocks:count};
}

export function mergeRecoveredBlocks(expected,original,plan,recovered) {
  const combined=[];
  for(const m of plan.matches)combined.push({from:m.from,to:m.to,block:spanBlock(original,m)});
  for(let i=0;i<plan.gaps.length;i++){
    const gap=plan.gaps[i], blocks=recovered[i];
    if(!Array.isArray(blocks))throw Error("Missing recovered clip blocks.");
    let j=gap.from;
    for(const b of blocks){
      const width=b.covers??b.tokens.length;
      combined.push({from:j,to:j+width,block:b});
      j+=width;
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
