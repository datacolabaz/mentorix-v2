#!/usr/bin/env node
/**
 * Europe apply linkləri üçün ad uyğunsuzluğunu ILIKE ilə həll edir.
 * Yalnız tək uyğunluq tapılanda UPDATE edir.
 *
 *   npm run fix:apply-links-fuzzy
 *   npm run fix:apply-links-fuzzy -- --dry-run
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

const { fixApplyLinksFuzzyMatch } = require('../src/services/applyLinksFuzzyMatchService');

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

  console.log(`[fix:apply-links-fuzzy] ${dryRun ? 'dry-run' : 'live'} başladı…`);
  const stats = await fixApplyLinksFuzzyMatch({ file: file || null, dryRun });

  console.log('\n=== XÜLASƏ ===');
  console.log(`Uğurla yeniləndi: ${stats.summary.updated_count}`);
  console.log(`Exact match (fuzzy lazım deyil): ${stats.summary.exact_match_skipped_count}`);
  console.log(`Admin review (ambiguous): ${stats.summary.ambiguous_count}`);
  console.log(`Tapılmadı: ${stats.summary.not_found_count}`);
  console.log(`Xəta: ${stats.summary.error_count}`);
  console.log(`Proqram BSc yeniləndi: ${stats.programs_bsc_updated}`);
  console.log(`Proqram MSc/PhD yeniləndi: ${stats.programs_grad_updated}`);

  if (stats.ambiguous.length) {
    console.log('\n=== AMBIGUOUS (admin review) ===');
    for (const item of stats.ambiguous) {
      console.log(`- ${item.catalog_name}`);
      for (const m of item.matches) {
        console.log(`    • ${m.name} (${m.country}) id=${m.id}`);
      }
    }
  }

  if (stats.not_found.length) {
    console.log('\n=== TAPILMADI ===');
    for (const item of stats.not_found) {
      console.log(`- ${item.catalog_name}: ${item.reason}`);
    }
  }

  if (stats.updated.length) {
    console.log('\n=== YENILƏNDI ===');
    for (const item of stats.updated) {
      console.log(`- ${item.catalog_name} → ${item.db_name} (BSc:${item.programs_bsc_updated}, grad:${item.programs_grad_updated})`);
    }
  }

  console.log('\n[fix:apply-links-fuzzy] full stats:', JSON.stringify(stats, null, 2));
  process.exit(stats.errors.length ? 1 : 0);
}

main().catch((err) => {
  console.error('[fix:apply-links-fuzzy] failed:', err?.message || err);
  process.exit(1);
});
