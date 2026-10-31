import test from "node:test";
import assert from "node:assert/strict";
import {splitExperimentalMandarinUnits} from "./mandarin-erhua-units.mjs";

test("spoken 点儿 is a single timed unit while preserving exact original Hanzi",()=>{
  assert.deepEqual(splitExperimentalMandarinUnits("这个有点儿贵"),["这","个","有","点儿","贵"]);
  assert.deepEqual(splitExperimentalMandarinUnits("便宜一点儿"),["便","宜","一","点儿"]);
  assert.deepEqual(splitExperimentalMandarinUnits("有点儿"),["有","点儿"]);
});
test("no global 儿 swallowing on words not verified to be diǎnr",()=>{
  assert.deepEqual(splitExperimentalMandarinUnits("儿子"),["儿","子"]);
  assert.deepEqual(splitExperimentalMandarinUnits("花儿"),["花","儿"]);
  assert.deepEqual(splitExperimentalMandarinUnits("点子"),["点","子"]);
});
test("fail closed on mixed or empty input rather than rewrite",()=>{
  for(const t of ["","一点儿 ru","一点儿!","123",null])
    assert.throws(()=>splitExperimentalMandarinUnits(t),/Hanzi/);
});
