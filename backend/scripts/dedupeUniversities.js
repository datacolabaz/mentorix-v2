#!/usr/bin/env node
/**
 * Eyni ad+ölkə ilə təkrarlanan universitetləri birləşdirir.
 *
 *   npm run dedupe:universities
 *   npm run dedupe:universities -- --dry-run
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

const {
  findDuplicateGroups,
  dedupeUniversities,
} = require('../src/services/universityDedupService');

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('[dedupe:universities] dublikat yoxlanışı…');
  const before = await findDuplicateGroups();
  console.log('[dedupe:universities] tapılan qrup:', before.length);
  if (before.length) {
    console.log(JSON.stringify(before, null, 2));
  }

  if (!before.length) {
    console.log('[dedupe:universities] dublikat yoxdur.');
    process.exit(0);
  }

  console.log(`[dedupe:universities] ${dryRun ? 'dry-run' : 'birləşdirmə'} başladı…`);
  const stats = await dedupeUniversities({ dryRun });
  console.log('[dedupe:universities]', JSON.stringify(stats, null, 2));
  process.exit(stats.errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error('[dedupe:universities] failed:', err?.message || err);
  process.exit(1);
});
