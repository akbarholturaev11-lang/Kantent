/**
 * Silence-bounded STT windows for one-take narration (owner decision
 * 2026-11-08: one TTS take per language is the default).
 *
 * Real 2026-11-08 evidence on the saved RU one-take (57 s):
 *  - one whole-file STT request failed (timings moved backwards) and the
 *    OpenRouter backup returned 10 of 131 words for the 60 s TG take;
 *  - the SAME saved audio cut at measured silences into ~12–23 s windows
 *    came back with every Russian word from both Gemini Direct and OpenRouter.
 *
 * Windows only cut inside measured silence, never inside speech, and every
 * returned timestamp is the provider's own, offset by the window's exact
 * start. Nothing is interpolated.
 */

export const STT_WINDOW_MIN_AUDIO_MS = 25_000;
export const STT_WINDOW_TARGET_MS = 22_000;
export const STT_WINDOW_MIN_MS = 4_000;

/** Silence intervals from `ffmpeg -af silencedetect` stderr. */
export function parseSilences(log) {
  const text = String(log ?? "");
  const starts = [...text.matchAll(/silence_start:\s*(-?[\d.]+)/g)].map((m) => Number(m[1]) * 1000);
  const ends = [...text.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => Number(m[1]) * 1000);
  return starts.map((start, index) => ({
    startMs: Math.max(0, Math.round(start)),
    endMs: Math.round(ends[index] ?? start),
  })).filter((s) => Number.isFinite(s.startMs) && Number.isFinite(s.endMs) && s.endMs > s.startMs);
}

/**
 * Exact window boundaries at silence midpoints. Short audio stays one window.
 * Throws instead of cutting through speech when no silence is available.
 */
export function planSttWindows({ durationMs, silences, targetMs = STT_WINDOW_TARGET_MS,
  minMs = STT_WINDOW_MIN_MS, minAudioMs = STT_WINDOW_MIN_AUDIO_MS }) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error("Exact audio duration is required for STT windows.");
  if (durationMs < minAudioMs) return [{ startMs: 0, endMs: durationMs }];
  const cuts = (silences ?? [])
    .map((s) => Math.round((s.startMs + s.endMs) / 2))
    .filter((mid) => mid >= minMs && mid <= durationMs - minMs)
    .sort((a, b) => a - b);
  const bounds = [0];
  while (durationMs - bounds.at(-1) > targetMs) {
    const from = bounds.at(-1);
    const options = cuts.filter((mid) => mid >= from + minMs && mid <= from + targetMs);
    if (!options.length)
      throw new Error(`No measured silence between ${from} ms and ${from + targetMs} ms; refusing to cut STT windows through speech.`);
    bounds.push(options.at(-1));
  }
  bounds.push(durationMs);
  return bounds.slice(0, -1).map((startMs, index) => ({ startMs, endMs: bounds[index + 1] }));
}

/** Provider word annotations of one window moved to whole-take time. */
export function offsetAnnotations(annotations, offsetMs) {
  const shift = (value) => {
    const match = typeof value === "string" ? value.match(/^(-?\d+(?:\.\d+)?)s$/) : null;
    const seconds = typeof value === "number" ? value : match ? Number(match[1]) : Number.NaN;
    if (!Number.isFinite(seconds)) throw new Error(`Unrecognized provider word timestamp: ${value}`);
    return ((Math.round(seconds * 1000) + offsetMs) / 1000).toFixed(3) + "s";
  };
  return annotations.map((word) => ({
    text: word.text,
    startOffset: shift(word.startOffset ?? word.start_offset),
    endOffset: shift(word.endOffset ?? word.end_offset),
  }));
}

/** Indexes of windows that overlap any of the given [startMs,endMs) spans. */
export function windowsTouching(windows, spans) {
  return windows.map((w, index) => ({ w, index }))
    .filter(({ w }) => spans.some((s) => s.startMs < w.endMs && s.endMs > w.startMs))
    .map(({ index }) => index);
}
