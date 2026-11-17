/**
 * Original sound effects for the professional motion system, synthesized
 * here from deterministic noise and sine partials (no third-party audio, no
 * download, no AI API). Same code → byte-identical WAVs; the committed
 * public/sfx/pro/manifest.json records each file's SHA-256 and the test
 * rebuilds them to prove it.
 *
 *   node scripts/build-pro-sfx.mjs            # (re)write public/sfx/pro
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

export const SAMPLE_RATE = 48000;
const TAU = Math.PI * 2;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

/** RBJ biquad whose centre/cutoff may move every sample. */
function biquad(kind) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x, freq, q) => {
    const w = TAU * Math.min(freq, SAMPLE_RATE * 0.45) / SAMPLE_RATE, cos = Math.cos(w), alpha = Math.sin(w) / (2 * q);
    let b0, b1, b2;
    if (kind === "band") { b0 = alpha; b1 = 0; b2 = -alpha; }
    else if (kind === "low") { b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2; }
    else { b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2; }
    const a0 = 1 + alpha, a1 = -2 * cos, a2 = 1 - alpha;
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

/** Rise to the peak as a square curve, then an exponential release. */
const swell = (t, peak, release) => (t < peak ? (t / peak) ** 2 : Math.exp(-(t - peak) / release));
const sweep = (t, peak, start, top, end) => (t < peak ? start * (top / start) ** (t / peak)
  : top * (end / top) ** Math.min(1, (t - peak) / Math.max(1e-6, 1 - peak)));

function whoosh({ seconds, peak, release, start, top, end, q, seed, body = 0 }) {
  const noise = rng(seed), band = biquad("band"), low = biquad("low");
  return (t) => {
    const n = noise();
    const centre = sweep(t / seconds, peak / seconds, start, top, end);
    return swell(t, peak, release) * (band(n, centre, q) * 2.2 + (body ? low(n, centre * 0.5, 0.7) * body : 0));
  };
}

const VOICES = {
  "whoosh-soft": { seconds: 0.567, peak: 0.6, voice: whoosh({ seconds: 0.567, peak: 0.32, release: 0.08, start: 350, top: 2200, end: 900, q: 0.9, seed: 11, body: 0.5 }) },
  "whoosh-fast": { seconds: 0.333, peak: 0.6, voice: whoosh({ seconds: 0.333, peak: 0.17, release: 0.05, start: 600, top: 3200, end: 1500, q: 1.1, seed: 23 }) },
  "whoosh-deep": { seconds: 0.8, peak: 0.66, voice: (() => {
    const air = whoosh({ seconds: 0.8, peak: 0.45, release: 0.12, start: 150, top: 1400, end: 250, q: 0.8, seed: 37, body: 1 });
    let phase = 0;
    return (t) => {
      phase += TAU * (60 - 22 * Math.min(1, t / 0.8)) / SAMPLE_RATE;
      return air(t) + Math.sin(phase) * 0.35 * swell(t, 0.45, 0.12);
    };
  })() },
  shimmer: { seconds: 1.0, peak: 0.5, voice: (() => {
    const partials = [2093, 2637, 3136, 3951, 4699];
    const noise = rng(41), band = biquad("band");
    return (t) => partials.reduce((sum, freq, index) => {
      const local = t - index * 0.07;
      return local < 0 ? sum : sum + Math.sin(TAU * freq * local) * Math.min(1, local / 0.01) * Math.exp(-local / 0.28) * 0.2;
    }, band(noise(), 7000, 0.8) * 0.12 * Math.sin(Math.PI * Math.min(1, t / 0.6)));
  })() },
  chime: { seconds: 1.1, peak: 0.55, voice: (t) => [[1318.51, 0], [1975.53, 0.085]].reduce((sum, [freq, at]) => {
    const local = t - at;
    if (local < 0) return sum;
    const env = Math.min(1, local / 0.004) * Math.exp(-local / 0.32);
    return sum + env * (Math.sin(TAU * freq * local) + 0.25 * Math.sin(TAU * 2 * freq * local) + 0.1 * Math.sin(TAU * 3 * freq * local));
  }, 0) },
  impact: { seconds: 0.5, peak: 0.66, voice: (() => {
    const noise = rng(53), low = biquad("low");
    let phase = 0;
    return (t) => {
      phase += TAU * (45 + 90 * Math.exp(-t / 0.05)) / SAMPLE_RATE;
      const thump = Math.sin(phase) * Math.min(1, t / 0.002) * Math.exp(-t / 0.13);
      return Math.tanh(1.6 * (thump + low(noise(), 900, 0.7) * Math.exp(-t / 0.025) * 0.6));
    };
  })() },
};
for (const [id, base] of [["pop-a", 760], ["pop-b", 640], ["pop-c", 880]]) {
  VOICES[id] = { seconds: 0.167, peak: 0.5, voice: (() => {
    let phase = 0;
    return (t) => {
      phase += TAU * base * (1 + 1.2 * Math.exp(-t / 0.012)) / SAMPLE_RATE;
      const env = Math.min(1, t / 0.002) * Math.exp(-t / 0.04);
      return env * (Math.sin(phase) + 0.2 * Math.sin(2 * phase));
    };
  })() };
}
export const SOUND_IDS = Object.keys(VOICES).sort();

/** 16-bit mono PCM WAV of one effect: DC-blocked, peak-normalized, faded. */
export function synthesize(id) {
  const spec = VOICES[id];
  if (!spec) throw Error("Unknown pro SFX " + id);
  const count = Math.round(spec.seconds * SAMPLE_RATE);
  const dc = biquad("high"), raw = new Float64Array(count);
  for (let i = 0; i < count; i++) raw[i] = dc(spec.voice(i / SAMPLE_RATE), 25, 0.707);
  const fade = Math.round(0.01 * SAMPLE_RATE);
  for (let i = 0; i < fade; i++) raw[count - 1 - i] *= i / fade;
  const peak = raw.reduce((max, value) => Math.max(max, Math.abs(value)), 0) || 1;
  const data = Buffer.alloc(count * 2);
  for (let i = 0; i < count; i++) data.writeInt16LE(Math.round((raw[i] / peak) * spec.peak * 32767), i * 2);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + data.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24); header.writeUInt32LE(SAMPLE_RATE * 2, 28); header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(data.length, 40);
  return { wav: Buffer.concat([header, data]), durationMs: Math.round((count / SAMPLE_RATE) * 1000), peakDbfs: 20 * Math.log10(spec.peak) };
}

export const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

export async function writeProSfx(dir) {
  await fs.mkdir(dir, { recursive: true });
  const sounds = [];
  for (const id of SOUND_IDS) {
    const { wav, durationMs, peakDbfs } = synthesize(id);
    await fs.writeFile(path.join(dir, id + ".wav"), wav);
    sounds.push({ id, file: "sfx/pro/" + id + ".wav", durationMs, peakDbfs: Math.round(peakDbfs * 10) / 10, sha256: sha256(wav) });
  }
  const manifest = { schemaVersion: 1, generator: "scripts/build-pro-sfx.mjs", sampleRate: SAMPLE_RATE, channels: 1,
    license: "Original effects synthesized in this repository from deterministic noise and sine partials; no third-party audio.",
    sounds };
  await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dir = fileURLToPath(new URL("../public/sfx/pro/", import.meta.url));
  const manifest = await writeProSfx(dir);
  console.log(JSON.stringify(manifest.sounds.map(({ id, durationMs, peakDbfs }) => ({ id, durationMs, peakDbfs }))));
}
