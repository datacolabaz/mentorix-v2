#!/usr/bin/env node
/**
 * Avropa universitetləri seed import (JSON/CSV → DB)
 *
 *   npm run import:europe
 *   npm run import:europe -- --dry-run
 *   npm run import:europe -- --file ./data/europe_universities.csv --limit 5
 */
const path = require('path');

const envBackend = path.join(__dirname, '../.env');
const envRoot = path.join(__dirname, '../../.env');
require('dotenv').config({ path: envBackend, override: true });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: envRoot, override: true });
}

if (
  process.env.DATABASE_URL
  && !process.env.DATABASE_URL.includes('localhost')
  && !process.env.DATABASE_URL.includes('127.0.0.1')
) {
  process.env.NODE_ENV = 'production';
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL boşdur. backend/.env yoxlayın.');
  process.exit(1);
}

const { importEuropeUniversities } = require('../src/services/europeUniversitiesImportService');

function arg(name) {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return null;
  if (hit.includes('=')) return hit.split('=').slice(1).join('=');
  const idx = process.argv.indexOf(hit);
  return process.argv[idx + 1] || true;
}

async function main() {
  const file = arg('file');
  const limit = arg('limit');
  const dryRun = process.argv.includes('--dry-run');

  console.log('[import:europe] başladı… (Railway DB ~3–5 dəq çəkə bilər, gözləyin)');
  console.log('[import:europe] DATABASE_URL:', process.env.DATABASE_URL ? 'set' : 'YOX');

  const stats = await importEuropeUniversities({
    file: file || null,
    dryRun,
    limit: limit != null ? Number(limit) : null,
  });

  console.log('[import:europe]', JSON.stringify(stats, null, 2));
  process.exit(stats.errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error('[import:europe] failed:', err?.message || err);
  process.exit(1);
});
