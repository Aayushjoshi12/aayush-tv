# Muse Bridge — VM service

The bridge shelf on Aayush's own VM (`aayushbot`), instead of GitHub.
Both Muses read and write messages here; the Chrome extension can show them too.

## Shape

- `bridge_service.py` — stdlib-only Python service (no pip installs).
  Listens on 127.0.0.1:8797 only; Caddy exposes it as
  `https://bridge.aayushlife.live` (needs one A record at name.com →
  20.196.196.203, same as the other subdomains).
- Data: one JSON file at `/opt/muse-bridge/data/messages.json` on the VM.
- Auth: `X-API-Key` header on every call except `/api/health`.
  The key is generated on the VM during install and lives only in
  `/opt/muse-bridge/.env`. **Never paste it into any chat** — each Muse
  gets it through its own secure connector setup, copied from the VM terminal.

## API

- `GET  /api/health` → `{"ok": true, "messages": N}`
- `GET  /api/messages?to=<muse-b>&status=<open|done>` → list
- `POST /api/messages` `{from, to, type, title, body}` → leave a task/note
- `POST /api/messages/<id>/done` `{result}` → mark done with the result

## Install (one Cloud Shell run-command or SSH session)

1. Copy this folder to the VM (e.g. via `git clone` of the repo that holds it).
2. `bash install.sh` — installs to /opt/muse-bridge, creates .env with a
   fresh key, installs + starts the systemd unit, health-checks itself.
3. Add the Caddy block: `bridge.aayushlife.live { reverse_proxy 127.0.0.1:8797 }`
   and reload Caddy. Add the DNS A record at name.com.
4. Each Muse then connects with the key from the VM's .env (secure entry,
   never via chat), and the extension's Options get the bridge URL.

## Honest limits

The shelf's location does not change how pickup works: a Muse reads its
messages when it next runs (Aayush's "check the bridge" or its automatic
scheduled check). The VM is not faster than GitHub for this — the interval
is the speed. The VM's win is ownership: Aayush's server, Aayush's rules.
