const {
  openRoomForUser,
  listRoomMessages,
  sendRoomMessage,
  getChatCapabilities,
  getRoomById,
  assertRoomAccess,
} = require('../services/chatService');
const { subscribeRoom, unsubscribeRoom } = require('../services/chatRealtimeHub');

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

async function streamRoom(req, res) {
  let listener = null;
  let ping = null;
  try {
    const room = await getRoomById(req.params.roomId);
    await assertRoomAccess(req.user.id, req.user.role, room);

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    res.write(`data: ${JSON.stringify({ type: 'connected', room_id: room.id })}\n\n`);

    listener = (message) => {
      try {
        res.write(`data: ${JSON.stringify({ type: 'message', message })}\n\n`);
      } catch {
        /* client disconnected */
      }
    };
    subscribeRoom(room.id, listener);

    ping = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        if (ping) clearInterval(ping);
      }
    }, 20000);

    req.on('close', () => {
      if (ping) clearInterval(ping);
      if (listener) unsubscribeRoom(room.id, listener);
    });
  } catch (err) {
    if (!res.headersSent) {
      res.status(err.statusCode || err.status || 500).json({
        success: false,
        message: err.message,
        code: err.code || 'CHAT_ERROR',
      });
    } else {
      res.end();
    }
  }
}

module.exports = {
  postOpenRoom,
  getMessages,
  postMessage,
  getCapabilities,
  streamRoom,
};
