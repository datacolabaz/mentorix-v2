const {
  parseRating,
  parseReviewText,
  canStudentReviewInstructor,
  upsertTeacherReview,
  getStudentReviewForInstructor,
} = require('../services/teacherReviewService');

const postTeacherReview = async (req, res) => {
  try {
    const instructorId = String(req.params.instructorId || '').trim();
    const rating = parseRating(req.body?.rating);
    const reviewText = parseReviewText(req.body?.review_text ?? req.body?.text);
    if (!instructorId) {
      return res.status(400).json({ success: false, message: 'Müəllim ID tələb olunur' });
    }
    if (rating == null) {
      return res.status(400).json({ success: false, message: 'Reytinq 1–5 arası olmalıdır' });
    }
    if (!reviewText) {
      return res.status(400).json({ success: false, message: 'Rəy ən azı 10 simvol olmalıdır' });
    }

    const review = await upsertTeacherReview({
      studentId: req.user.id,
      instructorId,
      rating,
      reviewText,
    });
    res.json({ success: true, review });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message || 'Xəta',
      code: err.code || undefined,
    });
  }
};

const getTeacherReviewEligibility = async (req, res) => {
  try {
    const instructorId = String(req.params.instructorId || '').trim();
    if (!instructorId) {
      return res.status(400).json({ success: false, message: 'Müəllim ID tələb olunur' });
    }
    const gate = await canStudentReviewInstructor(req.user.id, instructorId);
    const existing = gate.allowed
      ? await getStudentReviewForInstructor(req.user.id, instructorId)
      : null;
    res.json({
      success: true,
      can_review: gate.allowed,
      reason: gate.reason,
      my_review: existing,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = { postTeacherReview, getTeacherReviewEligibility };
