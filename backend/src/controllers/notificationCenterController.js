const { toClientSafeError } = require('../lib/clientSafeError');
const center = require('../services/notificationCenterService');
const prefsService = require('../services/notificationPreferencesService');
const { resolveNotificationLink } = require('../services/notificationLinkResolver');

function sendError(res, err, label) {
  const safe = toClientSafeError(err);
  if (safe.status >= 500) console.error(`[notifications] ${label}`, err?.code || '', err?.message || err);
  return res.status(safe.status).json({ success: false, message: safe.message, code: safe.code });
}

function truthy(v) {
  return ['1', 'true', 'yes'].includes(String(v || '').toLowerCase());
}

const listMyNotifications = async (req, res) => {
  try {
    const out = await center.listNotifications(req.user.id, {
      limit: req.query.limit,
      cursor: req.query.cursor ? String(req.query.cursor) : null,
      category: req.query.category ? String(req.query.category) : null,
      unread: truthy(req.query.unread),
    });
    res.json({ success: true, ...out });
  } catch (err) {
    sendError(res, err, 'list');
  }
};

const getMyUnreadCount = async (req, res) => {
  try {
    res.json({ success: true, unread_count: await center.countUnread(req.user.id) });
  } catch (err) {
    sendError(res, err, 'unread-count');
  }
};

const markMyNotificationRead = async (req, res) => {
  try {
    const okRead = await center.markRead(req.user.id, req.params.id);
    if (!okRead) return res.status(404).json({ success: false, message: 'Tapılmadı', code: 'NOT_FOUND' });
    res.json({ success: true });
  } catch (err) {
    sendError(res, err, 'mark-read');
  }
};

const markAllMyNotificationsRead = async (req, res) => {
  try {
    const category = req.body?.category ? String(req.body.category) : null;
    const updated = await center.markAllRead(req.user.id, { category });
    res.json({ success: true, updated });
  } catch (err) {
    sendError(res, err, 'read-all');
  }
};

/** Linki açmazdan əvvəl: sahiblik + hədəf obyektə cari icazə yenidən yoxlanılır. */
const openMyNotification = async (req, res) => {
  try {
    const row = await center.getOwnNotification(req.user.id, req.params.id);
    if (!row) return res.status(404).json({ success: false, message: 'Tapılmadı', code: 'NOT_FOUND' });
    if (!row.is_read) await center.markRead(req.user.id, row.id);
    const link = await resolveNotificationLink(row, req.user);
    res.json({ success: true, href: link.href, status: link.status });
  } catch (err) {
    sendError(res, err, 'open');
  }
};

const getMyPreferences = async (req, res) => {
  try {
    res.json({ success: true, ...(await prefsService.getPreferences(req.user)) });
  } catch (err) {
    sendError(res, err, 'preferences-get');
  }
};

const updateMyPreferences = async (req, res) => {
  try {
    const items = Array.isArray(req.body?.preferences) ? req.body.preferences : null;
    res.json({ success: true, ...(await prefsService.savePreferences(req.user, items)) });
  } catch (err) {
    sendError(res, err, 'preferences-put');
  }
};

module.exports = {
  listMyNotifications,
  getMyUnreadCount,
  markMyNotificationRead,
  markAllMyNotificationsRead,
  openMyNotification,
  getMyPreferences,
  updateMyPreferences,
};
