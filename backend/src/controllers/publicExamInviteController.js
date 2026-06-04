const { getExamForStudentRequest } = require('../services/examAccessRequestService');

/** GET /api/public/exam-invite/:examId — login olmadan imtahan adı (paylaşım səhifəsi) */
async function getPublicExamInvite(req, res) {
  try {
    const examId = req.params.examId;
    const exam = await getExamForStudentRequest(examId);
    if (!exam || exam.is_deleted) {
      return res.status(404).json({ success: false, message: 'İmtahan tapılmadı' });
    }
    res.json({
      success: true,
      exam: {
        id: exam.id,
        title: exam.title,
        instructor_name: exam.instructor_name,
      },
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

module.exports = { getPublicExamInvite };
