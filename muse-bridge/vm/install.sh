#!/usr/bin/env bash
# Install the Muse Bridge service on the aayushbot VM.
# Run as azureuser with sudo available. Safe to re-run (updates code, keeps data).
set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="/opt/muse-bridge"

sudo mkdir -p "$APP_DIR/data"
sudo cp "$SRC_DIR/bridge_service.py" "$APP_DIR/bridge_service.py"
if [ ! -f "$APP_DIR/.env" ]; then
  KEY="$(python3 -c 'import secrets; print(secrets.token_hex(24))')"
  printf "PORT=8797\nBRIDGE_API_KEY=%s\n" "$KEY" | sudo tee "$APP_DIR/.env" > /dev/null
  echo "Created $APP_DIR/.env with a fresh API key."
  echo "IMPORTANT: the key is in $APP_DIR/.env on the VM only — read it there,"
  echo "never paste it into any chat."
fi
sudo chown -R azureuser:azureuser "$APP_DIR"
sudo cp "$SRC_DIR/muse-bridge.service" /etc/systemd/system/muse-bridge.service
sudo systemctl daemon-reload
sudo systemctl enable --now muse-bridge
sleep 1
curl -s http://127.0.0.1:8797/api/health && echo
echo "Service installed. Next: point Caddy at it (see README.md)."
