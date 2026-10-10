import test from "node:test";
import assert from "node:assert/strict";
import { sceneAtTime } from "../learner/timeline.mjs";
test("seeking crosses exact boundaries and clamps outer endpoints", () => {
  const s = [{ duration: 3 }, { duration: 5 }];
  assert.deepEqual(sceneAtTime(s, 3), { index: 1, start: 3, localTime: 0 });
  assert.deepEqual(sceneAtTime(s, -2), { index: 0, start: 0, localTime: 0 });
  assert.deepEqual(sceneAtTime(s, 100), { index: 1, start: 3, localTime: 5 });
});
test("invalid clocks and empty timelines fail clearly", () => {
  for (const n of [NaN, Infinity])
    assert.throws(() => sceneAtTime([{ duration: 3 }], n));
  assert.throws(() => sceneAtTime([], 0));
  assert.throws(() => sceneAtTime([{ duration: -1 }], 0));
});
