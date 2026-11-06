export function assertCaptionsDoNotCrossBoundary(captions, boundaryMs) {
  if (!Number.isFinite(boundaryMs) || boundaryMs <= 0) {
    throw new Error("The verified lesson CTA boundary is missing.");
  }
  const crossing = captions.find((caption) =>
    caption.startMs < boundaryMs && caption.endMs > boundaryMs,
  );
  if (crossing) {
    throw new Error(
      `A word cue (${crossing.startMs}–${crossing.endMs} ms) crosses the lesson CTA boundary (${boundaryMs} ms).`,
    );
  }
  return captions.filter((caption) => caption.endMs <= boundaryMs);
}
