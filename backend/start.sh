#!/bin/sh
set -eu

echo "[mentorix] booting…"
echo "[mentorix] node: $(node -v 2>/dev/null || echo unknown)"
echo "[mentorix] npm:  $(npm -v 2>/dev/null || echo unknown)"
echo "[mentorix] PORT=${PORT:-}"
echo "[mentorix] DATABASE_URL=${DATABASE_URL:+set}"

echo "[mentorix] ensuring certificate fonts…"
node scripts/download-certificate-fonts.js

echo "[mentorix] running migrations…"
node scripts/migrate.js

echo "[mentorix] starting api…"
exec node src/app.js

