export function hasCurrentImportedVoice(
  episode: any,
  voiceProfile: { provider: string; profileId: string; locale: string },
  options: { projectRoot: string; readFile?: (path: string) => Promise<Buffer> },
): Promise<boolean>;
export function assertImportedAudioHash(episode: any, bytes: Buffer): true;
