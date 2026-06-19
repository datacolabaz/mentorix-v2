const { DEGREE_PORTAL_KEY } = require('./universityScrapeTargetGeneratorService');
const { primaryEnglishFieldLabel } = require('../utils/fieldSlugNormalizer');
const {
  fetchPageHtml,
  stripHtml,
  callOpenAiCatalogExtract,
} = require('./universityProgramAiExtractService');
const { upsertUniversity, upsertProgram } = require('./universityProgramIngestService');
const { resolveFieldSlug } = require('../utils/fieldSlugNormalizer');
const { filterMockPrograms } = require('../constants/universityMockPrograms');

const PAGE_DELAY_MS = Number(process.env.MASTERSPORTAL_PAGE_DELAY_MS || 2000);
const MAX_PAGES = Number(process.env.MASTERSPORTAL_MAX_PAGES || 5);

const PORTAL_ORIGIN = {
  bachelor: 'https://www.bachelorsportal.com',
  master: 'https://www.mastersportal.com',
  phd: 'https://www.phdportal.com',
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildFetchUrl(target, page = 1) {
  const degreeKey = DEGREE_PORTAL_KEY[target.degree_type] || 'master';
  const origin = PORTAL_ORIGIN[degreeKey] || PORTAL_ORIGIN.master;
  const fieldSlug = target.field_slug || target.field_hint || 'general';
  const label = primaryEnglishFieldLabel(fieldSlug);
  const pathSlug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const pageQuery = page > 1 ? `?page=${page}` : '';
  return `${origin}/search/${pathSlug}${pageQuery}`;
}

function isBlockedResponse(status, html) {
  if (status === 403 || status === 429 || status === 503) return true;
  const sample = String(html || '').slice(0, 4000).toLowerCase();
  return (
    sample.includes('captcha')
    || sample.includes('access denied')
    || sample.includes('cloudflare')
    || sample.includes('please verify you are a human')
  );
}

function mapCatalogProgramToPayload(program, target) {
  const fieldRaw = program.field_raw || program.field || program.field_of_study || target.field_slug;
  const { slug, needsReview } = resolveFieldSlug(fieldRaw, target.field_slug || target.field_hint);

  const requirements = program.requirements && typeof program.requirements === 'object'
    ? { ...program.requirements }
    : {};

  if (program.ielts != null && !requirements.min_language) {
    requirements.min_language = { ielts: Number(program.ielts) };
  }

  return {
    payload: {
      name: program.program_name || program.name,
      degree_level: program.degree_level || target.degree_type || target.degree_hint,
      field: slug,
      field_hint: target.field_slug || target.field_hint,
      language: program.language || 'English',
      tuition_fee: program.tuition_fee != null ? Number(program.tuition_fee) : program.tuition_fee_eur,
      scholarship_available: Boolean(program.scholarship_available || program.has_scholarship),
      duration_years: program.duration_years != null ? Number(program.duration_years) : null,
      deadline_dates: program.deadline
        ? [String(program.deadline).slice(0, 10)]
        : Array.isArray(program.deadline_dates)
          ? program.deadline_dates
          : [],
      requirements,
      apply_link: program.apply_url || program.apply_link || null,
    },
    university: {
      name: program.university_name,
      country: program.country,
      city: program.city || null,
      world_ranking: program.qs_ranking != null ? Number(program.qs_ranking) : null,
    },
    needsReview,
    fieldRaw,
  };
}

async function upsertCatalogPrograms(programs, target, scrapeUrl, stats) {
  let saved = 0;

  for (const program of programs) {
    if (!program?.university_name || !(program.program_name || program.name)) {
      stats.skipped += 1;
      // eslint-disable-next-line no-continue
      continue;
    }

    const mapped = mapCatalogProgramToPayload(program, target);
    // eslint-disable-next-line no-await-in-loop
    const university = await upsertUniversity(mapped.university);
    const reviewStatus = mapped.needsReview ? 'pending' : 'approved';

    // eslint-disable-next-line no-await-in-loop
    const row = await upsertProgram({
      uni_id: university.id,
      payload: mapped.payload,
      source_type: 'scraper',
      review_status: reviewStatus,
      scrape_url: scrapeUrl,
      ai_raw_json: {
        source: 'mastersportal',
        field_raw: mapped.fieldRaw,
        target_id: target.id,
        extracted: program,
      },
    });

    if (row) {
      saved += 1;
      if (row.was_inserted) stats.inserted += 1;
      else stats.updated += 1;
    } else {
      stats.skipped += 1;
    }
  }

  return saved;
}

async function upsertMockFallbackForTarget(target) {
  const filters = {
    degreeLevel: target.degree_type || target.degree_hint,
    fields: [target.field_slug || target.field_hint].filter(Boolean),
    page: 1,
    limit: 50,
    offset: 0,
  };
  const { rows } = filterMockPrograms(filters, {});
  const stats = { inserted: 0, updated: 0, skipped: 0, mock: true };

  const programs = rows.map((p) => ({
    university_name: p.university?.name,
    country: p.university?.country,
    city: p.university?.city,
    program_name: p.name,
    degree_level: p.degree_level,
    field_raw: p.field,
    tuition_fee: p.tuition_fee,
    language: p.language,
    scholarship_available: p.scholarship_available,
    deadline_dates: p.deadline_dates,
    requirements: p.requirements,
    apply_url: p.apply_link,
    qs_ranking: p.university?.world_ranking,
  }));

  const saved = await upsertCatalogPrograms(programs, target, target.admission_url, stats);
  return { saved, stats, mock: true };
}

async function scrapeCatalogTarget(target) {
  const pageTexts = [];
  let blocked = false;
  let lastStatus = 0;

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    if (page > 1) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(PAGE_DELAY_MS);
    }

    const url = buildFetchUrl(target, page);
    try {
      // eslint-disable-next-line no-await-in-loop
      const { status, html } = await fetchPageHtml(url);
      lastStatus = status;
      if (!html || isBlockedResponse(status, html)) {
        blocked = true;
        break;
      }
      const text = stripHtml(html);
      if (text.length < 150) {
        if (page === 1) blocked = true;
        break;
      }
      pageTexts.push(`--- Page ${page} (${url}) ---\n${text}`);
    } catch (err) {
      if (page === 1) {
        blocked = true;
        lastStatus = err?.status || 0;
      }
      break;
    }
  }

  if (blocked || !pageTexts.length) {
    console.warn(
      `[mastersportal] blocked or empty for ${target.field_slug}/${target.degree_type} (HTTP ${lastStatus}), using mock fallback`,
    );
    return upsertMockFallbackForTarget(target);
  }

  const combined = pageTexts.join('\n\n').slice(0, 55000);
  const { parsed, model } = await callOpenAiCatalogExtract({ pageText: combined, target });
  const programs = Array.isArray(parsed.programs) ? parsed.programs : [];
  const stats = { inserted: 0, updated: 0, skipped: 0, mock: false };

  if (!programs.length) {
    console.warn(`[mastersportal] AI extracted 0 programs for ${target.field_slug}/${target.degree_type}, mock fallback`);
    const fallback = await upsertMockFallbackForTarget(target);
    return { ...fallback, model, blocked: false, empty_extract: true };
  }

  const saved = await upsertCatalogPrograms(programs, target, target.admission_url, stats);
  return { saved, stats, model, mock: false };
}

module.exports = {
  buildFetchUrl,
  scrapeCatalogTarget,
  upsertMockFallbackForTarget,
  PAGE_DELAY_MS,
  MAX_PAGES,
};
