export function activeNarratedBeat(beats, frame) {
  return beats.filter((beat) => frame >= beat.localFrame).at(-1) ?? null;
}
