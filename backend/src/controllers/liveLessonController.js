const registry = require('../providers/liveLesson/registry');
const lessons = require('../services/liveLessonService');
const { maskUrlsInText } = require('../lib/meetingUrl');

function sendError(res, e, where) {
  if (e instanceof lessons.LessonError || (e?.status && e.status < 500)) {
    return res.status(e.status || 400).json({
      success: false,
      message: e.message,
      code: e.code || undefined,
      fields: e.fields || undefined,
      details: e.details || undefined,
      provider: e.provider || undefined,
    });
  }
  console.error(`[live-lessons] ${where}`, maskUrlsInText(e?.message || e));
  return res.status(500).json({ success: false, message: 'Server xətası. Bir az sonra yenidən cəhd edin.' });
}

/** Optional Meet/Zoom account connections (OAuth). Manual links never need them. */
const listProviders = async (_req, res) => {
  res.json({ success: true, providers: registry.listPublicProviders() });
};

const listLessons = async (req, res) => {
  try {
    const scope = ['upcoming', 'past', 'all'].includes(req.query.scope) ? req.query.scope : 'upcoming';
    const list = await lessons.listLessonsForUser(req.user, { scope, limit: req.query.limit });
    res.json({ success: true, lessons: list });
  } catch (e) {
    sendError(res, e, 'list');
  }
};

const getLesson = async (req, res) => {
  try {
    const lesson = await lessons.getLessonForUser(req.user, { id: req.params.id });
    res.json({ success: true, lesson });
  } catch (e) {
    sendError(res, e, 'get');
  }
};

const getLessonByCode = async (req, res) => {
  try {
    const lesson = await lessons.getLessonForUser(req.user, { roomCode: req.params.roomCode });
    res.json({ success: true, lesson });
  } catch (e) {
    sendError(res, e, 'get-by-code');
  }
};

function oauthMeetingFactory(instructorId, platform) {
  return async ({ title, scheduledAt, durationMinutes }) => {
    const provider = registry.get(platform);
    if (!(await provider.isConnected(instructorId))) {
      const err = new lessons.LessonError('Əvvəlcə hesabı bağlayın və ya görüş linkini əl ilə daxil edin.', 409, 'NEEDS_CONNECTION');
      err.provider = provider.id;
      throw err;
    }
    return provider.createMeeting(instructorId, { title, scheduledAt, durationMinutes, metadata: {} });
  };
}

const postCreateLesson = async (req, res) => {
  try {
    const body = req.body || {};
    const viaOauth = body.create_via === 'oauth';
    const out = await lessons.createLessons(req.user.id, body, {
      createMeeting: viaOauth ? oauthMeetingFactory(req.user.id, body.platform) : null,
    });
    res.status(201).json({ success: true, ...out });
  } catch (e) {
    sendError(res, e, 'create');
  }
};

const patchLesson = async (req, res) => {
  try {
    const scope = req.body?.scope === 'following' ? 'following' : 'single';
    const out = await lessons.updateLesson(req.user.id, req.params.id, req.body || {}, { scope });
    res.json({ success: true, ...out });
  } catch (e) {
    sendError(res, e, 'update');
  }
};

const postCancelLesson = async (req, res) => {
  try {
    const scope = req.body?.scope === 'following' ? 'following' : 'single';
    const out = await lessons.cancelLesson(req.user.id, req.params.id, { reason: req.body?.reason, scope });
    res.json({ success: true, ...out });
  } catch (e) {
    sendError(res, e, 'cancel');
  }
};

const getAttendance = async (req, res) => {
  try {
    res.json({ success: true, attendance: await lessons.getAttendance(req.user.id, req.params.id) });
  } catch (e) {
    sendError(res, e, 'attendance-get');
  }
};

const putAttendance = async (req, res) => {
  try {
    const attendance = await lessons.setAttendance(req.user.id, req.params.id, req.body?.records);
    res.json({ success: true, attendance });
  } catch (e) {
    sendError(res, e, 'attendance-put');
  }
};

const getCalendarFile = async (req, res) => {
  try {
    const { filename, body } = await lessons.getLessonIcs(req.user, req.params.id);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(body);
  } catch (e) {
    sendError(res, e, 'ics');
  }
};

module.exports = {
  listProviders,
  listLessons,
  getLesson,
  getLessonByCode,
  postCreateLesson,
  patchLesson,
  postCancelLesson,
  getAttendance,
  putAttendance,
  getCalendarFile,
};
