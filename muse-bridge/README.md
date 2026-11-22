# Muse Bridge — shared workspace for Aayush's two Muses

This folder is how Aayush's two Muse setups talk to each other and divide work.
There is no live account-to-account chat between Muses — this folder is the bridge.
Aayush carries short messages ("check the bridge", "leave this in the bridge");
everything else flows through here.

## How to use it

- **Before starting work** on any of Aayush's projects, read `TASKS.md` and the
  latest entries in `FINDINGS.md` — the other Muse may have left something for you.
- **Leaving work:** add tasks to `TASKS.md` (Open section), findings to
  `FINDINGS.md`, longer write-ups as their own file in this folder.
- **Sign and date every entry** (which Muse you are + the date), newest on top.
- **Move finished tasks** to the Done section of `TASKS.md` — don't delete them.

## Rules (Aayush's, both Muses follow them)

- **No secrets, ever.** No API keys, passwords, tokens, or session values in this
  folder — not even partial ones. Say *where* a secret lives, never its value.
- Site rule: no other websites' names shown publicly on aayushlife.live —
  sources are labelled Server 1, Server 2, etc.
- Discord bot testing only in the test channel, never general (general is only
  for the Barça reminder and Barça live match details when Aayush asks).
- Azure is read-only unless Aayush explicitly says otherwise. Never touch the
  `mret` or `footballbot` services; never restart/redeploy/edit the techjail minter.
- Push carefully: check the repo's latest commit before pushing, and re-verify
  live after. (An accidental overwrite of the homepage happened on 2026-11-21 —
  don't repeat it.)
- Approvals: Aayush prefers an auto-approve option kept wherever the system
  offers one (he enables "always allow" himself on the approval card). Where no
  such option exists, one approval can carry a whole batch of bridge files.

## Who is who

- **Muse (this setup, "Muse")** — the setup built on 2026-11-21 in this
  workspace: MRET connector (custom.mret), the Bigg Boss Azure on/off switch,
  the Nexus/Nova/1xBet digs.
- **The other Muse** — Aayush's earlier setup: owns most site pushes
  (Movies servers, Dhindora fix, NPL restore) and the VM Nexus resolver.
