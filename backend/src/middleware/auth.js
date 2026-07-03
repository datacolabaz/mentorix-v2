const { verify } = require('../utils/jwt');
const {
  fetchUserAuthState,
  respondEmailNotVerified,
  isUserEmailVerified,
} = require('../services/emailVerificationGuard');
const { touchUserActivity } = require('../services/userPresenceService');

const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token yoxdur' });
  }
  try {
    const payload = verify(token);
    const row = await fetchUserAuthState(payload.id);
    if (!row || row.is_active === false) {
      return res.status(401).json({ success: false, message: 'Token etibarsızdır' });
    }
    if (!isUserEmailVerified(row)) {
      return respondEmailNotVerified(res);
    }
    const effectiveRole = row?.role_selected === false ? null : row.role;
    req.user = { ...payload, id: row.id, role: effectiveRole };
    touchUserActivity(payload.id).catch(() => {});
    next();
  } catch {
    res.status(401).json({ success: false, message: 'Token etibarsızdır' });
  }
};

const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
  }
  next();
};

/** EventSource cannot send Authorization header — allow ?access_token= for SSE only. */
const authenticateSse = async (req, res, next) => {
  if (!req.headers.authorization?.split(' ')[1] && req.query?.access_token) {
    req.headers.authorization = `Bearer ${String(req.query.access_token).trim()}`;
  }
  return authenticate(req, res, next);
};

/** File/img src cannot send Authorization — allow ?token= for authenticated downloads. */
const authenticateWithQueryToken = async (req, res, next) => {
  if (!req.headers.authorization?.split(' ')[1] && req.query?.token) {
    req.headers.authorization = `Bearer ${String(req.query.token).trim()}`;
  }
  return authenticate(req, res, next);
};

const optionalAuthenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return next();
  try {
    const payload = verify(token);
    const row = await fetchUserAuthState(payload.id);
    if (row && row.is_active !== false && isUserEmailVerified(row)) {
      const effectiveRole = row?.role_selected === false ? null : row.role;
      req.user = { ...payload, id: row.id, role: effectiveRole };
    }
  } catch {
    /* ignore invalid token for public routes */
  }
  next();
};

module.exports = { authenticate, authenticateSse, authenticateWithQueryToken, authorize, optionalAuthenticate };
