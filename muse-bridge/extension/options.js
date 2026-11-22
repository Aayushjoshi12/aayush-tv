"use strict";

const DEFAULTS = {
  owner: "Aayushjoshi12",
  repo: "aayush-tv",
  branch: "main",
  folder: "muse-bridge",
  token: ""
};
const FIELDS = ["owner", "repo", "branch", "folder", "token"];

async function load() {
  const saved = await chrome.storage.local.get(DEFAULTS);
  for (const f of FIELDS) document.getElementById(f).value = saved[f] || "";
}

document.getElementById("save").addEventListener("click", async () => {
  const values = {};
  for (const f of FIELDS) values[f] = document.getElementById(f).value.trim();
  await chrome.storage.local.set(values);
  const note = document.getElementById("saved");
  note.textContent = "Saved ✅";
  setTimeout(() => (note.textContent = ""), 2000);
});

load();
