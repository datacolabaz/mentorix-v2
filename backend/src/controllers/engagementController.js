const {
  getMaterialSummaries,
  getMaterialDetail,
  getAssignmentSummaries,
  getAssignmentDetail,
  recordMaterialEvent,
  sendReminders,
  setMaterialDueAt,
} = require('../services/engagementService');
const { normalizeExamStartTime } = require('../utils/examTime');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Admin başqa müəllimin məlumatına ?instructor_id= ilə baxa bilər; müəllim yalnız özününküyə. */
function ownerId(req) {
  if (req.user.role === 'admin' && UUID_RE.test(String(req.query.instructor_id || ''))) {
    return String(req.query.instructor_id);
  }
  return req.user.id;
}

function parseIds(raw) {
  if (!raw) return null;
  const ids = String(raw).split(',').map((s) => s.trim()).filter((s) => UUID_RE.test(s));
  return ids.length ? ids.slice(0, 200) : null;
}

function fail(res, err) {
  res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Xəta' });
}

function requireUuid(res, id) {
  if (UUID_RE.test(String(id || ''))) return true;
  res.status(400).json({ success: false, message: 'ID düzgün deyil' });
  return false;
}

const listMaterialEngagement = async (req, res) => {
  try {
    const materials = await getMaterialSummaries(ownerId(req), { materialIds: parseIds(req.query.ids) });
    res.json({ success: true, materials });
  } catch (err) {
    fail(res, err);
  }
};

const getMaterialEngagement = async (req, res) => {
  try {
    if (!requireUuid(res, req.params.id)) return;
    const data = await getMaterialDetail(ownerId(req), req.params.id, { filter: req.query.filter || null });
    res.json({ success: true, ...data });
  } catch (err) {
    fail(res, err);
  }
};

const listAssignmentEngagement = async (req, res) => {
  try {
    const assignments = await getAssignmentSummaries(ownerId(req), { assignmentIds: parseIds(req.query.ids) });
    res.json({ success: true, assignments });
  } catch (err) {
    fail(res, err);
  }
};

const getAssignmentEngagement = async (req, res) => {
  try {
    if (!requireUuid(res, req.params.id)) return;
    const data = await getAssignmentDetail(ownerId(req), req.params.id, { filter: req.query.filter || null });
    res.json({ success: true, ...data });
  } catch (err) {
    fail(res, err);
  }
};

const postReminders = (entityType) => async (req, res) => {
  try {
    if (!requireUuid(res, req.params.id)) return;
    const raw = req.body?.student_ids;
    const studentIds = Array.isArray(raw) ? raw.map(String).filter((s) => UUID_RE.test(s)) : null;
    const result = await sendReminders(ownerId(req), entityType, req.params.id, { studentIds });
    res.json({ success: true, ...result });
  } catch (err) {
    fail(res, err);
  }
};

const patchMaterialDeadline = async (req, res) => {
  try {
    if (!requireUuid(res, req.params.id)) return;
    const raw = req.body?.due_at;
    const dueAt = raw == null || raw === '' ? null : normalizeExamStartTime(raw);
    if (raw && !dueAt) return res.status(400).json({ success: false, message: 'Tarix düzgün deyil' });
    const row = await setMaterialDueAt(ownerId(req), req.params.id, dueAt);
    res.json({ success: true, material: row });
  } catch (err) {
    fail(res, err);
  }
};

const postMaterialEvent = async (req, res) => {
  try {
    if (!requireUuid(res, req.params.id)) return;
    const result = await recordMaterialEvent(req.user.id, req.params.id, req.body || {});
    // Tələbəyə yalnız öz vəziyyəti qaytarılır, başqalarının məlumatı yox.
    res.json({ success: true, duplicate: result.duplicate, event_type: result.event_type });
  } catch (err) {
    fail(res, err);
  }
};

module.exports = {
  listMaterialEngagement,
  getMaterialEngagement,
  listAssignmentEngagement,
  getAssignmentEngagement,
  postMaterialReminders: postReminders('material'),
  postAssignmentReminders: postReminders('assignment'),
  patchMaterialDeadline,
  postMaterialEvent,
};
