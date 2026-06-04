const {
  getInstructorDiscoverProfile,
  upsertInstructorDiscoverProfile,
} = require('../services/discoverMarketplaceService');

const getDiscoverProfile = async (req, res) => {
  try {
    const data = await getInstructorDiscoverProfile(req.user.id);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const patchDiscoverProfile = async (req, res) => {
  try {
    const data = await upsertInstructorDiscoverProfile(req.user.id, req.body || {});
    res.json({ success: true, ...data });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = { getDiscoverProfile, patchDiscoverProfile };
