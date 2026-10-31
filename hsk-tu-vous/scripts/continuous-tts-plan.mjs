/**
 * Opt-in continuous Gemini TTS plan. Keep one provider take for a complete
 * language-specific narration, rather than independently voicing each scene.
 *
 * Do not rewrite spoken text or mix languages. Word-cue recovery and exact
 * script alignment remain the caller's responsibility.
 */
export const MAX_CONTINUOUS_TTS_CHARACTERS = 12000;

export function createContinuousTtsChunks(
  episode,
  { maxCharacters = MAX_CONTINUOUS_TTS_CHARACTERS, expectedNarration } = {},
) {
  if (!Array.isArray(episode?.scenes) || episode.scenes.length === 0) {
    throw new Error("Continuous TTS requires at least one authored scene.");
  }
  if (!Number.isInteger(maxCharacters) || maxCharacters <= 0) {
    throw new Error("Continuous TTS character limit must be a positive integer.");
  }
  const sceneIds = [];
  const narrations = [];
  for (const scene of episode.scenes) {
    if (!scene || typeof scene.id !== "string" || !scene.id.trim() ||
        typeof scene.narration !== "string" || !scene.narration.trim()) {
      throw new Error("Continuous TTS requires a nonempty ID and narration in every scene.");
    }
    if (sceneIds.includes(scene.id)) {
      throw new Error("Continuous TTS refuses repeated scene IDs.");
    }
    sceneIds.push(scene.id);
    narrations.push(scene.narration.trim());
  }
  // Match the production episode's narration fingerprint exactly. No
  // pronunciation rewrites, padding, voice tags or extra instruction text.
  const text = narrations.join(" ").replace(/\s+/gu, " ").trim();
  if (!text) throw new Error("Continuous TTS narration is empty.");
  if (expectedNarration !== undefined && expectedNarration !== text) {
    throw new Error("Continuous TTS differs from the exact approved narration.");
  }
  if (text.length > maxCharacters) {
    throw new Error(
      `Continuous TTS needs ${text.length} characters (limit ${maxCharacters}); refusing silent scene fallback or extra paid requests.`,
    );
  }
  return [{ text, sceneIds }];
}
