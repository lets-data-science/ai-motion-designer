import http from "node:http";
import { randomUUID, createHash } from "node:crypto";
import {
  mkdir,
  readFile,
  writeFile,
  readdir,
  stat,
  rename,
} from "node:fs/promises";
import { createReadStream } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  newProject,
  validatePlan,
  examplePlan,
  manualPlan,
} from "./lib/model.mjs";
import { compositionHTML } from "./lib/composition.mjs";
import { generatePlan } from "./lib/providers.mjs";
import { renderMP4, chromePath } from "./lib/render.mjs";
const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
export async function startServer({
  port = Number(process.env.PORT || 3082),
  dataDir = join(root, ".data"),
} = {}) {
  await mkdir(join(dataDir, "projects"), { recursive: true });
  const jobs = new Map(),
    writes = new Set();
  let rendering = false;
  const projectPath = (id) => {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid project ID.");
    return join(dataDir, "projects", `${id}.json`);
  };
  const readProject = async (id) =>
    JSON.parse(await readFile(projectPath(id), "utf8"));
  const save = async (project) => {
    const path = projectPath(project.id),
      tmp = `${path}.${randomUUID()}.tmp`;
    await writeFile(tmp, JSON.stringify(project, null, 2), { mode: 0o600 });
    await rename(tmp, path);
    return project;
  };
  const server = http.createServer(async (req, res) => {
    const allowedHost = new Set([
      `localhost:${server.address().port}`,
      `127.0.0.1:${server.address().port}`,
    ]);
    if (!allowedHost.has(req.headers.host)) {
      res.writeHead(403);
      return res.end("Invalid host");
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'",
    );
    const json = (status, value) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(value));
    };
    const body = async () => {
      if (
        req.headers.origin !== `http://${req.headers.host}` ||
        !req.headers["content-type"]?.startsWith("application/json")
      )
        throw new Error("Use this local app to make changes.");
      let buffer = "";
      for await (const chunk of req) {
        buffer += chunk;
        if (buffer.length > 65536) throw new Error("Request is too large.");
      }
      return JSON.parse(buffer || "{}");
    };
    try {
      if (req.method === "GET" && url.pathname === "/api/status")
        return json(200, {
          name: "AI Motion Designer",
          version: "1.0.0",
          geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
          chromeReady: Boolean(chromePath()),
          dailyLimit: Number(process.env.GEMINI_DAILY_LIMIT || 5),
        });
      if (req.method === "GET" && url.pathname === "/api/projects") {
        const list = [];
        for (const name of await readdir(join(dataDir, "projects"))) {
          if (name.endsWith(".json")) {
            const item = JSON.parse(
              await readFile(join(dataDir, "projects", name), "utf8"),
            );
            list.push(item);
          }
        }
        return json(
          200,
          list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        );
      }
      if (req.method === "POST" && url.pathname === "/api/projects") {
        const input = await body();
        let plan, provenance;
        if (input.mode === "example") {
          plan = examplePlan();
          provenance = "illustrative example";
        } else if (input.mode === "ai") {
          const result = await generatePlan(input.brief, dataDir);
          plan = result.plan;
          provenance = result.cached ? "Gemini · cached draft" : "Gemini draft";
        } else if (input.mode === "manual") {
          plan = manualPlan(input.title);
          provenance = "manual";
        } else throw new Error("Choose a manual, example or AI storyboard.");
        return json(
          201,
          await save(
            newProject(
              plan,
              provenance,
              String(input.brief || "").slice(0, 1800),
            ),
          ),
        );
      }
      const projectMatch = url.pathname.match(
        /^\/api\/projects\/([a-f0-9-]{36})$/,
      );
      if (projectMatch && req.method === "GET")
        return json(200, await readProject(projectMatch[1]));
      if (projectMatch && req.method === "PUT") {
        const input = await body();
        if (writes.has(projectMatch[1]))
          return json(409, {
            error: "A save is in progress. Try again after it finishes.",
          });
        writes.add(projectMatch[1]);
        try {
          const current = await readProject(projectMatch[1]);
          if (input.revision !== current.revision)
            return json(409, {
              error:
                "This project changed in another tab. Reload before saving.",
            });
          const plan = validatePlan(input);
          return json(
            200,
            await save({
              ...current,
              ...plan,
              revision: current.revision + 1,
              updatedAt: new Date().toISOString(),
            }),
          );
        } finally {
          writes.delete(projectMatch[1]);
        }
      }
      const composition = url.pathname.match(
        /^\/composition\/([a-f0-9-]{36})\/(index\.html|gsap\.min\.js|lds-logo\.svg)$/,
      );
      if (composition && req.method === "GET") {
        if (composition[2] === "index.html") {
          const html = compositionHTML(await readProject(composition[1]));
          res.writeHead(200, { "content-type": "text/html" });
          return res.end(html);
        }
        const file =
          composition[2] === "gsap.min.js"
            ? join(root, "node_modules/gsap/dist/gsap.min.js")
            : join(root, "ui/lds-logo.svg");
        const content = await readFile(file);
        res.writeHead(200, {
          "content-type": file.endsWith(".svg")
            ? "image/svg+xml"
            : "text/javascript",
        });
        return res.end(content);
      }
      const exportMatch = url.pathname.match(
        /^\/api\/projects\/([a-f0-9-]{36})\/export$/,
      );
      if (exportMatch && req.method === "POST") {
        await body();
        if (rendering)
          return json(409, {
            error: "A local render is running. Wait for it to finish.",
          });
        rendering = true;
        try {
          const project = await readProject(exportMatch[1]);
          const hash = createHash("sha256")
            .update(JSON.stringify(validatePlan(project)))
            .digest("hex")
            .slice(0, 16);
          const id = `${project.id}-${hash}`;
          const folder = join(dataDir, "renders", id);
          let cached = false;
          try {
            cached =
              (await stat(join(folder, "walkthrough.mp4"))).size > 0 &&
              JSON.parse(await readFile(join(folder, "verified.json"), "utf8"))
                .codec === "h264";
          } catch {}
          if (cached) {
            rendering = false;
            jobs.set(id, {
              id,
              status: "complete",
              message: "Using your matching local export.",
              download: `/api/exports/${id}`,
            });
            return json(200, jobs.get(id));
          }
          const job = {
            id,
            status: "rendering",
            message: "Preparing the HyperFrames composition…",
          };
          jobs.set(id, job);
          rendering = true;
          renderMP4(project, folder, (message) => {
            job.message = message;
          })
            .then(() => {
              job.status = "complete";
              job.message = "Your MP4 is ready.";
              job.download = `/api/exports/${id}`;
            })
            .catch((error) => {
              job.status = "failed";
              job.message = error.message;
            })
            .finally(() => {
              rendering = false;
            });
          return json(202, job);
        } catch (error) {
          rendering = false;
          throw error;
        }
      }
      const jobMatch = url.pathname.match(/^\/api\/jobs\/([a-f0-9-]+)$/);
      if (jobMatch && req.method === "GET") {
        const job = jobs.get(jobMatch[1]);
        return json(
          job ? 200 : 404,
          job || { error: "Render not found. Start a new export." },
        );
      }
      const download = url.pathname.match(
        /^\/api\/exports\/([a-f0-9-]{36}-[a-f0-9]{16})$/,
      );
      if (download && req.method === "GET") {
        const file = join(dataDir, "renders", download[1], "walkthrough.mp4"),
          info = await stat(file);
        res.writeHead(200, {
          "content-type": "video/mp4",
          "content-length": info.size,
          "content-disposition":
            'attachment; filename="ai-motion-designer.mp4"',
        });
        return createReadStream(file).pipe(res);
      }
      if (req.method === "GET" && url.pathname === "/favicon.ico") {
        res.writeHead(204);
        return res.end();
      }
      const assets = {
        "/": "index.html",
        "/main.mjs": "main.mjs",
        "/style.css": "style.css",
        "/lds-logo.svg": "lds-logo.svg",
        "/timeline.mjs": "../learner/timeline.mjs",
      };
      if (req.method === "GET" && assets[url.pathname]) {
        const file = assets[url.pathname],
          content = await readFile(join(root, "ui", file));
        res.writeHead(200, {
          "content-type": file.endsWith(".html")
            ? "text/html"
            : file.endsWith(".css")
              ? "text/css"
              : file.endsWith(".svg")
                ? "image/svg+xml"
                : "text/javascript",
        });
        return res.end(content);
      }
      json(404, { error: "Not found" });
    } catch (error) {
      json(error.code === "ENOENT" ? 404 : 400, {
        error:
          error.code === "ENOENT"
            ? "Project or file not found."
            : error.message,
      });
    }
  });
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolvePromise);
  });
  return server;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer()
    .then((server) =>
      console.log(
        `AI Motion Designer 1.0.0 → http://localhost:${server.address().port}\nLocal data stays in .data/. AI runs only when you request it.`,
      ),
    )
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
