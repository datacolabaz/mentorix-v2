/**
 * «Təşkilat yarat» requests.
 *   User:            POST /, GET /mine, POST /:id/cancel
 *   Platform admin:  GET /, POST /:id/approve, POST /:id/reject
 */
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { userRateLimit } = require('../middleware/userRateLimit');
const svc = require('../services/organizationRequestService');
const { logAuthEvent } = require('../services/authEventService');

const writeLimit = userRateLimit({ name: 'organization-requests-write', windowMs: 10 * 60 * 1000, max: 20 });

function sendError(res, err, where) {
  const status = err?.statusCode || 500;
  if (status >= 500) console.error(`[organization-requests] ${where}`, err);
  res.status(status).json({
    success: false,
    code: err?.code || 'ERROR',
    message: status >= 500 ? 'Əməliyyat alınmadı. Bir az sonra yenidən cəhd edin.' : err.message,
    ...(err?.fields && status < 500 ? { fields: err.fields } : {}),
  });
}

router.post('/', authenticate, writeLimit, async (req, res) => {
  try {
    const out = await svc.createOrganizationRequest(req.user.id, req.body || {});
    if (out.created) logAuthEvent(req, { event: 'organization_request', userId: req.user.id, metadata: { source: 'workspace' } });
    res.status(out.created ? 201 : 200).json({ success: true, ...out });
  } catch (err) {
    sendError(res, err, 'create');
  }
});

router.get('/mine', authenticate, async (req, res) => {
  try {
    const [request, organizations] = await Promise.all([svc.latestRequest(req.user.id), svc.listManagedOrganizations(req.user.id)]);
    res.json({ success: true, request, organizations });
  } catch (err) {
    sendError(res, err, 'mine');
  }
});

router.post('/:id/cancel', authenticate, writeLimit, async (req, res) => {
  try {
    res.json({ success: true, ...(await svc.cancelOrganizationRequest(req.user.id, req.params.id)) });
  } catch (err) {
    sendError(res, err, 'cancel');
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const requests = await svc.listOrganizationRequests(req.user.id, { status: String(req.query.status || 'pending'), limit: req.query.limit });
    res.json({ success: true, requests });
  } catch (err) {
    sendError(res, err, 'list');
  }
});

router.post('/:id/approve', authenticate, writeLimit, async (req, res) => {
  try {
    const out = await svc.approveOrganizationRequest(req.user.id, req.params.id, { reason: req.body?.reason });
    logAuthEvent(req, {
      event: 'organization_request_approved',
      userId: req.user.id,
      metadata: { organization_request_id: req.params.id, organization_id: out.organization.id },
    });
    res.json({ success: true, ...out });
  } catch (err) {
    sendError(res, err, 'approve');
  }
});

router.post('/:id/reject', authenticate, writeLimit, async (req, res) => {
  try {
    const out = await svc.rejectOrganizationRequest(req.user.id, req.params.id, { reason: req.body?.reason });
    logAuthEvent(req, { event: 'organization_request_rejected', userId: req.user.id, metadata: { organization_request_id: req.params.id } });
    res.json({ success: true, ...out });
  } catch (err) {
    sendError(res, err, 'reject');
  }
});

module.exports = router;
