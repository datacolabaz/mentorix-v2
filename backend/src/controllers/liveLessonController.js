const { createLiveLesson } = require('../services/liveLessonOrchestrationService');
const { getLiveRoomForUser, jitsiRoomName, getInstructorLiveParticipantLimit } = require('../services/liveRoomService');
const { checkSmsQuota } = require('../services/smsQuotaService');
const registry = require('../providers/liveLesson/registry');

async function mapRoom(row, user) {
  if (!row) return null;
  const isInstructor = user?.role === 'instructor' && String(row.instructor_id) === String(user.id);
  const provider = row.provider || 'mentorix_live';
  const isMentorixLive = provider === 'mentorix_live';
  const maxParticipants =
    isMentorixLive && row.instructor_id
      ? await getInstructorLiveParticipantLimit(row.instructor_id)
      : null;
  return {
    id: row.id,
    room_code: row.room_code,
    title: row.title,
    status: row.status,
    group_id: row.group_id,
    group_name: row.group_name || null,
    instructor_name: row.instructor_name || null,
    participant_count: row.participant_count,
    max_participants: maxParticipants,
    started_at: row.started_at,
    scheduled_at: row.scheduled_at || null,
    ended_at: row.ended_at,
    jitsi_room: isMentorixLive ? jitsiRoomName(row.room_code) : null,
    is_instructor: isInstructor,
    provider,
    join_url: row.join_url || null,
    ...(isInstructor
      ? { start_url: row.start_url || row.join_url || null, passcode: row.passcode || null }
      : {}),
  };
}

const listProviders = async (_req, res) => {
  res.json({ success: true, providers: registry.listPublicProviders() });
};

const postCreateLiveLesson = async (req, res) => {
  try {
    const notifySms = Boolean(req.body?.notify_sms ?? req.body?.notifySms);
    const notifyEmail = Boolean(req.body?.notify_email ?? req.body?.notifyEmail);

    if (notifySms) {
      const quota = await checkSmsQuota(req.user.id);
      if (!quota.ok) {
        return res.status(quota.statusCode || 429).json(quota.body);
      }
    }

    const { room, notifications, provider } = await createLiveLesson(req.user.id, {
      provider: req.body?.provider || 'mentorix_live',
      groupId: req.body?.group_id || req.body?.groupId || null,
      title: req.body?.title || null,
      notifySms,
      notifyEmail,
      scheduledAt: req.body?.scheduled_at || req.body?.scheduledAt || null,
      durationMinutes: req.body?.duration_minutes || req.body?.durationMinutes || 60,
    });
    const full = await getLiveRoomForUser(room.room_code, req.user).catch(() => room);
    res.status(201).json({
      success: true,
      provider,
      room: await mapRoom(full, req.user),
      notifications: notifications || { sms: 0, email: 0 },
    });
  } catch (e) {
    res.status(e.status || 500).json({
      success: false,
      message: e.message || 'Xəta',
      code: e.code || undefined,
      provider: e.provider || undefined,
    });
  }
};

module.exports = {
  listProviders,
  postCreateLiveLesson,
};
