import test from "node:test";
import assert from "node:assert/strict";
import {verifyWavBytes} from "./prepare-archived-voice-remotion.mjs";
test("accept only original 24kHz PCM16 mono RIFF and compute exact length",()=>{
 const f=Buffer.alloc(44+48000);f.write("RIFF",0);f.writeUInt32LE(f.length-8,4);f.write("WAVEfmt ",8);f.writeUInt32LE(16,16);f.writeUInt16LE(1,20);f.writeUInt16LE(1,22);f.writeUInt32LE(24000,24);f.writeUInt32LE(48000,28);f.writeUInt16LE(2,32);f.writeUInt16LE(16,34);f.write("data",36);f.writeUInt32LE(48000,40);
 assert.equal(verifyWavBytes(f).durationSec,1);
 const s=Buffer.from(f);s.writeUInt16LE(2,22);
 assert.throws(()=>verifyWavBytes(s),/mono PCM16/);
 const r=Buffer.from(f);r.writeUInt32LE(9e6,40);
 assert.throws(()=>verifyWavBytes(r),/incomplete RIFF/);
});
