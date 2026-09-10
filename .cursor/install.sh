#!/usr/bin/env bash
# Idempotent one-time setup for the Mentorix dev environment.
# Runs after the repository is checked out. Installs system + project
# dependencies and writes local .env files (with dev defaults) if missing.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[install] Installing PostgreSQL…"
sudo apt-get update -qq
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql postgresql-contrib

echo "[install] Installing backend dependencies…"
cd "$REPO_ROOT/backend"
npm install --no-audit --no-fund

if [ ! -f "$REPO_ROOT/backend/.env" ]; then
  echo "[install] Writing backend/.env (dev defaults)…"
  cat > "$REPO_ROOT/backend/.env" <<'EOF'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/mentorix
JWT_SECRET=local_dev_secret_key_at_least_32_characters_long_123
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
FRONTEND_BASE_URL=http://localhost:5173
SMS_TITLE=Mentorix
EOF
fi

echo "[install] Installing frontend dependencies…"
cd "$REPO_ROOT/frontend"
npm install --no-audit --no-fund

if [ ! -f "$REPO_ROOT/frontend/.env" ]; then
  echo "[install] Writing frontend/.env (dev defaults)…"
  cat > "$REPO_ROOT/frontend/.env" <<'EOF'
# Empty VITE_API_URL => the Vite dev proxy (/api -> localhost:3001) is used.
VITE_API_URL=
VITE_GOOGLE_MAPS_API_KEY=
VITE_GOOGLE_CLIENT_ID=
EOF
fi

echo "[install] Done."
