const {
  submitMentorProgram,
  listMentorSubmissions,
} = require('../services/universityProgramContributionService');

const postContribution = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Giriş tələb olunur' });

    const result = await submitMentorProgram(userId, req.body || {});
    return res.status(201).json({
      success: true,
      message: 'Proqram göndərildi — admin təsdiqindən sonra dərc olunacaq',
      program: result.program,
      university: result.university,
      mentor_display_name: result.mentor_display_name,
    });
  } catch (err) {
    const code = err.status || 500;
    return res.status(code).json({ success: false, message: err.message || 'Xəta' });
  }
};

const getMyContributions = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: 'Giriş tələb olunur' });
    const programs = await listMentorSubmissions(userId);
    return res.json({ success: true, count: programs.length, data: programs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = {
  postContribution,
  getMyContributions,
};
