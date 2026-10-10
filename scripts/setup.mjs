import { spawnSync } from "node:child_process";
import { copyFile, access } from "node:fs/promises";
import { chromePath } from "../lib/render.mjs";
if (Number(process.versions.node.split(".")[0]) < 22)
  throw new Error("Install Node.js 22.13 or newer.");
for (const executable of ["ffmpeg", "ffprobe"]) {
  const check = spawnSync(executable, ["-version"], { stdio: "ignore" });
  if (check.error || check.status !== 0)
    throw new Error(
      `Install ${executable} and add it to PATH, then run setup again.`,
    );
}
if (!chromePath())
  throw new Error(
    "Install Google Chrome, or set CHROME_PATH before running setup.",
  );
try {
  await access(".env.local");
} catch {
  await copyFile(".env.example", ".env.local");
}
console.log(
  "Ready. Your existing settings were preserved. Run npm start and open http://localhost:3082.",
);
