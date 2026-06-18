const {
  runScraperBatch,
  listScrapeTargets,
  scrapeTarget,
} = require('../services/universityProgramScraperService');
const {
  listPendingPrograms,
  reviewProgram,
} = require('../services/universityProgramContributionService');

const runBatch = async (req, res) => {
  try {
    const limit = Number(req.body?.limit || req.query?.limit || 3);
    const result = await runScraperBatch({ limit });
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const listTargets = async (_req, res) => {
  try {
    const targets = await listScrapeTargets({ activeOnly: false });
    return res.json({ success: true, targets });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const runOne = async (req, res) => {
  try {
    const { rows } = await require('../utils/db').query(
      `SELECT * FROM university_scrape_targets WHERE id = $1`,
      [req.params.id],
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Target tapılmadı' });
    const result = await scrapeTarget(rows[0]);
    return res.json({ success: result.success, result });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const listPending = async (_req, res) => {
  try {
    const programs = await listPendingPrograms();
    return res.json({ success: true, count: programs.length, data: programs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const patchReview = async (req, res) => {
  try {
    const { status, notes } = req.body || {};
    const program = await reviewProgram(req.params.id, { status, adminNotes: notes });
    return res.json({ success: true, program });
  } catch (err) {
    const code = err.status || 500;
    return res.status(code).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = {
  runBatch,
  listTargets,
  runOne,
  listPending,
  patchReview,
};
