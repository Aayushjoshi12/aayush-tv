"use strict";

const DEFAULTS = {
  owner: "Aayushjoshi12",
  repo: "aayush-tv",
  branch: "main",
  folder: "muse-bridge",
  token: ""
};

const $ = (id) => document.getElementById(id);
const statusEl = $("status");

function setStatus(msg, isErr) {
  statusEl.textContent = msg || "";
  statusEl.className = isErr ? "err" : "";
}

async function getSettings() {
  const saved = await chrome.storage.local.get(DEFAULTS);
  return { ...DEFAULTS, ...saved };
}

function b64decode(b64) {
  const bin = atob(String(b64).replace(/\n/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function b64encode(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

async function ghFetch(s, path, options = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(options.headers || {})
  };
  if (s.token) headers.Authorization = "Bearer " + s.token;
  const url =
    "https://api.github.com/repos/" +
    encodeURIComponent(s.owner) + "/" + encodeURIComponent(s.repo) +
    "/contents/" + s.folder.split("/").map(encodeURIComponent).join("/") +
    "/" + path.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let detail = "";
    try { detail = (await res.json()).message || ""; } catch (e) { /* ignore */ }
    throw new Error("GitHub " + res.status + (detail ? " — " + detail : ""));
  }
  return res.json();
}

async function readFile(s, name) {
  const data = await ghFetch(s, name + "?ref=" + encodeURIComponent(s.branch));
  return { text: b64decode(data.content), sha: data.sha };
}

function stripMd(t) {
  return t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/`(.+?)`/g, "$1").trim();
}

// TASKS.md: top-level bullets under "## Open" until "## Done"
function parseOpenTasks(md) {
  const open = md.split(/^## Open\s*$/m)[1] || "";
  const section = open.split(/^## /m)[0];
  const tasks = [];
  let current = null;
  for (const line of section.split("\n")) {
    if (/^- /.test(line)) {
      if (current) tasks.push(current);
      current = line.slice(2);
    } else if (current && line.trim()) {
      current += "\n" + line.trim();
    }
  }
  if (current) tasks.push(current);
  return tasks.map(stripMd);
}

// FINDINGS.md: each "## " heading + its first non-empty line
function parseFindings(md) {
  const out = [];
  const parts = md.split(/^## /m).slice(1);
  for (const p of parts) {
    const lines = p.split("\n");
    const title = stripMd(lines[0] || "");
    const body = lines.slice(1).map((l) => l.trim()).find((l) => l) || "";
    if (title) out.push({ title, body: stripMd(body) });
  }
  return out.slice(0, 5);
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}

async function refresh() {
  const s = await getSettings();
  setStatus("Loading from GitHub…");
  try {
    const [tasksFile, findingsFile] = await Promise.all([
      readFile(s, "TASKS.md"),
      readFile(s, "FINDINGS.md")
    ]);
    const tasks = parseOpenTasks(tasksFile.text);
    const tBox = $("tasks");
    tBox.textContent = "";
    if (!tasks.length) {
      tBox.appendChild(el("p", "sub", "No open tasks. 🎉"));
    } else {
      const ul = el("ul");
      tasks.forEach((t) => ul.appendChild(el("li", null, t)));
      tBox.appendChild(ul);
    }
    const fBox = $("findings");
    fBox.textContent = "";
    const findings = parseFindings(findingsFile.text);
    if (!findings.length) {
      fBox.appendChild(el("p", "sub", "No findings yet."));
    } else {
      findings.forEach((f) => {
        const card = el("div", "card");
        card.appendChild(el("div", "t", f.title));
        if (f.body) card.appendChild(el("div", "b", f.body));
        fBox.appendChild(card);
      });
    }
    setStatus("Up to date — " + new Date().toLocaleTimeString());
  } catch (err) {
    setStatus("Could not load the bridge: " + err.message +
      " (If the repo is private, add a token in Options.)", true);
  }
}

async function addTask() {
  const text = $("newTask").value.trim();
  if (!text) { setStatus("Write the task first.", true); return; }
  const s = await getSettings();
  const line = "- **" + text + "** — added via the Bridge extension, " +
    new Date().toISOString().slice(0, 10);
  if (!s.token) {
    await navigator.clipboard.writeText(line);
    setStatus("No token saved, so I copied the task instead — paste it to either Muse, or add a token in Options.");
    return;
  }
  $("addTask").disabled = true;
  try {
    const file = await readFile(s, "TASKS.md");
    if (!/^## Open\s*$/m.test(file.text)) throw new Error("TASKS.md has no '## Open' section");
    const updated = file.text.replace(/^(## Open\s*)$/m, "$1\n\n" + line);
    await ghFetch(s, "TASKS.md", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Bridge: add task via extension",
        content: b64encode(updated),
        sha: file.sha,
        branch: s.branch
      })
    });
    $("newTask").value = "";
    setStatus("Task added to the bridge. ✅");
    refresh();
  } catch (err) {
    setStatus("Could not add the task: " + err.message, true);
  } finally {
    $("addTask").disabled = false;
  }
}

$("refresh").addEventListener("click", refresh);
$("addTask").addEventListener("click", addTask);
$("openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());
$("copyPrompt").addEventListener("click", async () => {
  const s = await getSettings();
  const prompt =
    "Check the bridge: read TASKS.md and FINDINGS.md in the " + s.folder +
    " folder of the " + s.owner + "/" + s.repo +
    " repo, do any open task meant for you, and report back.";
  await navigator.clipboard.writeText(prompt);
  setStatus("Prompt copied — paste it to the other Muse. ✅");
});

refresh();
