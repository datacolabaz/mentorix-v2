const { verify } = require('../utils/jwt');
const { recordAccessEvent, getAdminTrafficStats, ALLOWED_EVENTS } = require('../services/accessEventService');
const { getAdminAnalyticsDashboard } = require('../services/adminAnalyticsService');

/** Token varsa user_id götürür; yoxdursa anon event (landing) */
async function optionalUserFromToken(req) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return null;
  try {
    const payload = verify(token);
    return payload?.id ? { id: payload.id, role: payload.role || null } : null;
  } catch {
    return null;
  }
}

const postAccessEvent = async (req, res) => {
  try {
    const eventType = String(req.body?.event_type || '').trim().toLowerCase();
    if (!ALLOWED_EVENTS.has(eventType)) {
      return res.status(400).json({ success: false, message: 'Etibarsız event_type' });
    }

    const tokenUser = await optionalUserFromToken(req);
    if (tokenUser) req.user = tokenUser;

    if (eventType === 'logout' && !req.user?.id) {
      return res.status(400).json({ success: false, message: 'Çıxış üçün token lazımdır' });
    }

    await recordAccessEvent(req, {
      event_type: eventType,
      device_type: req.body?.device_type,
      path: req.body?.path,
      session_key: req.body?.session_key,
      role: req.body?.role || req.user?.role,
      user_id: req.user?.id,
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const getAdminTraffic = async (req, res) => {
  try {
    const stats = await getAdminTrafficStats(req.query?.days);
    res.json({ success: true, traffic: stats });
  } catch (err) {
    if (err?.code === '42P01') {
      return res.json({ success: true, traffic: null, needs_migration: true });
    }
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const getAdminAnalytics = async (req, res) => {
  try {
    const data = await getAdminAnalyticsDashboard(req.query?.period);
    res.json({ success: true, analytics: data });
  } catch (err) {
    if (err?.code === '42P01') {
      return res.json({ success: true, analytics: null, needs_migration: true });
    }
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = { postAccessEvent, getAdminTraffic, getAdminAnalytics };
