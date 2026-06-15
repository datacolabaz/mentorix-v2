const {
  getPublicPlatformContact,
  adminGetPlatformContact,
  adminUpdatePlatformContact,
} = require('../services/platformContactService');

const getPublicContact = async (_req, res) => {
  try {
    const contact = await getPublicPlatformContact();
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const getAdminPlatformContact = async (_req, res) => {
  try {
    const contact = await adminGetPlatformContact();
    res.json({ success: true, contact });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Xəta' });
  }
};

const putAdminPlatformContact = async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const contact = await adminUpdatePlatformContact(body);
    res.json({ success: true, contact });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message || 'Xəta' });
  }
};

module.exports = {
  getPublicContact,
  getAdminPlatformContact,
  putAdminPlatformContact,
};
