const {
  getPublicJoinInfo,
  createJoinRequest,
  listPendingJoinRequests,
  countPendingJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
} = require('../services/joinInvitationService');

const getPublicJoin = async (req, res) => {
  try {
    const code = req.params.code;
    const info = await getPublicJoinInfo(code);
    res.json({ success: true, ...info });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
};

const listJoinRequests = async (req, res) => {
  try {
    const requests = await listPendingJoinRequests(req.user.id);
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const joinRequestsCount = async (req, res) => {
  try {
    const count = await countPendingJoinRequests(req.user.id);
    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const approveRequest = async (req, res) => {
  try {
    const result = await approveJoinRequest(req.params.id, req.user.id);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

const rejectRequest = async (req, res) => {
  try {
    const result = await rejectJoinRequest(
      req.params.id,
      req.user.id,
      req.body?.reason,
    );
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

const submitJoinWithProfile = async (req, res) => {
  try {
    const {
      code,
      first_name,
      last_name,
      phone_number,
      parent_name,
      parent_phone,
    } = req.body || {};
    const result = await createJoinRequest({
      studentId: req.user.id,
      code,
      first_name,
      last_name,
      phone_number,
      parent_name,
      parent_phone,
    });
    res.status(201).json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
};

module.exports = {
  getPublicJoin,
  listJoinRequests,
  joinRequestsCount,
  approveRequest,
  rejectRequest,
  submitJoinWithProfile,
};
