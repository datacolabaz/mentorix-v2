const { getTaskForStudentRequest } = require('../services/taskAccessRequestService');
const { joinTaskAsGuest } = require('../services/guestAccessService');

/** GET /api/public/task-invite/:taskId */
async function getPublicTaskInvite(req, res) {
  try {
    const task = await getTaskForStudentRequest(req.params.taskId);
    if (!task) {
      return res.status(404).json({ success: false, message: 'Tapşırıq tapılmadı' });
    }
    res.json({
      success: true,
      task: {
        id: task.id,
        title: task.title,
        instructor_name: task.instructor_name,
      },
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

/** POST /api/public/task-invite/:taskId/join — qonaq: ad, soyad, telefon */
async function postPublicTaskGuestJoin(req, res) {
  try {
    const result = await joinTaskAsGuest(req.params.taskId, req.body || {});
    res.status(result.already_assigned ? 200 : 201).json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
}

module.exports = { getPublicTaskInvite, postPublicTaskGuestJoin };
