/** Keep the exact-word gate language aware without transliterating Tajik letters. */
export function normalizeVoiceToken(value, locale) {
  const normalized = String(value).toLocaleLowerCase("und");
  return locale === "ru-RU" ? normalized.replaceAll("ё", "е") : normalized;
}

export function voiceTranscriptionLanguages(profile) {
  if (!["ru-RU", "tg-TJ"].includes(profile?.locale)) {
    throw new Error("Voice transcription requires a Russian or Tajik profile.");
  }
  // The new Tajik path uses the Transcribe API's documented Mandarin code.
  // Keep the historical Russian request unchanged.
  return [profile.locale, profile.locale === "tg-TJ" ? "cmn-Hans-CN" : "zh-CN"];
}

export function assertVoiceEpisodeLanguage(episode, profile) {
  if (episode?.languageCode !== profile?.locale) {
    throw new Error(
      `Episode language ${episode?.languageCode ?? "missing"} does not match voice locale ${profile?.locale ?? "missing"}. Refused to mix language audio and captions.`,
    );
  }
}

/** Resume and fallback must never reuse audio produced with another language/profile. */
export function assertReusableVoiceMetadata(metadata, profile) {
  const legacyRussian = profile.locale === "ru-RU";
  if (
    metadata?.provider !== profile.provider ||
    metadata.ttsModel !== profile.ttsModel ||
    metadata.voice !== profile.voiceName ||
    metadata.transcriptionModel !== profile.transcriptionModel ||
    (metadata.voiceProfileId !== undefined && metadata.voiceProfileId !== profile.profileId) ||
    (metadata.languageCode !== undefined && metadata.languageCode !== profile.locale) ||
    (!legacyRussian &&
      (metadata.voiceProfileId !== profile.profileId || metadata.languageCode !== profile.locale))
  ) {
    throw new Error("Saved Gemini audio language, model or voice profile does not match the active profile.");
  }
}
