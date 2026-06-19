#!/usr/bin/env node
/**
 * Mastersportal kataloq scrape target-lərini yaradır (~28 field × 3 degree).
 * Usage: node scripts/generateScrapeTargets.js [--min=50]
 *
 * Əvvəl: backend/.env içində DATABASE_URL + npm run migrate
 */
const path = require('path');

const envBackend = path.join(__dirname, '../.env');
const envRoot = path.join(__dirname, '../../.env');
require('dotenv').config({ path: envBackend, override: true });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: envRoot, override: true });
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL boşdur.');
  console.error('backend/.env yaradın (nümunə: backend/.env.example), sonra: npm run migrate');
  process.exit(1);
}

const { ensureScrapeTargets, countScrapeTargets } = require('../src/services/universityScrapeTargetGeneratorService');

async function main() {
  const minArg = process.argv.find((a) => a.startsWith('--min='));
  const minTargets = minArg ? Number(minArg.split('=')[1]) : 50;

  const before = await countScrapeTargets();
  console.log(`[generate-scrape-targets] existing targets: ${before}`);

  const result = await ensureScrapeTargets({ minTargets });
  console.log('[generate-scrape-targets]', JSON.stringify(result, null, 2));

  process.exit(0);
}

main().catch((err) => {
  if (err?.code === '42P01') {
    console.error('[generate-scrape-targets] Cədvəl tapılmadı. Əvvəl `npm run migrate` işlədin.');
  } else {
    console.error('[generate-scrape-targets] failed:', err?.message || err);
  }
  process.exit(1);
});
