import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const AdmZip = require("adm-zip");
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const out = resolve(
  process.argv[2] || join(root, "..", "bundles", "ai-motion-designer"),
);
const version = JSON.parse(
  await readFile(join(root, "package.json"), "utf8"),
).version;
// Deliberately enumerate every distributable file. New local files must never
// enter a learner download merely because they sit in an approved directory.
const packageFiles = [
  ".github/workflows/check.yml",
  "CONTRIBUTORS.md",
  ".env.example",
  ".gitignore",
  "checkpoints/composition.mjs",
  "checkpoints/storyboard.mjs",
  "checkpoints/timeline.mjs",
  "docs/BUILD.md",
  "docs/DESIGN.md",
  "docs/VERIFICATION.md",
  "docs/WALKTHROUGH-SCRIPT.md",
  "learner/composition.mjs",
  "learner/storyboard.mjs",
  "learner/timeline.mjs",
  "lib/composition.mjs",
  "lib/model.mjs",
  "lib/providers.mjs",
  "lib/render.mjs",
  "LICENSE",
  "NOTICE",
  "package-lock.json",
  "package.json",
  "README.md",
  "scripts/build.mjs",
  "scripts/restore.mjs",
  "scripts/setup.mjs",
  "server.mjs",
  "teaching/starter/composition.mjs",
  "teaching/starter/storyboard.mjs",
  "teaching/starter/timeline.mjs",
  "test/composition.test.mjs",
  "test/export-integration.mjs",
  "test/integration.test.mjs",
  "test/providers.test.mjs",
  "test/storyboard.test.mjs",
  "test/timeline.test.mjs",
  "ui/index.html",
  "ui/lds-logo.svg",
  "ui/main.mjs",
  "ui/style.css",
].sort();
await mkdir(out, { recursive: true });
const manifest = {
  project: "ai-motion-designer",
  version,
  license: "Apache-2.0",
  files: {},
};
for (const flavor of ["starter", "reference"]) {
  const zip = new AdmZip();
  for (const name of packageFiles) {
    let source = join(root, name);
    if (
      flavor === "starter" &&
      /^learner\/(storyboard|timeline|composition)\.mjs$/.test(name)
    )
      source = join(root, "teaching", "starter", basename(name));
    zip.addFile(`ai-motion-designer/${name}`, await readFile(source));
    zip.getEntry(`ai-motion-designer/${name}`).header.time = new Date(2026, 0, 1);
  }
  const name = `ai-motion-designer-${flavor}-${version}.zip`;
  const bytes = zip.toBuffer();
  await writeFile(join(out, name), bytes);
  manifest.files[flavor] = {
    file: name,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    entries: packageFiles.map((entry) => `ai-motion-designer/${entry}`),
  };
}
await writeFile(
  join(out, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(JSON.stringify(manifest, null, 2));
