import test from "node:test";
import assert from "node:assert/strict";
import { escapeText, sequenceScenes } from "../learner/composition.mjs";
import { compositionHTML } from "../lib/composition.mjs";
import { examplePlan, validatePlan } from "../lib/model.mjs";
test("untrusted strings remain text in composition HTML", () => {
  const p = examplePlan();
  p.title = "<script>alert(1)</script>";
  p.scenes[0].labels[0] = "<img src=x onerror=x>";
  const html = compositionHTML(p);
  assert.ok(!html.includes("<script>alert"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.equal(escapeText("\"&<>'"), "&quot;&amp;&lt;&gt;&#39;");
});
test("derived scene timing is contiguous and independent of supplied offsets", () => {
  assert.deepEqual(
    sequenceScenes([
      { duration: 3, start: 55 },
      { duration: 4, start: -9 },
    ]).map((s) => [s.start, s.end]),
    [
      [0, 3],
      [3, 7],
    ],
  );
  assert.throws(() => sequenceScenes([{ duration: NaN }]));
});
test("plan validates every value, supported shape and total runtime", () => {
  assert.equal(validatePlan(examplePlan()).scenes.length, 4);
  for (const mutate of [
    (p) => (p.scenes[0].duration = -1),
    (p) => (p.scenes[0].kind = "shell"),
    (p) => (p.scenes[0].labels = ["x"]),
    (p) => (p.scenes[0].text = "x".repeat(181)),
    (p) => (p.scenes = Array(6).fill({ ...p.scenes[0], duration: 12 })),
  ]) {
    const p = examplePlan();
    mutate(p);
    assert.throws(() => validatePlan(p));
  }
});
