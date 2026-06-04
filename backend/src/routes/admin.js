const router = require('express').Router();
const {
  getInstructors,
  patchInstructorProfile,
  updateInstructorLimits,
  getDashboardStats,
  toggleInstructor,
  updateInstructorPlan,
  getStudents,
  getStudentById,
  toggleStudent,
  deleteStudent,
  getClasses,
} = require('../controllers/adminController');
const {
  getAdminLoginMarketing,
  putAdminLoginMarketing,
} = require('../controllers/siteMarketingController');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../utils/db');
const { grantCourseRoleToUser } = require('../services/userRolesService');
const { adminListPlans, adminUpsertPlan } = require('../services/subscriptionPlansService');
const { fulfillBillingPayment, rejectBillingPayment } = require('../services/billingActivationService');
const { adminGetBillingSettings, adminUpdateBillingSettings } = require('../services/billingSettingsService');
const {
  getAdminBillingInventory,
  syncOperatorInventoryFromLive,
} = require('../services/adminBillingInventoryService');
const { getAdminTraffic, getAdminAnalytics } = require('../controllers/accessAnalyticsController');

router.get('/stats', authenticate, authorize('admin'), getDashboardStats);
router.get('/analytics/traffic', authenticate, authorize('admin'), getAdminTraffic);
router.get('/analytics/dashboard', authenticate, authorize('admin'), getAdminAnalytics);
router.get('/students', authenticate, authorize('admin'), getStudents);
router.get('/students/:id', authenticate, authorize('admin'), getStudentById);
router.patch('/students/:id/toggle', authenticate, authorize('admin'), toggleStudent);
router.delete('/students/:id', authenticate, authorize('admin'), deleteStudent);
router.get('/classes', authenticate, authorize('admin'), getClasses);
router.get('/marketing/login', authenticate, authorize('admin'), getAdminLoginMarketing);
router.put('/marketing/login', authenticate, authorize('admin'), putAdminLoginMarketing);
router.get('/instructors', authenticate, authorize('admin'), getInstructors);
router.patch('/instructors/:id/limits', authenticate, authorize('admin'), updateInstructorLimits);
router.patch('/instructors/:id/plan', authenticate, authorize('admin'), updateInstructorPlan);
router.patch('/instructors/:id/toggle', authenticate, authorize('admin'), toggleInstructor);

/** Müəllim hesabına əlavə olaraq Kurs paneli rolu verir (vahid telefon, çoxlu rol). */
router.post('/instructors/:id/grant-course', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, full_name, role FROM users WHERE id = $1 AND is_active = TRUE`,
      [req.params.id],
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'İstifadəçi tapılmadı' });
    }
    const courseName = req.body?.course_name || rows[0].full_name;
    await grantCourseRoleToUser(req.params.id, courseName);
    res.json({ success: true, message: 'Kurs rolu aktiv edildi — eyni nömrə ilə Kurs girişi mümkündür' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.patch('/instructors/:id/profile', authenticate, authorize('admin'), patchInstructorProfile);


router.delete('/instructors/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const db = require('../utils/db');
    const id = req.params.id;
    await db.query('DELETE FROM attendance WHERE enrollment_id IN (SELECT id FROM enrollments WHERE instructor_id = $1)', [id]);
    await db.query('DELETE FROM exam_assignments WHERE exam_id IN (SELECT id FROM exams WHERE instructor_id = $1)', [id]);
    await db.query('DELETE FROM exam_results WHERE exam_id IN (SELECT id FROM exams WHERE instructor_id = $1)', [id]);
    await db.query('DELETE FROM exam_questions WHERE exam_id IN (SELECT id FROM exams WHERE instructor_id = $1)', [id]);
    await db.query('DELETE FROM exams WHERE instructor_id = $1', [id]);
    await db.query('DELETE FROM enrollments WHERE instructor_id = $1', [id]);
    await db.query('DELETE FROM instructor_profiles WHERE user_id = $1', [id]);
    await db.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.get('/billing/payments', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { status, limit, payment_method, product_type } = req.query || {};
    const lim = Math.min(200, Math.max(1, parseInt(String(limit || '50'), 10) || 50));
    const parts = [];
    const params = [];
    if (status) {
      params.push(String(status).trim().toLowerCase());
      parts.push(`bp.status = $${params.length}`);
    }
    if (payment_method) {
      params.push(String(payment_method).trim().toLowerCase());
      parts.push(`bp.payment_method = $${params.length}`);
    }
    if (product_type) {
      params.push(String(product_type).trim().toLowerCase());
      parts.push(`bp.product_type = $${params.length}`);
    }
    params.push(lim);
    const where = parts.length ? `WHERE ${parts.join(' AND ')}` : '';
    const sql = `
      SELECT
        bp.id,
        bp.user_id,
        u.full_name,
        u.email,
        u.phone,
        bp.plan,
        bp.amount_cents,
        bp.currency,
        bp.status,
        bp.payment_method,
        bp.product_type,
        bp.sms_quantity,
        bp.storage_mb,
        bp.provider,
        bp.billing_interval,
        bp.external_order_id,
        bp.admin_note,
        bp.created_at,
        bp.paid_at,
        bp.reviewed_at
      FROM billing_payments bp
      LEFT JOIN users u ON u.id = bp.user_id
      ${where}
      ORDER BY bp.created_at DESC
      LIMIT $${params.length}`;
    const { rows } = await db.query(sql, params);
    res.json({ success: true, payments: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/billing/payments/:id/approve', authenticate, authorize('admin'), async (req, res) => {
  try {
    const out = await fulfillBillingPayment(req.params.id, { reviewedBy: req.user.id });
    res.json({ success: true, ...out });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

router.post('/billing/payments/:id/reject', authenticate, authorize('admin'), async (req, res) => {
  try {
    const out = await rejectBillingPayment(req.params.id, {
      reviewedBy: req.user.id,
      adminNote: req.body?.admin_note ?? req.body?.note,
    });
    res.json({ success: true, ...out });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

router.get('/billing/inventory', authenticate, authorize('admin'), async (_req, res) => {
  try {
    const inventory = await getAdminBillingInventory();
    res.json({ success: true, inventory });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/billing/inventory/sync', authenticate, authorize('admin'), async (_req, res) => {
  try {
    const inventory = await getAdminBillingInventory();
    await syncOperatorInventoryFromLive(inventory.operator, inventory.usage);
    const refreshed = await getAdminBillingInventory();
    res.json({ success: true, inventory: refreshed });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

router.get('/billing/settings', authenticate, authorize('admin'), async (_req, res) => {
  try {
    const settings = await adminGetBillingSettings();
    res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/billing/settings', authenticate, authorize('admin'), async (req, res) => {
  try {
    const settings = await adminUpdateBillingSettings(req.body || {});
    res.json({ success: true, settings });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

router.get('/plans', authenticate, authorize('admin'), async (_req, res) => {
  try {
    const plans = await adminListPlans();
    res.json({ success: true, plans });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.put('/plans', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { plans } = req.body || {};
    if (!Array.isArray(plans) || plans.length === 0) {
      return res.status(400).json({ success: false, message: 'plans array tələb olunur' });
    }
    for (const p of plans) {
      await adminUpsertPlan(p);
    }
    const out = await adminListPlans();
    res.json({ success: true, plans: out });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
});

module.exports = router;
