#!/usr/bin/env node
/**
 * Mastersportal kataloq scrape target-lərini yaradır (~30 field × 3 degree).
 * Usage: node scripts/generateScrapeTargets.js [--min=50]
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

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
  console.error('[generate-scrape-targets] failed:', err?.message || err);
  process.exit(1);
});
