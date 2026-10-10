import { sceneAtTime } from "/timeline.mjs";
const $ = (selector) => document.querySelector(selector),
  app = $("#app");
const esc = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let projects = [],
  current = null,
  selected = 0,
  time = 0,
  playing = false,
  last = 0,
  dirty = false,
  status = {},
  timer,
  job = null,
  creating = false;
function notice(message, error = false) {
  const el = $("#notice");
  el.textContent = message;
  el.classList.add("visible");
  el.style.background = error ? "#772e2e" : "#181b17";
  clearTimeout(timer);
  timer = setTimeout(() => el.classList.remove("visible"), error ? 8500 : 3200);
}
async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { "content-type": "application/json", ...options.headers },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}
const duration = () =>
  current.scenes.reduce((sum, scene) => sum + scene.duration, 0);
const clock = (n) =>
  `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(n % 60)
    .toString()
    .padStart(2, "0")}`;
function markDirty() {
  dirty = true;
  $("#save").disabled = false;
  $("#save").textContent = "Save & preview";
  $("#save-state").textContent = "Unsaved changes";
  $("#preview-state").textContent = "Preview shows last save";
}
function home() {
  playing = false;
  current = null;
  history.replaceState({}, "", "/");
  app.innerHTML = `<div class="home"><section class="hero"><div><h1>Make the idea<br>move.</h1><p>Turn an explanation into a motion graphic. Shape the story, direct the timing, and render a video on your own computer.</p><button class="primary" id="example">Explore an illustrative storyboard <span aria-hidden="true">↗</span></button><p class="hint">No API key needed. Start with next-token prediction.</p></div><div class="hero-visual" aria-label="Illustrative token sequence"><p>An idea, frame by frame</p><h2>One token. Then the next.</h2><div class="token-row"><span class="token">The</span><span class="token">little</span><span class="token">dragon</span><span class="token">was</span><span class="token">…</span></div><div class="hero-line"><span></span></div></div></section><section class="brief-form"><div><h2>What would you like to explain?</h2><p>Give your audience one idea to understand. Gemini can draft the scenes; you decide what belongs in the final video.</p><p class="hint">${status.geminiConfigured ? "Gemini is configured. A draft sends only this brief to Google." : "Add your Gemini key to .env.local to enable AI drafting."} Up to ${status.dailyLimit || 5} requests per day. Identical prompts reuse a saved result.</p></div><div><label for="brief">Your brief</label><textarea id="brief" maxlength="1800" placeholder="Explain how a transformer predicts the next token for someone who knows basic Python."></textarea><div class="form-actions"><button class="primary" id="generate" ${status.geminiConfigured ? "" : "disabled"}>Draft with Gemini <span aria-hidden="true">✦</span></button><button id="manual">Start a blank storyboard</button></div><p class="hint">AI drafts need fact checking. Manual editing and local exports are free of API calls.</p></div></section><section class="saved-list"><h2>Your storyboards</h2>${projects.length ? projects.map((p) => `<div class="saved-item"><button data-open="${p.id}">${esc(p.title)}<small>${esc(p.provenance)} · ${p.scenes.length} scenes · saved on this computer</small></button><span>${p.scenes.reduce((n, s) => n + s.duration, 0)} sec</span></div>`).join("") : '<p class="hint">Your first storyboard will appear here.</p>'}</section><p class="privacy-note">HyperFrames renders locally. Your key stays on the server. This app does not generate audio.</p></div>`;
  $("#example").onclick = () => create("example");
  $("#manual").onclick = () => create("manual");
  $("#generate").onclick = () => create("ai");
  document
    .querySelectorAll("[data-open]")
    .forEach((button) => (button.onclick = () => open(button.dataset.open)));
}
async function create(mode) {
  if (creating) return;
  creating = true;
  const brief = $("#brief")?.value || "";
  const buttons = [...document.querySelectorAll("#example,#manual,#generate")];
  buttons.forEach((b) => (b.disabled = true));
  const trigger =
    mode === "ai"
      ? $("#generate")
      : mode === "manual"
        ? $("#manual")
        : $("#example");
  if (trigger)
    trigger.textContent =
      mode === "ai" ? "Drafting your scenes…" : "Opening storyboard…";
  try {
    const project = await api("/api/projects", {
      method: "POST",
      body: JSON.stringify({ mode, brief, title: brief.slice(0, 56) }),
    });
    projects.unshift(project);
    await open(project.id);
  } catch (error) {
    notice(error.message, true);
    home();
  } finally {
    creating = false;
  }
}
async function open(id) {
  if (dirty && !confirm("Leave these unsaved edits?")) return;
  current = await api(`/api/projects/${id}`);
  selected = 0;
  time = 0.7;
  playing = false;
  dirty = false;
  job = null;
  history.replaceState({}, "", `/?project=${id}`);
  renderEditor();
}
function renderEditor() {
  const total = duration();
  app.innerHTML = `<button class="quiet back" id="back">← Your storyboards</button><div class="workspace-heading"><div><label for="project-title">Storyboard title</label><input class="title-input" id="project-title" maxlength="56" value="${esc(current.title)}"><div class="meta"><span id="save-state">${dirty ? "Unsaved changes" : "Saved on this computer"}</span><span>${esc(current.provenance)}</span><span>${total} sec · ${current.scenes.length} scenes</span></div></div><div class="workspace-actions"><button id="save" ${dirty ? "" : "disabled"}>${dirty ? "Save & preview" : "✓ Saved"}</button><button class="primary" id="export">Export MP4 <span aria-hidden="true">↓</span></button></div></div><div class="editor-layout"><div><div class="preview-title"><span>Your motion graphic</span><span id="preview-state">1280 × 720 · silent preview</span></div><div class="canvas"><iframe title="Motion graphic preview" src="/composition/${current.id}/index.html?revision=${current.revision}" sandbox="allow-scripts"></iframe></div><div class="transport"><button id="play" aria-label="Play preview">▶</button><time id="clock">${clock(time)} / ${clock(total)}</time><input type="range" id="seek" aria-label="Preview time" min="0" max="${total}" step="0.01" value="${time}"><span class="aspect">30 fps · 16:9</span></div><div class="scene-strip">${current.scenes.map((s, i) => `<button class="scene-thumb ${i === selected ? "selected" : ""}" data-scene="${i}" aria-pressed="${i === selected}"><span class="scene-number"><span>${String(i + 1).padStart(2, "0")} · ${esc(s.kind)}</span><span>${s.duration}s</span></span><strong>${esc(s.title)}</strong></button>`).join("")}</div><div class="strip-footer"><p>Select a scene to edit its words, motion and timing.</p><button id="add-scene" ${current.scenes.length >= 6 ? "disabled" : ""}>＋ Add scene</button></div><div class="export-panel" id="export-panel"><div><h3>Local exports</h3><p class="empty-export">Review the whole story, then render your MP4.</p></div><button class="quiet" id="json-export">Save storyboard JSON ↓</button></div></div><aside class="inspector" aria-label="Scene editor"></aside></div><p class="privacy-note">Generated compositions contain escaped text and predefined motion only. An AI draft is not a fact check. Your brief is sent to Gemini only when you explicitly request a draft.</p>`;
  $("#back").onclick = () => {
    if (!dirty || confirm("Leave these unsaved edits?")) {
      dirty = false;
      refreshHome();
    }
  };
  $("#project-title").oninput = (e) => {
    current.title = e.target.value;
    markDirty();
  };
  $("#save").onclick = save;
  $("#export").onclick = exportVideo;
  $("#json-export").onclick = downloadJSON;
  $("#play").onclick = () => {
    playing = !playing;
    if (time >= total) time = 0;
    last = performance.now();
    updateTransport();
  };
  $("#seek").oninput = (e) => {
    playing = false;
    time = Number(e.target.value);
    try {
      selected = sceneAtTime(current.scenes, time).index;
      updateSelection();
      inspector();
      seek();
    } catch (error) {
      notice(error.message, true);
    }
  };
  document.querySelectorAll("[data-scene]").forEach(
    (b) =>
      (b.onclick = () => {
        selected = Number(b.dataset.scene);
        playing = false;
        time =
          current.scenes
            .slice(0, selected)
            .reduce((n, s) => n + s.duration, 0) + 0.7;
        updateSelection();
        inspector();
        seek();
      }),
  );
  $("#add-scene").onclick = () => {
    current.scenes.push({
      title: "A new idea",
      text: "Write one accurate explanation for this scene.",
      duration: 6,
      kind: "pipeline",
      labels: ["Input", "Process", "Result"],
    });
    selected = current.scenes.length - 1;
    dirty = true;
    renderEditor();
  };
  inspector();
  const iframe = $("iframe");
  new ResizeObserver(() => {
    iframe.style.transform = `scale(${iframe.parentElement.clientWidth / 1280})`;
  }).observe(iframe.parentElement);
  iframe.onload = () => {
    iframe.style.transform = `scale(${iframe.parentElement.clientWidth / 1280})`;
    seek();
  };
}
function updateSelection() {
  document.querySelectorAll("[data-scene]").forEach((b) => {
    const yes = Number(b.dataset.scene) === selected;
    b.classList.toggle("selected", yes);
    b.setAttribute("aria-pressed", String(yes));
  });
}
function inspector() {
  const scene = current.scenes[selected];
  $(".inspector").innerHTML =
    `<div class="inspector-top"><h2>Scene ${String(selected + 1).padStart(2, "0")}</h2><span class="hint">${selected + 1} of ${current.scenes.length}</span></div><fieldset><div class="field"><label for="scene-title">Scene title</label><input id="scene-title" maxlength="56" value="${esc(scene.title)}"></div><div class="field"><label for="scene-text">The explanation</label><textarea id="scene-text" maxlength="180">${esc(scene.text)}</textarea><p class="hint">One clear idea. Up to 180 characters.</p></div><div class="field-row"><div class="field"><label for="scene-kind">Motion</label><select id="scene-kind">${["tokens", "pipeline", "compare"].map((k) => `<option ${scene.kind === k ? "selected" : ""} value="${k}">${k === "tokens" ? "Reveal tokens" : k === "pipeline" ? "Follow a process" : "Compare choices"}</option>`).join("")}</select></div><div class="field"><label for="scene-duration">Seconds</label><input id="scene-duration" type="number" min="2" max="12" step="0.5" value="${scene.duration}"></div></div><div class="field"><label for="scene-labels">On-screen labels</label><textarea id="scene-labels">${esc(scene.labels.join("\n"))}</textarea><p class="hint">One per line. 2–4 labels, up to 24 characters each.</p></div></fieldset><div class="scene-ops"><button id="earlier" ${selected === 0 ? "disabled" : ""} aria-label="Move scene earlier">← Earlier</button><button id="later" ${selected === current.scenes.length - 1 ? "disabled" : ""} aria-label="Move scene later">Later →</button><button id="remove" ${current.scenes.length === 1 ? "disabled" : ""}>Remove</button></div><p class="provenance-note">Save to update the preview. All examples are illustrative; verify your explanation before sharing.</p>`;
  const bind = (id, key, fn = (x) => x) => {
    $(id).oninput = (e) => {
      scene[key] = fn(e.target.value);
      markDirty();
    };
  };
  bind("#scene-title", "title");
  bind("#scene-text", "text");
  bind("#scene-kind", "kind");
  bind("#scene-duration", "duration", Number);
  bind("#scene-labels", "labels", (v) => v.split("\n").filter((x) => x.trim()));
  $("#earlier").onclick = () => move(-1);
  $("#later").onclick = () => move(1);
  $("#remove").onclick = () => {
    current.scenes.splice(selected, 1);
    selected = Math.max(0, selected - 1);
    dirty = true;
    playing = false;
    renderEditor();
  };
}
function move(delta) {
  [current.scenes[selected], current.scenes[selected + delta]] = [
    current.scenes[selected + delta],
    current.scenes[selected],
  ];
  selected += delta;
  dirty = true;
  playing = false;
  renderEditor();
}
function updateTransport() {
  if (!current || !$("#play")) return;
  $("#play").textContent = playing ? "Ⅱ" : "▶";
  $("#play").setAttribute(
    "aria-label",
    playing ? "Pause preview" : "Play preview",
  );
  $("#seek").value = time;
  $("#clock").textContent = `${clock(time)} / ${clock(duration())}`;
}
function seek() {
  if (!current) return;
  $("iframe")?.contentWindow?.postMessage({ motionTime: time }, "*");
  updateTransport();
}
function animate(now) {
  if (playing && current) {
    time = Math.min(duration(), time + (now - last) / 1000);
    if (time >= duration()) playing = false;
    seek();
  }
  last = now;
  requestAnimationFrame(animate);
}
async function save() {
  try {
    playing = false;
    current = await api(`/api/projects/${current.id}`, {
      method: "PUT",
      body: JSON.stringify(current),
    });
    dirty = false;
    selected = Math.min(selected, current.scenes.length - 1);
    time = Math.min(time, duration());
    renderEditor();
    notice("Storyboard saved on this computer.");
    return true;
  } catch (error) {
    notice(error.message, true);
    return false;
  }
}
function downloadJSON() {
  const blob = new Blob(
    [JSON.stringify({ title: current.title, scenes: current.scenes }, null, 2)],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = "motion-storyboard.json";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function exportVideo() {
  if (dirty && !(await save())) return;
  $("#export").disabled = true;
  playing = false;
  updateTransport();
  try {
    job = await api(`/api/projects/${current.id}/export`, {
      method: "POST",
      body: "{}",
    });
    await pollJob();
  } catch (error) {
    notice(error.message, true);
    $("#export").disabled = false;
  }
}
async function pollJob() {
  if (!job || !current) return;
  $("#export-panel").innerHTML =
    `<div><h3>${job.status === "complete" ? "Your export is ready" : job.status === "failed" ? "Export needs attention" : "Rendering with HyperFrames"}</h3><p class="${job.status === "failed" ? "error" : ""}">${esc(job.message)}</p></div>${job.status === "complete" ? `<a href="${job.download}">Download MP4 ↓</a>` : ""}`;
  if (job.status === "rendering") {
    const id = job.id;
    await new Promise((r) => setTimeout(r, 1500));
    if (!current || job?.id !== id) return;
    job = await api(`/api/jobs/${id}`);
    return pollJob();
  }
  $("#export").disabled = false;
  if (job.status === "complete") notice("Your local MP4 is ready.");
}
async function refreshHome() {
  projects = await api("/api/projects");
  home();
}
$("#new-project").onclick = () => {
  if (!dirty || confirm("Leave these unsaved edits?")) {
    dirty = false;
    refreshHome();
  }
};
addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
addEventListener("message", (event) => {
  if (event.source === $("iframe")?.contentWindow && event.data?.motionReady)
    seek();
});
app.innerHTML = '<p class="loading">Opening your local workspace…</p>';
try {
  [status, projects] = await Promise.all([
    api("/api/status"),
    api("/api/projects"),
  ]);
  const id = new URLSearchParams(location.search).get("project");
  if (id) await open(id);
  else home();
} catch (error) {
  app.innerHTML = `<p class="error">${esc(error.message)}</p><button id="recover">Open your storyboards</button>`;
  $("#recover").onclick = refreshHome;
}
requestAnimationFrame(animate);
