#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
command -v docker >/dev/null || { echo 'Install Docker Desktop and open it, then run this installer again.'; exit 1; }
docker info >/dev/null 2>&1 || { echo 'Start Docker Desktop and wait for its engine, then retry.'; exit 1; }
docker compose version >/dev/null
if [ ! -f .env ]; then (umask 077; cp .env.example .env); fi
echo 'Building DCA AI. OpenAI is optional; an empty key is supported.'
docker compose -f compose.local.yaml up -d --build --wait --wait-timeout 180
echo 'DCA AI is ready. Default URL: http://localhost:3101/app (DCA_PORT in .env can override the port).'
echo 'Your Docker volume preserves agent keys, execution and accounting. Never run down -v unless deleting all data is intentional.'
