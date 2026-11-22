#!/usr/bin/env python3
"""Muse Bridge service — the shared shelf for Aayush's two Muses, on his VM.

A tiny message board with an API-key-protected JSON API:

  GET  /api/health                 -> {"ok": true, "messages": N}
  GET  /api/messages?to=muse-b     -> messages for a Muse (or all)
  POST /api/messages               -> leave a message
       {"from": "muse-a", "to": "muse-b", "type": "task",
        "title": "...", "body": "..."}
  POST /api/messages/<id>/done     -> mark a message done, with a result
       {"result": "..."}

All endpoints except /api/health need the X-API-Key header.
Storage is one JSON file (data/messages.json next to this file).
Stdlib only. Run behind Caddy (HTTPS) — never expose the raw port.
"""

import json
import os
import threading
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

BASE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE, "data")
DATA_FILE = os.path.join(DATA_DIR, "messages.json")
AGENTS_FILE = os.path.join(DATA_DIR, "agents.json")
API_KEY = os.environ.get("BRIDGE_API_KEY", "")
PORT = int(os.environ.get("PORT", "8797"))
LOCK = threading.Lock()


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def load_messages():
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def save_messages(messages):
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(messages, f, ensure_ascii=False, indent=1)
    os.replace(tmp, DATA_FILE)


def load_agents():
    try:
        with open(AGENTS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def save_agents(agents):
    os.makedirs(DATA_DIR, exist_ok=True)
    tmp = AGENTS_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(agents, f, ensure_ascii=False, indent=1)
    os.replace(tmp, AGENTS_FILE)


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *args):  # keep the journal quiet-ish
        pass

    def _send(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authed(self):
        return API_KEY and self.headers.get("X-API-Key") == API_KEY

    def _body_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > 1_000_000:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return {}

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            with LOCK:
                count = len(load_messages())
            return self._send(200, {"ok": True, "messages": count})
        if parsed.path == "/api/messages":
            if not self._authed():
                return self._send(401, {"error": "bad or missing X-API-Key"})
            qs = parse_qs(parsed.query)
            want_to = (qs.get("to") or [""])[0]
            want_status = (qs.get("status") or [""])[0]
            with LOCK:
                messages = load_messages()
            out = [
                m for m in messages
                if (not want_to or m.get("to") in (want_to, "both"))
                and (not want_status or m.get("status") == want_status)
            ]
            return self._send(200, {"messages": out})
        if parsed.path == "/api/agents":
            if not self._authed():
                return self._send(401, {"error": "bad or missing X-API-Key"})
            with LOCK:
                agents = load_agents()
            return self._send(200, {"agents": agents})
        return self._send(404, {"error": "not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        if not self._authed():
            return self._send(401, {"error": "bad or missing X-API-Key"})
        if parsed.path == "/api/messages":
            data = self._body_json()
            for field in ("from", "to", "title"):
                if not str(data.get(field) or "").strip():
                    return self._send(400, {"error": "missing field: " + field})
            with LOCK:
                messages = load_messages()
                msg = {
                    "id": (messages[-1]["id"] + 1) if messages else 1,
                    "from": str(data["from"]).strip(),
                    "to": str(data["to"]).strip(),
                    "type": str(data.get("type") or "note").strip(),
                    "title": str(data["title"]).strip(),
                    "body": str(data.get("body") or ""),
                    "status": "open",
                    "result": "",
                    "created_at": now_iso(),
                    "done_at": "",
                }
                messages.append(msg)
                save_messages(messages)
            return self._send(201, msg)
        if parsed.path == "/api/heartbeat":
            data = self._body_json()
            agent = str(data.get("agent") or "").strip()
            if not agent:
                return self._send(400, {"error": "missing field: agent"})
            with LOCK:
                agents = load_agents()
                agents[agent] = {"last_seen": now_iso(),
                                 "note": str(data.get("note") or "")}
                save_agents(agents)
            return self._send(200, {"ok": True, "agent": agent,
                                    "last_seen": agents[agent]["last_seen"]})
        if parsed.path.startswith("/api/messages/") and parsed.path.endswith("/done"):
            try:
                msg_id = int(parsed.path.split("/")[3])
            except (IndexError, ValueError):
                return self._send(400, {"error": "bad message id"})
            data = self._body_json()
            with LOCK:
                messages = load_messages()
                for m in messages:
                    if m.get("id") == msg_id:
                        m["status"] = "done"
                        m["result"] = str(data.get("result") or "")
                        m["done_at"] = now_iso()
                        save_messages(messages)
                        return self._send(200, m)
            return self._send(404, {"error": "message not found"})
        return self._send(404, {"error": "not found"})


if __name__ == "__main__":
    if not API_KEY:
        raise SystemExit("BRIDGE_API_KEY is not set — refusing to start open.")
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"muse-bridge listening on 127.0.0.1:{PORT}", flush=True)
    server.serve_forever()
