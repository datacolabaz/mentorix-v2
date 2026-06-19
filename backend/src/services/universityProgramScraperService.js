const db = require('../utils/db');
const { fetchPageText, callOpenAiProgramExtract } = require('./universityProgramAiExtractService');
const { upsertUniversity, upsertProgram } = require('./universityProgramIngestService');
const { scrapeCatalogTarget } = require('./mastersportalCatalogService');
const { ensureScrapeTargets } = require('./universityScrapeTargetGeneratorService');

const AUTO_APPROVE = process.env.UNIVERSITY_SCRAPER_AUTO_APPROVE === 'true';

async function listScrapeTargets({ activeOnly = true, targetType = null } = {}) {
  const clauses = [];
  const params = [];
  if (activeOnly) clauses.push('is_active = true');
  if (targetType) {
    params.push(targetType);
    clauses.push(`target_type = $${params.length}`);
  }
  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const { rows } = await db.query(
    `
    SELECT *
    FROM university_scrape_targets
    ${where}
    ORDER BY
      CASE target_type WHEN 'catalog' THEN 0 ELSE 1 END,
      last_scraped_at NULLS FIRST,
      country,
      university_name
    `,
    params,
  );
  return rows;
}

async function logScrapeRun({ target_id, status, programs_found, error_message, ai_model }) {
  await db.query(
    `
    INSERT INTO university_scrape_runs (target_id, status, programs_found, error_message, ai_model, finished_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    `,
    [target_id, status, programs_found || 0, error_message || null, ai_model || null],
  );
}

function emptyStats() {
  return { inserted: 0, updated: 0, skipped: 0, errors: 0, mock_fallbacks: 0 };
}

function mergeStats(total, partial) {
  if (!partial) return;
  total.inserted += partial.inserted || 0;
  total.updated += partial.updated || 0;
  total.skipped += partial.skipped || 0;
}

async function scrapeUniversityPageTarget(target) {
  const started = Date.now();
  try {
    const pageText = await fetchPageText(target.admission_url);
    if (!pageText || pageText.length < 200) {
      throw new Error('Səhifə mətni çox qısadır və ya boşdur');
    }

    const { parsed, model } = await callOpenAiProgramExtract({ pageText, target });
    const uniPayload = {
      name: parsed.university_name || target.university_name,
      country: parsed.country || target.country,
      city: parsed.city || null,
    };
    const university = await upsertUniversity(uniPayload);
    const programs = Array.isArray(parsed.programs) ? parsed.programs : [];
    const stats = emptyStats();
    let saved = 0;

    for (const p of programs) {
      const row = await upsertProgram({
        uni_id: university.id,
        payload: {
          ...p,
          field: p.field || target.field_hint,
          field_hint: target.field_hint,
          apply_link: p.apply_link || target.admission_url,
        },
        source_type: 'scraper',
        review_status: AUTO_APPROVE ? 'approved' : 'pending',
        scrape_url: target.admission_url,
        ai_raw_json: { extracted: p, target_id: target.id },
      });
      if (row) {
        saved += 1;
        if (row.was_inserted) stats.inserted += 1;
        else stats.updated += 1;
      } else {
        stats.skipped += 1;
      }
    }

    await db.query(
      `UPDATE university_scrape_targets SET last_scraped_at = NOW(), last_error = NULL, updated_at = NOW() WHERE id = $1`,
      [target.id],
    );
    await logScrapeRun({
      target_id: target.id,
      status: 'success',
      programs_found: saved,
      ai_model: model,
    });

    return {
      success: true,
      target_id: target.id,
      target_type: 'university',
      programs_found: saved,
      duration_ms: Date.now() - started,
      model,
      stats,
    };
  } catch (err) {
    const msg = err?.message || 'Skrayp uğursuz';
    await db.query(
      `UPDATE university_scrape_targets SET last_error = $2, updated_at = NOW() WHERE id = $1`,
      [target.id, msg.slice(0, 500)],
    );
    await logScrapeRun({
      target_id: target.id,
      status: 'failed',
      programs_found: 0,
      error_message: msg,
    });
    return { success: false, target_id: target.id, target_type: 'university', error: msg, stats: emptyStats() };
  }
}

async function scrapeCatalogPageTarget(target) {
  const started = Date.now();
  try {
    const result = await scrapeCatalogTarget(target);
    const saved = result.saved || 0;
    const stats = result.stats || emptyStats();

    await db.query(
      `UPDATE university_scrape_targets SET last_scraped_at = NOW(), last_error = NULL, updated_at = NOW() WHERE id = $1`,
      [target.id],
    );
    await logScrapeRun({
      target_id: target.id,
      status: result.mock ? 'skipped' : 'success',
      programs_found: saved,
      ai_model: result.model || null,
      error_message: result.mock ? 'mock_fallback' : null,
    });

    return {
      success: true,
      target_id: target.id,
      target_type: 'catalog',
      programs_found: saved,
      duration_ms: Date.now() - started,
      model: result.model,
      mock: Boolean(result.mock),
      stats,
    };
  } catch (err) {
    const msg = err?.message || 'Kataloq skrayp uğursuz';
    await db.query(
      `UPDATE university_scrape_targets SET last_error = $2, updated_at = NOW() WHERE id = $1`,
      [target.id, msg.slice(0, 500)],
    );
    await logScrapeRun({
      target_id: target.id,
      status: 'failed',
      programs_found: 0,
      error_message: msg,
    });
    return { success: false, target_id: target.id, target_type: 'catalog', error: msg, stats: emptyStats() };
  }
}

async function scrapeTarget(target) {
  if (target.target_type === 'catalog') {
    return scrapeCatalogPageTarget(target);
  }
  return scrapeUniversityPageTarget(target);
}

async function runScraperBatch({ catalogLimit = 10, uniLimit = 3, limit } = {}) {
  const resolvedCatalogLimit = Number(catalogLimit) || 10;
  const resolvedUniLimit = limit != null ? Number(limit) || 3 : Number(uniLimit) || 3;
  const targetsGenerated = await ensureScrapeTargets({ minTargets: 50 });

  const all = await listScrapeTargets({ activeOnly: true });
  const catalogs = all.filter((t) => t.target_type === 'catalog').slice(0, Math.max(0, resolvedCatalogLimit));
  const universities = all.filter((t) => t.target_type !== 'catalog').slice(0, Math.max(1, resolvedUniLimit));
  const slice = [...catalogs, ...universities];

  const totals = emptyStats();
  const results = [];

  for (const target of slice) {
    // eslint-disable-next-line no-await-in-loop
    const result = await scrapeTarget(target);
    results.push(result);
    mergeStats(totals, result.stats);
    if (!result.success) totals.errors += 1;
    if (result.mock) totals.mock_fallbacks += 1;
  }

  const ok = results.filter((r) => r.success).length;
  return {
    success: true,
    processed: results.length,
    succeeded: ok,
    catalog_processed: catalogs.length,
    university_processed: universities.length,
    targets_generated: targetsGenerated,
    totals,
    results,
  };
}

module.exports = {
  listScrapeTargets,
  scrapeTarget,
  scrapeUniversityPageTarget,
  scrapeCatalogPageTarget,
  runScraperBatch,
};
