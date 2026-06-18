const db = require('../utils/db');
const { fetchPageText, callOpenAiProgramExtract } = require('./universityProgramAiExtractService');
const { upsertUniversity, upsertProgram } = require('./universityProgramIngestService');

const AUTO_APPROVE = process.env.UNIVERSITY_SCRAPER_AUTO_APPROVE === 'true';

async function listScrapeTargets({ activeOnly = true } = {}) {
  const where = activeOnly ? 'WHERE is_active = true' : '';
  const { rows } = await db.query(
    `SELECT * FROM university_scrape_targets ${where} ORDER BY country, university_name`,
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

async function scrapeTarget(target) {
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
      if (row) saved += 1;
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
      programs_found: saved,
      duration_ms: Date.now() - started,
      model,
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
    return { success: false, target_id: target.id, error: msg };
  }
}

async function runScraperBatch({ limit = 5 } = {}) {
  const targets = await listScrapeTargets({ activeOnly: true });
  const slice = targets.slice(0, Math.max(1, Number(limit) || 5));
  const results = [];
  for (const target of slice) {
    // eslint-disable-next-line no-await-in-loop
    results.push(await scrapeTarget(target));
  }
  const ok = results.filter((r) => r.success).length;
  return { success: true, processed: results.length, succeeded: ok, results };
}

module.exports = {
  listScrapeTargets,
  scrapeTarget,
  runScraperBatch,
};
