#!/usr/bin/env node
/**
 * Universitet proqramlarını CSV/JSON-dan bulk import.
 *
 * Nümunələr:
 *   npm run import:programs -- --preset study-abroad
 *   npm run import:programs -- --file ./data/imports/programs.csv
 *   npm run import:programs -- --url https://example.com/programs.json
 *   npm run import:programs -- --preset study-abroad --dry-run
 *   npm run import:programs -- --preset study-abroad --limit 100
 *
 * CSV sütunları (generic):
 *   university_name, country, city, program_name, degree_level, field,
 *   tuition_fee, language, ielts, deadline, apply_url, qs_ranking, scholarship_available
 */
const path = require('path');

const envBackend = path.join(__dirname, '../.env');
const envRoot = path.join(__dirname, '../../.env');
require('dotenv').config({ path: envBackend, override: true });
if (!process.env.DATABASE_URL) {
  require('dotenv').config({ path: envRoot, override: true });
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL boşdur. backend/.env yoxlayın.');
  process.exit(1);
}

const { importUniversityPrograms } = require('../src/services/universityProgramBulkImportService');
const { PRESETS } = require('../src/utils/universityProgramImportParsers');

function arg(name) {
  const hit = process.argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (!hit) return null;
  if (hit.includes('=')) return hit.split('=').slice(1).join('=');
  const idx = process.argv.indexOf(hit);
  return process.argv[idx + 1] || true;
}

async function main() {
  const presetRaw = arg('preset');
  const preset = presetRaw ? String(presetRaw).replace(/-/g, '_') : null;
  const file = arg('file');
  const url = arg('url');
  const limit = arg('limit');
  const dryRun = process.argv.includes('--dry-run');

  if (!preset && !file && !url) {
    console.log('Mentorix — universitet proqram bulk import\n');
    console.log('Presetlər:');
    for (const [key, meta] of Object.entries(PRESETS)) {
      console.log(`  --preset ${key.replace(/_/g, '-')}  →  ${meta.label}`);
    }
    console.log('\nDigər:');
    console.log('  --file ./path.csv');
    console.log('  --url https://...');
    console.log('  --limit 100   --dry-run');
    process.exit(0);
  }

  const result = await importUniversityPrograms({
    preset: preset || null,
    file: file || null,
    url: url || null,
    limit: limit != null ? Number(limit) : null,
    dryRun,
    reviewStatus: 'approved',
    sourceType: 'seed',
  });

  console.log('[import:programs]', JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error('[import:programs] failed:', err?.message || err);
  process.exit(1);
});
