import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(projectRoot, "public", "sfx");
const sampleRate = 48000;

function writeMonoWav(filePath, samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let index = 0; index < samples.length; index++) {
    const sample = Math.max(-1, Math.min(1, samples[index]));
    data.writeInt16LE(Math.round(sample * 32767), index * 2);
  }

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return fs.writeFile(filePath, Buffer.concat([header, data]));
}

function createSoftCut() {
  const duration = 0.24;
  const length = Math.round(sampleRate * duration);
  const samples = new Float32Array(length);
  let randomState = 413;
  for (let index = 0; index < length; index++) {
    const time = index / sampleRate;
    const progress = time / duration;
    randomState = (randomState * 16807) % 2147483647;
    const noise = (randomState / 2147483647) * 2 - 1;
    const envelope = Math.sin(Math.PI * progress) ** 1.5;
    const frequency = 980 - 610 * progress;
    const tone = Math.sin(2 * Math.PI * frequency * time);
    const airy = Math.sin(2 * Math.PI * (1500 - 800 * progress) * time);
    samples[index] = envelope * (tone * 0.16 + airy * 0.045 + noise * 0.035);
  }
  return samples;
}

function createSoftTap() {
  const duration = 0.14;
  const length = Math.round(sampleRate * duration);
  const samples = new Float32Array(length);
  for (let index = 0; index < length; index++) {
    const time = index / sampleRate;
    const progress = time / duration;
    const envelope = Math.exp(-progress * 8) * Math.min(1, progress * 32);
    const frequency = 1040 - progress * 310;
    const click = Math.sin(2 * Math.PI * 2400 * time) * Math.exp(-progress * 42);
    const tone = Math.sin(2 * Math.PI * frequency * time);
    samples[index] = envelope * (tone * 0.19 + click * 0.11);
  }
  return samples;
}

await fs.mkdir(outputDir, { recursive: true });
await Promise.all([
  writeMonoWav(path.join(outputDir, "soft-cut.wav"), createSoftCut()),
  writeMonoWav(path.join(outputDir, "soft-tap.wav"), createSoftTap()),
]);
console.log("Yengil cut va tap effektlari tayyor.");
