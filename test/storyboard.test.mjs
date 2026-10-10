import test from "node:test";
import assert from "node:assert/strict";
import { storyboardPrompt } from "../learner/storyboard.mjs";
test("planning contract bounds generation and does not promise correctness", () => {
  const p = storyboardPrompt(
    "Explain next-token prediction for a new student.",
  );
  for (const term of [
    "duration",
    "labels",
    "45 seconds",
    "Never invent",
    "HTML",
    "user brief",
  ])
    assert.ok(p.toLowerCase().includes(term.toLowerCase()), term);
});
test("reject incomplete and overlong briefs before a provider call", () => {
  for (const value of ["", null, {}, "x".repeat(1801)])
    assert.throws(() => storyboardPrompt(value));
});
