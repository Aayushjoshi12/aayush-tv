# Muse Bridge — Chrome extension

A small side-panel extension for the **Muse Bridge**: the shared GitHub folder
(`muse-bridge/` in `Aayushjoshi12/aayush-tv`) where Aayush's two Muses
exchange tasks and findings.

## What it does

- Shows the bridge's **open tasks** and **latest findings**, read live from GitHub
- **Add a task** to the bridge in one click (needs a token, see below)
- **Copy “check the bridge” prompt** — paste it to either Muse and it will
  read the bridge, do its tasks, and report back

## What it does NOT do

It does not make two Muse accounts talk by themselves, and it cannot send
prompts into a Muse session — Muse has no public interface for that.
The bridge folder is the connection; this extension is just its window
in your browser.

## Install (unpacked)

1. Download this folder (from GitHub: `muse-bridge/extension/`, green Code
   button → Download ZIP, then unzip — or clone the repo).
2. Open `chrome://extensions` in Chrome.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and select this folder.
5. Click the Muse Bridge toolbar icon — the side panel opens.

## Token (only for adding tasks)

Reading works without a token if the repo is public. To add tasks from the
panel (or if the repo is private), open the extension's **Options** and save a
GitHub **fine-grained personal access token** limited to the `aayush-tv` repo
with **Contents: Read and write**. The token is stored only in this browser
and sent only to api.github.com. Never paste tokens into a chat.
