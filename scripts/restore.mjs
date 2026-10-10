import { mkdir, copyFile } from "node:fs/promises";
const name = process.argv[2];
if (!["storyboard", "timeline", "composition"].includes(name))
  throw new Error("Use npm run restore -- storyboard|timeline|composition");
await mkdir(".backups", { recursive: true });
await copyFile(`learner/${name}.mjs`, `.backups/${name}-${Date.now()}.mjs`);
await copyFile(`checkpoints/${name}.mjs`, `learner/${name}.mjs`);
console.log(
  `Restored ${name}; your previous code is in .backups. Restart the app.`,
);
