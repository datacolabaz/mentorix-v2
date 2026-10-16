/**
 * Teacher permission requests.
 *   Requester:  GET /mine, POST /, POST /:id/cancel
 *   Reviewer:   GET /, POST /:id/approve, POST /:id/reject
 *               (platform admin: all requests; organization owner/org_admin: requests for their organization)
 */
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { userRateLimit } = require('../middleware/userRateLimit');
const svc = require('../services/roleAccessService');
const { logAuthEvent } = require('../services/authEventService');

const writeLimit = userRateLimit({ name: 'role-requests-write', windowMs: 10 * 60 * 1000, max: 20 });

function sendError(res, err, where) {
  const status = err?.statusCode || 500;
  if (status >= 500) console.error(`[role-requests] ${where}`, err);
  res.status(status).json({
    success: false,
    code: err?.code || 'ERROR',
    message: status >= 500 ? 'Əməliyyat alınmadı. Bir az sonra yenidən cəhd edin.' : err.message,
  });
}

router.get('/mine', authenticate, async (req, res) => {
  try {
    const [requests, summary] = await Promise.all([svc.listMyRoleRequests(req.user.id), svc.getAccessSummary(req.user.id)]);
    res.json({ success: true, requests, ...summary });
  } catch (err) {
    sendError(res, err, 'mine');
  }
});

router.post('/', authenticate, writeLimit, async (req, res) => {
  try {
    const role = String(req.body?.role || 'teacher').trim().toLowerCase();
    if (role !== 'teacher') {
      return res.status(400).json({ success: false, code: 'UNSUPPORTED_ROLE', message: 'Yalnız müəllim icazəsi istənilə bilər.' });
    }
    const out = await svc.requestTeacherRole(req.user.id, {
      note: req.body?.note,
      organizationId: req.body?.organization_id || null,
      source: req.body?.organization_id ? 'organization' : 'settings',
    });
    if (out.created) logAuthEvent(req, { event: 'role_request', userId: req.user.id, metadata: { role } });
    res.status(out.created ? 201 : 200).json({ success: true, ...out });
  } catch (err) {
    sendError(res, err, 'create');
  }
});

router.post('/:id/cancel', authenticate, writeLimit, async (req, res) => {
  try {
    res.json({ success: true, ...(await svc.cancelMyRoleRequest(req.user.id, req.params.id)) });
  } catch (err) {
    sendError(res, err, 'cancel');
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const out = await svc.listRoleRequestsForReviewer(req.user.id, {
      status: String(req.query.status || 'pending'),
      limit: req.query.limit,
    });
    res.json({ success: true, ...out });
  } catch (err) {
    sendError(res, err, 'list');
  }
});

router.post('/:id/approve', authenticate, writeLimit, async (req, res) => {
  try {
    const out = await svc.approveRoleRequest(req.user.id, req.params.id, { reason: req.body?.reason });
    logAuthEvent(req, {
      event: 'role_request_approved',
      userId: req.user.id,
      metadata: { role_request_id: req.params.id, target_user_id: out.request.user_id },
    });
    res.json({ success: true, ...out });
  } catch (err) {
    sendError(res, err, 'approve');
  }
});

router.post('/:id/reject', authenticate, writeLimit, async (req, res) => {
  try {
    const out = await svc.rejectRoleRequest(req.user.id, req.params.id, { reason: req.body?.reason });
    logAuthEvent(req, {
      event: 'role_request_rejected',
      userId: req.user.id,
      metadata: { role_request_id: req.params.id, target_user_id: out.request.user_id },
    });
    res.json({ success: true, ...out });
  } catch (err) {
    sendError(res, err, 'reject');
  }
});

module.exports = router;
