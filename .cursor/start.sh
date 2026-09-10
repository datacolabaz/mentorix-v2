#!/usr/bin/env bash
# Per-boot startup for the Mentorix dev environment.
# Starts PostgreSQL, ensures the database/role exist, then bootstraps and
# migrates the schema. Safe to run repeatedly (idempotent).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[start] Starting PostgreSQL cluster…"
sudo pg_ctlcluster 16 main start 2>/dev/null || true

echo "[start] Waiting for PostgreSQL to accept connections…"
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done

echo "[start] Ensuring role password and database…"
sudo -u postgres psql -q -c "ALTER USER postgres WITH PASSWORD 'postgres';"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='mentorix'" | grep -q 1; then
  sudo -u postgres psql -q -c "CREATE DATABASE mentorix;"
fi

echo "[start] Bootstrapping + migrating schema…"
cd "$REPO_ROOT/backend"
node scripts/init-fresh-db.js
node scripts/migrate.js

echo "[start] Ready."
