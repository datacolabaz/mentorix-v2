const { runScraperBatch } = require('../services/universityProgramScraperService');

async function runUniversityProgramScraper() {
  const catalogLimit = Number(process.env.UNIVERSITY_SCRAPER_CATALOG_LIMIT || 10);
  const uniLimit = Number(process.env.UNIVERSITY_SCRAPER_BATCH_LIMIT || 3);

  const result = await runScraperBatch({ catalogLimit, uniLimit });

  console.log(
    '[university-scraper]',
    JSON.stringify({
      processed: result.processed,
      succeeded: result.succeeded,
      catalog_processed: result.catalog_processed,
      university_processed: result.university_processed,
      targets_generated: result.targets_generated,
      inserted: result.totals?.inserted,
      updated: result.totals?.updated,
      skipped: result.totals?.skipped,
      errors: result.totals?.errors,
      mock_fallbacks: result.totals?.mock_fallbacks,
    }),
  );

  return result;
}

module.exports = { runUniversityProgramScraper };
