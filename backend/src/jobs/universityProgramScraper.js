const { runScraperBatch } = require('../services/universityProgramScraperService');

async function runUniversityProgramScraper() {
  const limit = Number(process.env.UNIVERSITY_SCRAPER_BATCH_LIMIT || 3);
  const result = await runScraperBatch({ limit });
  console.log('[university-scraper]', JSON.stringify({ processed: result.processed, succeeded: result.succeeded }));
  return result;
}

module.exports = { runUniversityProgramScraper };
