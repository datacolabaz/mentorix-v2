const {
  openRoomForUser,
  listRoomMessages,
  sendRoomMessage,
  getChatCapabilities,
} = require('../services/chatService');

async function postOpenRoom(req, res) {
  try {
    const { kind, group_id, assignment_id, student_id, student_name } = req.body || {};
    const room = await openRoomForUser({
      userId: req.user.id,
      role: req.user.role,
      kind,
      groupId: group_id,
      assignmentId: assignment_id,
      studentId: student_id,
      studentName: student_name,
    });
    res.json({ success: true, room });
  } catch (err) {
    res.status(err.statusCode || err.status || 500).json({
      success: false,
      message: err.message,
      code: err.code || 'CHAT_ERROR',
    });
  }
}

async function getMessages(req, res) {
  try {
    const messages = await listRoomMessages({
      roomId: req.params.roomId,
      userId: req.user.id,
      role: req.user.role,
      before: req.query.before || null,
      limitRaw: req.query.limit,
    });
    res.json({ success: true, messages });
  } catch (err) {
    res.status(err.statusCode || err.status || 500).json({
      success: false,
      message: err.message,
      code: err.code || 'CHAT_ERROR',
    });
  }
}

async function postMessage(req, res) {
  try {
    const message = await sendRoomMessage({
      roomId: req.params.roomId,
      userId: req.user.id,
      role: req.user.role,
      bodyRaw: req.body?.body,
    });
    res.json({ success: true, message });
  } catch (err) {
    res.status(err.statusCode || err.status || 500).json({
      success: false,
      message: err.message,
      code: err.code || 'CHAT_ERROR',
    });
  }
}

async function getCapabilities(req, res) {
  try {
    const capabilities = await getChatCapabilities(req.user.id);
    res.json({ success: true, capabilities });
  } catch (err) {
    res.status(err.statusCode || err.status || 500).json({
      success: false,
      message: err.message,
      code: err.code || 'CHAT_ERROR',
    });
  }
}

module.exports = {
  postOpenRoom,
  getMessages,
  postMessage,
  getCapabilities,
};
