const db = require('../utils/db');

function legacyId(value) {
  // PostgreSQL also accepts compact/braced UUIDs; legacy bulk handlers trim IDs.
  if (typeof value !== 'string') return null;
  const hex = value.trim().toLowerCase().replace(/[{}-]/g, '');
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Canonical answers/snapshots must never enter the legacy renderer, grader or AI.
// Run after authentication on protected exam routes, including bulk deletes.
async function bankExamLegacyGuard(req, res, next) {
  const values = [req.params.id, req.body?.exam_id,
    ...(Array.isArray(req.body?.exam_ids) ? req.body.exam_ids : []),
    ...(Array.isArray(req.body?.ids) ? req.body.ids : [])];
  const ids = [...new Set(values.map(legacyId).filter(Boolean))];
  if (!ids.length) return next();
  try {
    const { rows } = await db.query(
      'SELECT exam_id FROM exam_bank_settings WHERE exam_id=ANY($1::uuid[]) LIMIT 1', [ids],
    );
    if (rows.length) return res.status(409).json({
      success: false, code: 'QUESTION_BANK_API_REQUIRED',
      message: 'Bu imtahan üçün Sual Bankı API-sindən istifadə edin',
      api_base: '/api/question-bank',
    });
    next();
  } catch (e) { next(e); }
}
module.exports = { bankExamLegacyGuard };
