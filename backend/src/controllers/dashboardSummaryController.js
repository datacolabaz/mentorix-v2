const svc = require('../services/dashboardSummaryService');
const { resolveDashboardScope } = require('../services/dashboardSummaryRules');
const { UUID_RE } = require('../services/activityAccessPolicy');
const { toClientSafeError } = require('../lib/clientSafeError');

function fail(res, err, label) {
  const safe = toClientSafeError(err);
  if (safe.status >= 500) console.error('[dashboard-summary]', label, err?.message);
  res.status(safe.status).json({ success: false, code: safe.code, message: safe.message });
}

/**
 * GET /api/dashboard/summary — cari istifadəçinin rolu üzrə bir paket.
 * Sorğu parametrləri ilə başqasının məlumatı istənə bilməz: müəllim/tələbə həmişə özü, admin yalnız aqreqat.
 * Tələbə üçün ?enrollment_id= yalnız öz aktiv enrollment-i ola bilər (əks halda 404).
 */
const getSummary = async (req, res) => {
  const scope = resolveDashboardScope(req.user);
  if (!scope.ok) return res.status(scope.status).json({ success: false, code: scope.code, message: scope.message });
  try {
    res.set('Cache-Control', 'private, no-store');
    if (scope.kind === 'admin') {
      return res.json({ success: true, summary: await svc.getAdminSummary(scope.userId) });
    }
    if (scope.kind === 'teacher') {
      return res.json({ success: true, summary: await svc.getTeacherSummary(scope.userId) });
    }
    const enrollmentId = String(req.query.enrollment_id || '').trim();
    let instructorId = null;
    if (enrollmentId) {
      if (!UUID_RE.test(enrollmentId)) {
        return res.status(400).json({ success: false, code: 'INVALID_ENROLLMENT', message: 'Qrup ID düzgün deyil' });
      }
      const { resolveEnrollmentScope } = require('../services/studentEnrollmentsService');
      const en = await resolveEnrollmentScope(scope.userId, enrollmentId);
      if (!en) return res.status(404).json({ success: false, code: 'ENROLLMENT_NOT_FOUND', message: 'Qrup tapılmadı' });
      instructorId = en.instructor_id;
    }
    const summary = await svc.getStudentSummary(scope.userId, { instructorId });
    return res.json({ success: true, summary: { ...summary, enrollment_id: instructorId ? enrollmentId : null } });
  } catch (err) {
    return fail(res, err, 'summary');
  }
};

/** GET /api/dashboard/admin/operations — yalnız admin (route səviyyəsində authorize('admin')). */
const getAdminOperations = async (_req, res) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    res.json({ success: true, operations: await svc.getAdminOperations() });
  } catch (err) {
    fail(res, err, 'operations');
  }
};

module.exports = { getSummary, getAdminOperations };
