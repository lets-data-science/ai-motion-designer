import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { storyboardPrompt } from "../learner/storyboard.mjs";
import { validatePlan } from "./model.mjs";
let busy = false;
const schema = {
  type: "OBJECT",
  required: ["title", "scenes"],
  properties: {
    title: { type: "STRING" },
    scenes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        required: ["title", "text", "duration", "kind", "labels"],
        properties: {
          title: { type: "STRING" },
          text: { type: "STRING" },
          duration: { type: "NUMBER" },
          kind: { type: "STRING", enum: ["tokens", "pipeline", "compare"] },
          labels: { type: "ARRAY", items: { type: "STRING" } },
        },
      },
    },
  },
};
export async function generatePlan(brief, dataDir, options = {}) {
  if (busy)
    throw new Error(
      "One AI draft is already in progress. Wait for it to finish.",
    );
  busy = true;
  try {
    const instruction = storyboardPrompt(brief);
    const key = options.key ?? process.env.GEMINI_API_KEY;
    const model =
      options.model ?? process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
    if (!key)
      throw new Error(
        "Add GEMINI_API_KEY to .env.local and restart. Manual editing and export work without a key.",
      );
    if (!/^[a-z0-9.-]+$/.test(model)) throw new Error("Invalid GEMINI_MODEL.");
    const cacheDir = join(dataDir, "ai-cache");
    await mkdir(cacheDir, { recursive: true });
    const hash = createHash("sha256")
      .update(JSON.stringify({ instruction, model, schema }))
      .digest("hex");
    const cachePath = join(cacheDir, `${hash}.json`);
    try {
      const cached = JSON.parse(await readFile(cachePath, "utf8"));
      return { plan: validatePlan(cached), cached: true };
    } catch (error) {
      if (error.code !== "ENOENT")
        throw new Error(
          "The cached AI response is invalid. Inspect .data/ai-cache before another request.",
        );
    }
    // Revalidate a previously saved raw reply before considering another paid request.
    // Invalid drafts stay inspectable; repeating the same brief never silently bills again.
    try {
      const payload = JSON.parse(
        await readFile(join(cacheDir, `${hash}.response.json`), "utf8"),
      );
      const raw = payload.candidates?.[0]?.content?.parts
        ?.filter((part) => typeof part.text === "string")
        .map((part) => part.text)
        .join("");
      const plan = validatePlan(JSON.parse(raw));
      await writeFile(cachePath, JSON.stringify(plan), { mode: 0o600 });
      return { plan, cached: true, recovered: true };
    } catch (error) {
      if (error.code !== "ENOENT")
        throw new Error(
          "The saved AI response still needs review. Inspect .data/ai-cache; no new API request was sent.",
        );
    }
    const usageFile = join(dataDir, "ai-usage.json");
    const day = new Date().toISOString().slice(0, 10);
    let usage = { day, attempts: 0 };
    try {
      const stored = JSON.parse(await readFile(usageFile, "utf8"));
      if (stored.day === day) usage = stored;
    } catch (error) {
      if (error.code !== "ENOENT")
        throw new Error(
          "Cannot read the AI usage ledger. Fix it before sending another request.",
        );
    }
    const configured = Number(
      options.dailyLimit ?? process.env.GEMINI_DAILY_LIMIT ?? 5,
    );
    const limit =
      Number.isInteger(configured) && configured >= 0 && configured <= 20
        ? configured
        : 5;
    if (usage.attempts >= limit)
      throw new Error(
        `Daily AI request limit reached (${limit}). Manual editing is still available.`,
      );
    usage.attempts++;
    await writeFile(usageFile, JSON.stringify(usage), { mode: 0o600 });
    const response = await (options.fetch ?? fetch)(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ parts: [{ text: instruction }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema,
            maxOutputTokens: 3500,
            temperature: 0.4,
          },
        }),
        signal: AbortSignal.timeout(60000),
      },
    );
    if (!response.ok)
      throw new Error(
        `Gemini returned HTTP ${response.status}. No automatic retry was made.`,
      );
    const payload = await response.json();
    const raw = payload.candidates?.[0]?.content?.parts
      ?.filter((part) => typeof part.text === "string")
      .map((part) => part.text)
      .join("");
    if (!raw)
      throw new Error(
        "Gemini returned no storyboard. Your existing work is unchanged.",
      );
    // Save the exact response before validating; diagnose invalid replies without paying again.
    await writeFile(
      join(cacheDir, `${hash}.response.json`),
      JSON.stringify(payload, null, 2),
      { mode: 0o600 },
    );
    const plan = validatePlan(JSON.parse(raw));
    await writeFile(cachePath, JSON.stringify(plan), { mode: 0o600 });
    return { plan, cached: false };
  } finally {
    busy = false;
  }
}
