const fs = require('fs');
const path = require('path');
const {
  parseCsv,
  parseJsonRecords,
  normalizeRecords,
} = require('../utils/universityProgramImportParsers');
const {
  upsertUniversity,
  upsertProgram,
} = require('./universityProgramIngestService');

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'MentorixBulkImport/1.0 (+https://mentorix.io)' },
    redirect: 'follow',
  });
  if (!res.ok) {
    throw new Error(`Yükləmə uğursuz: HTTP ${res.status} — ${url}`);
  }
  return res.text();
}

function loadFile(filePath) {
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(abs)) throw new Error(`Fayl tapılmadı: ${abs}`);
  return fs.readFileSync(abs, 'utf8');
}

async function loadImportPayload({ file, url, preset }) {
  if (preset) {
    const { PRESETS } = require('../utils/universityProgramImportParsers');
    const meta = PRESETS[preset];
    if (!meta) throw new Error(`Naməlum preset: ${preset}`);
    const text = await fetchText(meta.url);
    return { text, format: meta.format, label: meta.label };
  }
  if (url) {
    const text = await fetchText(url);
    const format = url.endsWith('.json') ? 'generic' : 'auto';
    return { text, format, label: url };
  }
  if (file) {
    const text = loadFile(file);
    const lower = file.toLowerCase();
    const format = lower.endsWith('.json') ? 'generic' : 'auto';
    return { text, format, label: file };
  }
  throw new Error('file, url və ya preset tələb olunur');
}

async function importUniversityPrograms({
  file,
  url,
  preset,
  format = 'auto',
  limit = null,
  dryRun = false,
  reviewStatus = 'approved',
  sourceType = 'seed',
} = {}) {
  const payload = await loadImportPayload({ file, url, preset });
  const resolvedFormat = format === 'auto' ? payload.format : format;

  let rawRows;
  if (resolvedFormat === 'generic' && (payload.label.endsWith('.json') || String(payload.text).trim().startsWith('['))) {
    rawRows = parseJsonRecords(payload.text);
  } else {
    rawRows = parseCsv(payload.text);
  }

  let records = normalizeRecords({ rows: rawRows, format: resolvedFormat });
  if (limit != null) records = records.slice(0, Math.max(0, Number(limit) || 0));

  const stats = {
    source: payload.label,
    format: resolvedFormat,
    total_rows: rawRows.length,
    parsed: records.length,
    inserted: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    dry_run: dryRun,
  };

  if (dryRun) return { stats, preview: records.slice(0, 5) };

  for (const rec of records) {
    try {
      const university = await upsertUniversity({
        name: rec.university_name,
        country: rec.country,
        city: rec.city,
        world_ranking: rec.world_ranking,
      });

      const row = await upsertProgram({
        uni_id: university.id,
        payload: {
          name: rec.program_name,
          degree_level: rec.degree_level,
          field: rec.field_raw,
          field_hint: rec.field_raw,
          duration_years: rec.duration_years,
          tuition_fee: rec.tuition_fee,
          scholarship_available: rec.scholarship_available,
          language: rec.language,
          deadline_dates: rec.deadline_dates,
          requirements: rec.requirements,
          apply_link: rec.apply_link,
        },
        source_type: sourceType,
        review_status: reviewStatus,
        scrape_url: null,
        ai_raw_json: {
          bulk_import: true,
          import_source: rec.import_source || resolvedFormat,
        },
      });

      if (!row) {
        stats.skipped += 1;
      } else if (row.was_inserted) {
        stats.inserted += 1;
      } else {
        stats.updated += 1;
      }
    } catch (err) {
      stats.errors += 1;
      if (stats.errors <= 3) {
        console.warn('[bulk-import] row error:', err?.message || err);
      }
    }
  }

  return { stats };
}

module.exports = {
  importUniversityPrograms,
};
