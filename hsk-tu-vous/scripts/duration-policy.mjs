/** Report natural full-video timing; the target range is guidance, never a render limit. */
export function validateProductionDuration(episode, policy, fps = 30) {
  if (!policy || episode.date < policy.effectiveFromDate) return null;
  const { targetSec, targetRangeSec } = policy;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(policy.effectiveFromDate ?? "") ||
      !Array.isArray(targetRangeSec) || targetRangeSec.length !== 2 ||
      !targetRangeSec.every(Number.isFinite) ||
      targetRangeSec[0] < 0 || targetRangeSec[1] < targetRangeSec[0] ||
      !Number.isFinite(targetSec) || targetSec < targetRangeSec[0] || targetSec > targetRangeSec[1] ||
      policy.includesCta !== true || !Number.isFinite(fps) || fps <= 0) {
    throw new Error("Invalid content/visual-system.json#duration policy.");
  }
  if (!episode.scenes?.length || episode.scenes.some(scene =>
    !Number.isInteger(scene.durationFrames) || scene.durationFrames <= 0)) {
    throw new Error("Production duration requires audio-aligned scene frames.");
  }
  const durationSec = episode.scenes.reduce((sum, scene) => sum + scene.durationFrames, 0) / fps;
  return { durationSec, targetSec, targetRangeSec,
    withinTargetBand: durationSec >= targetRangeSec[0] && durationSec <= targetRangeSec[1] };
}
