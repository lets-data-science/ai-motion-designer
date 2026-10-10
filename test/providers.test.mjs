import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generatePlan } from "../lib/providers.mjs";
import { examplePlan } from "../lib/model.mjs";
test("provider has explicit cache, attempt budget, and no automatic retries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "motion-provider-"));
  let calls = 0;
  const mock = async () => {
    calls++;
    return {
      ok: true,
      json: async () => ({
        candidates: [
          { content: { parts: [{ text: JSON.stringify(examplePlan()) }] } },
        ],
      }),
    };
  };
  const opts = { key: "test-key", dailyLimit: 1, fetch: mock };
  assert.equal(
    (await generatePlan("Explain next-token prediction.", dir, opts)).cached,
    false,
  );
  assert.equal(
    (await generatePlan("Explain next-token prediction.", dir, opts)).cached,
    true,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    () => generatePlan("Explain attention in a transformer.", dir, opts),
    /limit/,
  );
  assert.equal(calls, 1);
  assert.equal(
    JSON.parse(await readFile(join(dir, "ai-usage.json"), "utf8")).attempts,
    1,
  );
});
test("failed requests consume one attempt and preserve manual mode", async () => {
  const dir = await mkdtemp(join(tmpdir(), "motion-failed-"));
  let calls = 0;
  await assert.rejects(
    () =>
      generatePlan("Explain a valid topic.", dir, {
        key: "test-key",
        fetch: async () => {
          calls++;
          return { ok: false, status: 429 };
        },
      }),
    /429/,
  );
  assert.equal(calls, 1);
});
test("invalid saved AI response is not billed again on an identical prompt", async () => {
  const dir = await mkdtemp(join(tmpdir(), "motion-invalid-"));
  let calls = 0;
  const invalid = examplePlan();
  invalid.scenes[0].duration = 99;
  const opts = {
    key: "test-key",
    fetch: async () => {
      calls++;
      return {
        ok: true,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: JSON.stringify(invalid) }] } },
          ],
        }),
      };
    },
  };
  await assert.rejects(() =>
    generatePlan("Explain next-token prediction.", dir, opts),
  );
  await assert.rejects(
    () => generatePlan("Explain next-token prediction.", dir, opts),
    /no new API request/,
  );
  assert.equal(calls, 1);
});
test("simultaneous AI requests cannot double-spend the budget", async () => {
  const dir = await mkdtemp(join(tmpdir(), "motion-lock-"));
  let calls = 0;
  const opts = {
    key: "test-key",
    fetch: async () => {
      calls++;
      return {
        ok: true,
        json: async () => ({
          candidates: [
            { content: { parts: [{ text: JSON.stringify(examplePlan()) }] } },
          ],
        }),
      };
    },
  };
  const first = generatePlan("Explain one clear concept.", dir, opts);
  await assert.rejects(
    () => generatePlan("Explain another concept.", dir, opts),
    /already in progress/,
  );
  await first;
  assert.equal(calls, 1);
});
