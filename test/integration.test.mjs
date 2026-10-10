import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "../server.mjs";
test("local API persists edits, rejects cross-origin writes and stale updates", async () => {
  const dir = await mkdtemp(join(tmpdir(), "motion-api-"));
  const server = await startServer({ port: 0, dataDir: dir });
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const send = (path, method, body, headers = {}) =>
      fetch(origin + path, {
        method,
        headers: { origin, "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
      });
    const made = await send("/api/projects", "POST", { mode: "example" });
    assert.equal(made.status, 201);
    const p = await made.json();
    const edited = { ...p, title: "An edited lesson" };
    assert.equal(
      (await send(`/api/projects/${p.id}`, "PUT", edited)).status,
      200,
    );
    assert.equal(
      (await send(`/api/projects/${p.id}`, "PUT", edited)).status,
      409,
    );
    const stored = await (await fetch(`${origin}/api/projects/${p.id}`)).json();
    assert.equal(stored.title, "An edited lesson");
    assert.equal(
      (
        await send(
          "/api/projects",
          "POST",
          { mode: "example" },
          { origin: "https://untrusted.example" },
        )
      ).status,
      400,
    );
    assert.equal(
      (await send("/api/projects", "POST", { mode: "unknown" })).status,
      400,
    );
    const html = await (
      await fetch(`${origin}/composition/${p.id}/index.html`)
    ).text();
    assert.ok(html.includes('data-composition-id="motion"'));
    assert.ok(!html.includes("GEMINI_API_KEY"));
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
