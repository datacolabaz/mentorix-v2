#!/usr/bin/env node
/**
 * Avropa proqram apply linklərini BSc vs MSc/PhD üzrə yeniləyir (yalnız UPDATE)
 *
 *   npm run update:europe-apply-links
 *   npm run update:europe-apply-links -- --dry-run
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

const { updateEuropeApplyLinks } = require('../src/services/europeApplyLinksService');

function arg(name) {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return null;
  if (hit.includes('=')) return hit.split('=').slice(1).join('=');
  const idx = process.argv.indexOf(hit);
  return process.argv[idx + 1] || true;
}

async function main() {
  const file = arg('file');
  const dryRun = process.argv.includes('--dry-run');

  console.log('[update:europe-apply-links] başladı…');
  const stats = await updateEuropeApplyLinks({ file: file || null, dryRun });
  console.log('[update:europe-apply-links]', JSON.stringify(stats, null, 2));
  process.exit(stats.errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error('[update:europe-apply-links] failed:', err?.message || err);
  process.exit(1);
});
