const svc = require('../services/groupInviteService');

function sendError(res, err, where) {
  const status = err?.statusCode || 500;
  if (status >= 500) console.error(`[group-invites] ${where}`, err);
  res.status(status).json({
    success: false,
    code: err?.code || 'ERROR',
    message: status >= 500 ? 'Əməliyyat alınmadı. Bir az sonra yenidən cəhd edin.' : err.message,
    ...(err?.details && status < 500 ? { fields: err.details } : {}),
  });
}

const listGroupInvites = async (req, res) => {
  try {
    const invites = await svc.listInvites(req.user.id, { groupId: req.query.group_id || null });
    res.json({ success: true, invites });
  } catch (err) {
    sendError(res, err, 'list');
  }
};

const createGroupInvite = async (req, res) => {
  try {
    const invite = await svc.createInvite(req.user.id, req.params.groupId, req.body || {});
    res.status(201).json({ success: true, invite });
  } catch (err) {
    sendError(res, err, 'create');
  }
};

const revokeGroupInvite = async (req, res) => {
  try {
    const invite = await svc.revokeInvite(req.user.id, req.params.id);
    res.json({ success: true, invite });
  } catch (err) {
    sendError(res, err, 'revoke');
  }
};

const listGroupInviteRedemptions = async (req, res) => {
  try {
    res.json({ success: true, ...(await svc.listRedemptions(req.user.id, req.params.id)) });
  } catch (err) {
    sendError(res, err, 'redemptions');
  }
};

module.exports = { listGroupInvites, createGroupInvite, revokeGroupInvite, listGroupInviteRedemptions };
