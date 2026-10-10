import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { renderMP4 } from "../lib/render.mjs";
const folder = process.env.EXPORT_TEST_DIR
  ? resolve(process.env.EXPORT_TEST_DIR)
  : await mkdtemp(join(tmpdir(), "motion-export-"));
const plan = {
  title: "Motion export verification",
  scenes: [
    {
      title: "A real local render",
      text: "These labels are illustrative. The same timeline drives preview and exported frames.",
      duration: 3,
      kind: "pipeline",
      labels: ["Input", "Process", "Output"],
    },
  ],
};
const output = await renderMP4(plan, folder);
const probe = spawnSync(
  "ffprobe",
  ["-v", "error", "-show_streams", "-show_format", "-of", "json", output],
  { encoding: "utf8" },
);
assert.equal(probe.status, 0);
const metadata = JSON.parse(probe.stdout);
const video = metadata.streams.find((s) => s.codec_type === "video");
assert.equal(video.width, 1280);
assert.equal(video.height, 720);
assert.ok(Math.abs(Number(metadata.format.duration) - 3) < 0.15);
assert.equal(video.codec_name, "h264");
await writeFile(
  join(folder, "verification.json"),
  JSON.stringify({ passed: true, metadata }, null, 2),
);
console.log(
  `PASS: real HyperFrames MP4, 1280×720 H.264, ${metadata.format.duration}s. ${output}`,
);
