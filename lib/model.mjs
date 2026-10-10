import { randomUUID } from "node:crypto";
const kinds = new Set(["tokens", "pipeline", "compare"]);
function text(value, name, maximum) {
  if (typeof value !== "string" || !value.trim() || value.length > maximum)
    throw new Error(`${name} must contain 1–${maximum} characters.`);
  return value.trim();
}
export function validatePlan(input) {
  if (
    !input ||
    typeof input !== "object" ||
    !Array.isArray(input.scenes) ||
    input.scenes.length < 1 ||
    input.scenes.length > 6
  )
    throw new Error("A storyboard needs 1–6 scenes.");
  const scenes = input.scenes.map((scene) => {
    if (!kinds.has(scene.kind))
      throw new Error("Choose tokens, pipeline or compare.");
    if (
      !Number.isFinite(scene.duration) ||
      scene.duration < 2 ||
      scene.duration > 12
    )
      throw new Error("Each scene must last 2–12 seconds.");
    if (
      !Array.isArray(scene.labels) ||
      scene.labels.length < 2 ||
      scene.labels.length > 4
    )
      throw new Error("Each scene needs 2–4 labels.");
    return {
      title: text(scene.title, "Scene title", 56),
      text: text(scene.text, "Explanation", 180),
      kind: scene.kind,
      duration: Math.round(scene.duration * 10) / 10,
      labels: scene.labels.map((label) => text(label, "Label", 24)),
    };
  });
  if (scenes.reduce((sum, scene) => sum + scene.duration, 0) > 60)
    throw new Error("Keep the storyboard within 60 seconds.");
  return { title: text(input.title, "Title", 56), scenes };
}
export function newProject(plan, provenance = "manual", brief = "") {
  return {
    id: randomUUID(),
    ...validatePlan(plan),
    brief,
    provenance,
    revision: 1,
    updatedAt: new Date().toISOString(),
  };
}
export function examplePlan() {
  return {
    title: "How a language model continues text",
    scenes: [
      {
        title: "Start with the text so far",
        text: "A tokenizer splits text into pieces. These word-sized pieces are illustrative; real token boundaries vary.",
        duration: 6,
        kind: "tokens",
        labels: ["The", "little", "dragon", "was"],
      },
      {
        title: "Turn context into a prediction",
        text: "The model processes earlier tokens and scores possible next tokens using its learned weights.",
        duration: 6,
        kind: "pipeline",
        labels: ["Token IDs", "Embeddings", "Transformer", "Next-token scores"],
      },
      {
        title: "Choose a continuation",
        text: "A decoding rule selects a next token. Different choices can produce different continuations.",
        duration: 6,
        kind: "compare",
        labels: ["curious", "sleepy", "brave"],
      },
      {
        title: "Append the token and repeat",
        text: "The chosen token joins the context. The same prediction process runs again until a stopping condition.",
        duration: 6,
        kind: "pipeline",
        labels: ["Read context", "Predict", "Append", "Repeat"],
      },
    ],
  };
}
export function manualPlan(title) {
  return {
    title: (title || "My first explainer").slice(0, 56),
    scenes: [
      {
        title: "Introduce the idea",
        text: "Replace this explanation with one accurate idea for your audience.",
        duration: 6,
        kind: "tokens",
        labels: ["Your", "first", "idea"],
      },
      {
        title: "Show how it works",
        text: "Describe the steps in your process. Edit the labels to match.",
        duration: 6,
        kind: "pipeline",
        labels: ["Input", "Process", "Result"],
      },
      {
        title: "Make the distinction clear",
        text: "Compare two choices or outcomes. Check every claim before exporting.",
        duration: 6,
        kind: "compare",
        labels: ["Choice one", "Choice two"],
      },
    ],
  };
}
