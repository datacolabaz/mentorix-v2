const { createApplication, listUserApplications } = require('../services/universityApplicationService');

const postApplication = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Giriş tələb olunur' });
    }

    const { program_id, notes, status } = req.body || {};
    const result = await createApplication(userId, { program_id, notes, status });

    return res.status(201).json({
      success: true,
      application: result.application,
      program: result.program,
      message:
        result.application.status === 'submitted'
          ? 'Müraciət qeydə alındı. Rəsmi portala yönləndirə bilərsiniz.'
          : 'Müraciət qaralama kimi saxlanıldı.',
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message });
    }
    return next(err);
  }
};

const getMyApplications = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Giriş tələb olunur' });
    }
    const applications = await listUserApplications(userId);
    return res.json({ success: true, applications });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  postApplication,
  getMyApplications,
};
