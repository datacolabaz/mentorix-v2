const { getExamForStudentRequest } = require('../services/examAccessRequestService');
const { joinExamAsGuest } = require('../services/guestAccessService');

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
        certificate_pass_pct: exam.certificate_pass_pct,
      },
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

/** POST /api/public/exam-invite/:examId/join — qonaq: ad, soyad, telefon; hesab yox, avtomatik icazə */
async function postPublicExamGuestJoin(req, res) {
  try {
    const result = await joinExamAsGuest(req.params.examId, req.body || {});
    res.status(result.already_assigned ? 200 : 201).json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
}

module.exports = { getPublicExamInvite, postPublicExamGuestJoin };
