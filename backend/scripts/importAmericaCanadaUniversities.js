#!/usr/bin/env node
/**
 * Amerika/Kanada universitetləri seed import (JSON/CSV → DB)
 *
 *   npm run import:america
 *   npm run import:america -- --dry-run
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

const { importAmericaCanadaUniversities } = require('../src/services/americaCanadaUniversitiesImportService');

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

  console.log('[import:america] başladı…');
  console.log('[import:america] DATABASE_URL:', process.env.DATABASE_URL ? 'set' : 'YOX');

  const stats = await importAmericaCanadaUniversities({
    file: file || null,
    dryRun,
    limit: limit != null ? Number(limit) : null,
  });

  console.log('[import:america]', JSON.stringify(stats, null, 2));
  process.exit(stats.errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error('[import:america] failed:', err?.message || err);
  process.exit(1);
});
