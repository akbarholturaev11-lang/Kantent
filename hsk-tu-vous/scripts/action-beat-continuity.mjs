/**
 * Deterministic, audio-cue-safe continuity between successive action beats.
 * The outgoing visual freezes on its last frame; the incoming visual begins at
 * its exact verified word cue. Never alters Remotion/audio/scene duration.
 */
const clamp01 = value => Math.min(1, Math.max(0, value));
const ease = t => { const x = clamp01(t); return x * x * (3 - 2 * x); };

export function resolveActionBeatLayers(beats, frame, transitionFrames = 8) {
  if (!Array.isArray(beats) || beats.length === 0) throw Error("Action continuity requires nonempty resolved beats");
  if (!Number.isFinite(frame)) throw Error("Action continuity requires a finite scene-local frame");
  if (!Number.isInteger(transitionFrames) || transitionFrames < 0 || transitionFrames > 120)
    throw Error("Action continuity transitionFrames must be 0..120");
  for (let i = 0; i < beats.length; i++) {
    if (!beats[i] || !Number.isInteger(beats[i].localFrame) ||
      (i > 0 && beats[i].localFrame <= beats[i - 1].localFrame))
      throw Error("Action continuity requires strictly increasing integer cue frames");
  }

  let activeIndex = 0;
  for (let i = 1; i < beats.length; i++) {
    if (frame < beats[i].localFrame) break;
    activeIndex = i;
  }
  const active = beats[activeIndex];
  const localFrame = Math.max(0, frame - active.localFrame);
  if (activeIndex === 0 || transitionFrames === 0 || localFrame >= transitionFrames)
    return { active, incoming: { beat: active, localFrame, opacity: 1 }, outgoing: null };

  const previous = beats[activeIndex - 1];
  // One visible step on the exact cue frame: a newly spoken action is never
  // drawn before its verified cue, yet the viewer sees its first motion there.
  const progress = ease((localFrame + 1) / transitionFrames);
  return {
    active,
    incoming: { beat: active, localFrame, opacity: progress },
    outgoing: {
      beat: previous,
      localFrame: Math.max(0, active.localFrame - previous.localFrame - 1),
      opacity: 1 - progress,
    },
  };
}
