#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVICES_DIR="$(dirname "$SCRIPT_DIR")"
CURRENT_USER="$(whoami)"
SERVICE_NAME="export-service"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "Starting storage services..."
docker compose -f "$SERVICES_DIR/docker-compose.storage.yml" up -d

cat <<EOF | sudo tee "$SERVICE_FILE" > /dev/null
[Unit]
Description=Islamic Library Export Service
After=network.target

[Service]
Type=simple
User=${CURRENT_USER}
WorkingDirectory=${SCRIPT_DIR}
ExecStart=${SCRIPT_DIR}/.venv/bin/python main.py
EnvironmentFile=${SCRIPT_DIR}/.env
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
sudo systemctl restart "$SERVICE_NAME"
sudo systemctl status "$SERVICE_NAME"
