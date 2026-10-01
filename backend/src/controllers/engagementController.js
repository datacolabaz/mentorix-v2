const {
  getMaterialSummaries,
  getMaterialDetail,
  getAssignmentSummaries,
  getAssignmentDetail,
  getExamSummaries,
  getExamDetail,
  getStudentTimeline,
  recordMaterialEvent,
  previewReminders,
  sendReminders,
  setMaterialDueAt,
} = require('../services/engagementService');
const { normalizeExamStartTime } = require('../utils/examTime');
const { resolveActivityScope, UUID_RE } = require('../services/activityAccessPolicy');
const { recordAdminAccess } = require('../services/adminAccessAudit');
const { parseReportQuery } = require('../services/activityReportRules');

const ENTITY_PLURAL = Object.freeze({ material: 'materials', assignment: 'assignments', exam: 'exams' });
const MAX_REMINDER_RECIPIENTS = 500;

/**
 * Kimin məlumatına baxılır (activityAccessPolicy): müəllim — yalnız özününkü; admin — yalnız oxumaq,
 * ?instructor_id= + ?reason= tələb olunur və hər baxış audit jurnalına yazılır (yazılmasa giriş yoxdur).
 * Uğursuzluqda cavab göndərilir və null qaytarılır.
 */
async function scopeFor(req, res, { action, entityType = null, entityId = null, write = false } = {}) {
  const scope = resolveActivityScope(req.user, {
    instructorId: req.query.instructor_id,
    reason: req.query.reason ?? req.get?.('x-admin-reason'),
    write,
  });
  if (!scope.ok) {
    res.status(scope.status).json({ success: false, code: scope.code, message: scope.message, ...(scope.details || {}) });
    return null;
  }
  if (scope.admin) {
    await recordAdminAccess({
      actorUserId: req.user.id,
      action,
      targetUserId: scope.admin.targetInstructorId,
      entityType,
      entityId,
      reason: scope.admin.reason,
      req,
    });
  }
  return scope.ownerId;
}

function parseIds(raw) {
  if (!raw) return null;
  const ids = String(raw).split(',').map((s) => s.trim()).filter((s) => UUID_RE.test(s));
  return ids.length ? ids.slice(0, 200) : null;
}

function fail(res, err) {
  const status = err.statusCode || 500;
  if (status >= 500) console.error('[engagement]', err.message);
  res.status(status).json({
    success: false,
    code: err.code,
    message: status >= 500 && !err.statusCode ? 'Server xətası' : err.message || 'Xəta',
  });
}

function studentIdsFrom(body) {
  const raw = body?.student_ids;
  if (!Array.isArray(raw)) return null;
  return raw.map(String).filter((s) => UUID_RE.test(s)).slice(0, MAX_REMINDER_RECIPIENTS);
}

function requireUuid(res, id) {
  if (UUID_RE.test(String(id || ''))) return true;
  res.status(400).json({ success: false, message: 'ID düzgün deyil' });
  return false;
}

const listMaterialEngagement = async (req, res) => {
  try {
    const owner = await scopeFor(req, res, { action: 'activity.materials.list', entityType: 'material' });
    if (!owner) return;
    const materials = await getMaterialSummaries(owner, { materialIds: parseIds(req.query.ids) });
    res.json({ success: true, materials });
  } catch (err) {
    fail(res, err);
  }
};

const getMaterialEngagement = async (req, res) => {
  try {
    if (!requireUuid(res, req.params.id)) return;
    const owner = await scopeFor(req, res, {
      action: 'activity.materials.detail',
      entityType: 'material',
      entityId: req.params.id,
    });
    if (!owner) return;
    const data = await getMaterialDetail(owner, req.params.id, { query: parseReportQuery(req.query, 'material'), enrich: true });
    res.json({ success: true, ...data });
  } catch (err) {
    fail(res, err);
  }
};

const listAssignmentEngagement = async (req, res) => {
  try {
    const owner = await scopeFor(req, res, { action: 'activity.assignments.list', entityType: 'assignment' });
    if (!owner) return;
    const assignments = await getAssignmentSummaries(owner, { assignmentIds: parseIds(req.query.ids) });
    res.json({ success: true, assignments });
  } catch (err) {
    fail(res, err);
  }
};

const getAssignmentEngagement = async (req, res) => {
  try {
    if (!requireUuid(res, req.params.id)) return;
    const owner = await scopeFor(req, res, {
      action: 'activity.assignments.detail',
      entityType: 'assignment',
      entityId: req.params.id,
    });
    if (!owner) return;
    const data = await getAssignmentDetail(owner, req.params.id, { query: parseReportQuery(req.query, 'assignment'), enrich: true });
    res.json({ success: true, ...data });
  } catch (err) {
    fail(res, err);
  }
};

const listExamEngagement = async (req, res) => {
  try {
    const owner = await scopeFor(req, res, { action: 'activity.exams.list', entityType: 'exam' });
    if (!owner) return;
    const exams = await getExamSummaries(owner, { examIds: parseIds(req.query.ids) });
    res.json({ success: true, exams });
  } catch (err) {
    fail(res, err);
  }
};

const getExamEngagement = async (req, res) => {
  try {
    if (!requireUuid(res, req.params.id)) return;
    const owner = await scopeFor(req, res, {
      action: 'activity.exams.detail',
      entityType: 'exam',
      entityId: req.params.id,
    });
    if (!owner) return;
    const data = await getExamDetail(owner, req.params.id, { query: parseReportQuery(req.query, 'exam'), enrich: true });
    res.json({ success: true, ...data });
  } catch (err) {
    fail(res, err);
  }
};

/** Göndərmədən əvvəl: alıcı siyahısı, son 6 saatda artıq alanlar və mesaj önizləməsi. Heç nə yazmır. */
const postReminderPreview = (entityType) => async (req, res) => {
  try {
    if (!requireUuid(res, req.params.id)) return;
    const owner = await scopeFor(req, res, { action: `activity.${ENTITY_PLURAL[entityType]}.reminders.preview`, write: true });
    if (!owner) return;
    const preview = await previewReminders(owner, entityType, req.params.id, { studentIds: studentIdsFrom(req.body) });
    res.json({ success: true, ...preview });
  } catch (err) {
    fail(res, err);
  }
};

const postReminders = (entityType) => async (req, res) => {
  try {
    if (!requireUuid(res, req.params.id)) return;
    const owner = await scopeFor(req, res, { action: `activity.${ENTITY_PLURAL[entityType]}.reminders`, write: true });
    if (!owner) return;
    const result = await sendReminders(owner, entityType, req.params.id, { studentIds: studentIdsFrom(req.body) });
    res.json({ success: true, ...result });
  } catch (err) {
    fail(res, err);
  }
};

const getTimeline = (entityType) => async (req, res) => {
  try {
    if (!requireUuid(res, req.params.id) || !requireUuid(res, req.params.studentId)) return;
    const owner = await scopeFor(req, res, {
      action: `activity.${ENTITY_PLURAL[entityType]}.timeline`,
      entityType,
      entityId: req.params.id,
    });
    if (!owner) return;
    const timeline = await getStudentTimeline(owner, entityType, req.params.id, req.params.studentId);
    res.json({ success: true, ...timeline });
  } catch (err) {
    fail(res, err);
  }
};

const patchMaterialDeadline = async (req, res) => {
  try {
    if (!requireUuid(res, req.params.id)) return;
    const owner = await scopeFor(req, res, { action: 'activity.materials.deadline', write: true });
    if (!owner) return;
    const raw = req.body?.due_at;
    const dueAt = raw == null || raw === '' ? null : normalizeExamStartTime(raw);
    if (raw && !dueAt) return res.status(400).json({ success: false, message: 'Tarix düzgün deyil' });
    const row = await setMaterialDueAt(owner, req.params.id, dueAt);
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
  scopeFor,
  listMaterialEngagement,
  getMaterialEngagement,
  listAssignmentEngagement,
  getAssignmentEngagement,
  listExamEngagement,
  getExamEngagement,
  postMaterialReminders: postReminders('material'),
  postAssignmentReminders: postReminders('assignment'),
  postExamReminders: postReminders('exam'),
  postMaterialReminderPreview: postReminderPreview('material'),
  postAssignmentReminderPreview: postReminderPreview('assignment'),
  postExamReminderPreview: postReminderPreview('exam'),
  getMaterialTimeline: getTimeline('material'),
  getAssignmentTimeline: getTimeline('assignment'),
  getExamTimeline: getTimeline('exam'),
  patchMaterialDeadline,
  postMaterialEvent,
};
