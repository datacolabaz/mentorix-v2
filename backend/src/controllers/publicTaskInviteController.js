const { getTaskForStudentRequest } = require('../services/taskAccessRequestService');

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

module.exports = { getPublicTaskInvite };
