/**
 * Plan bounded transcription clips using only measured pauses in the original
 * WAV. A boundary never comes from transcript interpolation or TTS guesses.
 */
export function planSilenceClips(durationMs, pauses, {
  targetMs = 8000, minMs = 3200, maxMs = 12000, maxClips = 8,
} = {}) {
  if (!Number.isFinite(durationMs) || durationMs <= 0 || !Array.isArray(pauses)) {
    throw new Error("Measured source duration and silence pauses are required.");
  }
  const cuts = pauses.flatMap((p) => {
    if (!Number.isFinite(p.startMs) || !Number.isFinite(p.endMs) ||
        p.startMs < 0 || p.endMs <= p.startMs || p.endMs > durationMs ||
        p.endMs - p.startMs < 300) return [];
    return [(p.startMs + p.endMs) / 2];
  }).sort((a,b)=>a-b);
  const clips=[];
  let start=0;
  while (durationMs-start > maxMs) {
    if (clips.length >= maxClips-1) {
      throw new Error("Silence recovery would exceed the bounded clip budget.");
    }
    const available=cuts.filter(t=>t-start>=minMs && t-start<=maxMs && durationMs-t>=minMs);
    if(!available.length) {
      throw new Error("No measured silent speech-safe boundary for recovery.");
    }
    const end=available.reduce((best,t)=>Math.abs(t-(start+targetMs))<Math.abs(best-(start+targetMs))?t:best);
    clips.push({startMs:start,endMs:end});
    start=end;
  }
  clips.push({startMs:start,endMs:durationMs});
  if (clips.some(c=>c.endMs-c.startMs<=0 || c.endMs-c.startMs>maxMs)) {
    throw new Error("Silence recovery clip length outside tested bounds.");
  }
  return clips;
}
