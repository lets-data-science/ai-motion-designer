import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, copyFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compositionHTML } from "./composition.mjs";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
export function chromePath() {
  const paths = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    join(
      process.env.PROGRAMFILES || "C:\\Program Files",
      "Google",
      "Chrome",
      "Application",
      "chrome.exe",
    ),
    join(
      process.env.LOCALAPPDATA || "C:\\Users\\Default\\AppData\\Local",
      "Google",
      "Chrome",
      "Application",
      "chrome.exe",
    ),
  ];
  return paths.find((value) => value && existsSync(value));
}
export async function prepareComposition(plan, folder) {
  await mkdir(folder, { recursive: true });
  await writeFile(join(folder, "index.html"), compositionHTML(plan));
  await copyFile(
    join(root, "node_modules/gsap/dist/gsap.min.js"),
    join(folder, "gsap.min.js"),
  );
  await copyFile(join(root, "ui/lds-logo.svg"), join(folder, "lds-logo.svg"));
}
export async function renderMP4(plan, folder, onProgress = () => {}) {
  const browser = chromePath();
  if (!browser)
    throw new Error(
      "Install Chrome or set CHROME_PATH in .env.local, then restart.",
    );
  await prepareComposition(plan, folder);
  const output = join(folder, "walkthrough.mp4");
  await new Promise((resolvePromise, reject) => {
    // No shell; every argument comes from this application, never the AI or user.
    const child = spawn(
      process.execPath,
      [
        join(root, "node_modules/hyperframes/bin/hyperframes.mjs"),
        "render",
        folder,
        "--output",
        output,
        "--fps",
        "30",
        "--quality",
        "standard",
        "--workers",
        "1",
        "--no-browser-gpu",
        "--experimental-fast-capture=false",
      ],
      {
        cwd: folder,
        env: {
          ...process.env,
          HYPERFRAMES_BROWSER_PATH: browser,
          HYPERFRAMES_NO_TELEMETRY: "1",
          DO_NOT_TRACK: "1",
          PRODUCER_LOW_MEMORY_MODE: "true",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let log = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), 180000);
    const add = (chunk) => {
      log = (log + chunk.toString()).slice(-16000);
      onProgress("Rendering frames locally…");
    };
    child.stdout.on("data", add);
    child.stderr.on("data", add);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", async (code) => {
      clearTimeout(timer);
      await writeFile(join(folder, "render.log"), log);
      if (code === 0 && existsSync(output)) resolvePromise();
      else
        reject(
          new Error(
            "Local render failed. Check the render.log in .data/renders for details; confirm FFmpeg and Chrome are installed.",
          ),
        );
    });
  });
  const probe = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_streams", "-show_format", "-of", "json", output],
    { encoding: "utf8" },
  );
  if (probe.status !== 0)
    throw new Error("FFprobe could not verify the exported video.");
  const metadata = JSON.parse(probe.stdout),
    video = metadata.streams.find((stream) => stream.codec_type === "video");
  const expected = plan.scenes.reduce((sum, scene) => sum + scene.duration, 0);
  if (
    video?.codec_name !== "h264" ||
    video.width !== 1280 ||
    video.height !== 720 ||
    Math.abs(Number(metadata.format.duration) - expected) > 0.15
  )
    throw new Error(
      "The export did not match the expected codec, size or duration.",
    );
  await writeFile(
    join(folder, "verified.json"),
    JSON.stringify({
      duration: expected,
      width: 1280,
      height: 720,
      codec: "h264",
    }),
  );
  return output;
}
