import test from "node:test";
import assert from "node:assert/strict";
import {extractCueFrameBatch} from "./cue-frame-batch.mjs";

test("invalid frame indices, duplicate output names and traversal are refused before ffmpeg",async()=>{
  for(const requests of [
    [{frame:-1,stem:"a"}],
    [{frame:1.5,stem:"a"}],
    [{frame:5,stem:"../secret"}],
    [{frame:0,stem:"same"},{frame:3,stem:"same"}],
    [],
  ]){
    await assert.rejects(extractCueFrameBatch("/not-used.mp4","/not-used",requests),/Frame proof requests|Invalid or duplicate/);
  }
});
