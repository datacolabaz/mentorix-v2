const {
  getGroupForMaterialsInvite,
  joinGroupMaterialsAsGuest,
} = require('../services/guestAccessService');

/** GET /api/public/library-invite/:groupId */
async function getPublicLibraryInvite(req, res) {
  try {
    const group = await getGroupForMaterialsInvite(req.params.groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Qrup tapılmadı' });
    }
    res.json({
      success: true,
      group: {
        id: group.id,
        name: group.name,
        subject_name: group.subject_name,
        instructor_name: group.instructor_name,
      },
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

/** POST /api/public/library-invite/:groupId/join */
async function postPublicLibraryGuestJoin(req, res) {
  try {
    const body = req.body || {};
    const result = await joinGroupMaterialsAsGuest(req.params.groupId, {
      first_name: body.first_name,
      last_name: body.last_name,
      phone: body.phone,
      email: body.email,
    });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
}

module.exports = { getPublicLibraryInvite, postPublicLibraryGuestJoin };
