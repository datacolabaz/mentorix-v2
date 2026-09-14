const {
  listConnections,
  startOAuth,
  completeGoogleMeetOAuth,
  disconnectProvider,
} = require('../services/teacherProviderConnectionService');
const { frontendConnectRedirect } = require('../lib/googleMeetOAuth');
const registry = require('../providers/liveLesson/registry');

const listTeacherConnections = async (req, res) => {
  try {
    const connections = await listConnections(req.user.id);
    res.json({
      success: true,
      connections,
      providers: registry.listPublicProviders(),
    });
  } catch (e) {
    res.status(e.status || 500).json({ success: false, message: e.message || 'Xəta' });
  }
};

const startTeacherConnection = async (req, res) => {
  try {
    const provider = String(req.params.provider || '')
      .trim()
      .toLowerCase()
      .replace(/-/g, '_');
    const returnPath = typeof req.body?.return_path === 'string' ? req.body.return_path : req.body?.returnPath;
    const { redirectUrl } = await startOAuth(req.user.id, provider, { returnPath });
    res.json({ success: true, redirectUrl });
  } catch (e) {
    res.status(e.status || 500).json({
      success: false,
      message: e.message || 'Xəta',
      code: e.code || undefined,
    });
  }
};

const googleMeetOAuthCallback = async (req, res) => {
  try {
    if (req.query.error) {
      return res.redirect(
        frontendConnectRedirect({
          error: String(req.query.error_description || req.query.error || 'denied'),
        }),
      );
    }
    const code = req.query.code;
    const state = req.query.state;
    if (!code || !state) {
      return res.redirect(frontendConnectRedirect({ error: 'missing_code' }));
    }
    const result = await completeGoogleMeetOAuth({ code, state });
    return res.redirect(
      frontendConnectRedirect({ success: true, returnPath: result.returnPath }),
    );
  } catch (e) {
    return res.redirect(
      frontendConnectRedirect({
        error: e.code || 'oauth_failed',
      }),
    );
  }
};

const disconnectTeacherConnection = async (req, res) => {
  try {
    const provider = String(req.params.provider || '')
      .trim()
      .toLowerCase()
      .replace(/-/g, '_');
    // AuthZ: only the logged-in instructor's own connection
    await disconnectProvider(req.user.id, provider);
    res.json({ success: true, disconnected: true, provider });
  } catch (e) {
    res.status(e.status || 500).json({
      success: false,
      message: e.message || 'Xəta',
      code: e.code || undefined,
    });
  }
};

module.exports = {
  listTeacherConnections,
  startTeacherConnection,
  googleMeetOAuthCallback,
  disconnectTeacherConnection,
};
