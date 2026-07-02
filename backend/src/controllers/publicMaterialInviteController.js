const {
  getMaterialForInvite,
  joinMaterialAsGuest,
} = require('../services/guestAccessService');

/** GET /api/public/material-invite/:materialId */
async function getPublicMaterialInvite(req, res) {
  try {
    const material = await getMaterialForInvite(req.params.materialId);
    if (!material) {
      return res.status(404).json({ success: false, message: 'Material tapılmadı' });
    }
    res.json({
      success: true,
      material: {
        id: material.id,
        title: material.title,
        instructor_name: material.instructor_name,
        subject_name: material.subject_name,
        group_name: material.group_name,
      },
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

/** POST /api/public/material-invite/:materialId/join */
async function postPublicMaterialGuestJoin(req, res) {
  try {
    const body = req.body || {};
    const result = await joinMaterialAsGuest(req.params.materialId, {
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




const { joinMaterialAsAuthenticatedStudent } = require('../services/guestAccessService');

async function postMaterialAccessFromLink(req, res) {
  try {
    const result = await joinMaterialAsAuthenticatedStudent(req.params.materialId, req.user.id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message, code: err.code });
  }
}

module.exports = { getPublicMaterialInvite, postPublicMaterialGuestJoin, postMaterialAccessFromLink };
