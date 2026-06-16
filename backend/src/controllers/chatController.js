const {
  openRoomForUser,
  listRoomMessages,
  sendRoomMessage,
  getChatCapabilities,
  getRoomById,
  assertRoomAccess,
  listGroupChatsForUser,
  touchUserActivity,
} = require('../services/chatService');
const { subscribeRoom, unsubscribeRoom } = require('../services/chatRealtimeHub');
const { publicChatAttachmentPath } = require('../services/chatAttachmentStorage');

async function getGroups(req, res) {
  try {
    void touchUserActivity(req.user.id);
    const groups = await listGroupChatsForUser(req.user.id, req.user.role);
    res.json({ success: true, groups });
  } catch (err) {
    res.status(err.statusCode || err.status || 500).json({
      success: false,
      message: err.message,
      code: err.code || 'CHAT_ERROR',
    });
  }
}

async function postOpenRoom(req, res) {
  try {
    void touchUserActivity(req.user.id);
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
    void touchUserActivity(req.user.id);
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
    void touchUserActivity(req.user.id);
    const message = await sendRoomMessage({
      roomId: req.params.roomId,
      userId: req.user.id,
      role: req.user.role,
      bodyRaw: req.body?.body,
      attachmentUrl: req.body?.attachment_url,
      attachmentType: req.body?.attachment_type,
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

async function postAttachment(req, res) {
  try {
    void touchUserActivity(req.user.id);
    const room = await getRoomById(req.params.roomId);
    await assertRoomAccess(req.user.id, req.user.role, room);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Fayl seçilməyib',
        code: 'CHAT_FILE_REQUIRED',
      });
    }

    const url = publicChatAttachmentPath(req.file.filename);
    const attachment_type = String(req.file.mimetype || '').toLowerCase();
    res.json({
      success: true,
      url,
      attachment_type,
      filename: req.file.originalname || req.file.filename,
    });
  } catch (err) {
    const status = err.statusCode || err.status || 500;
    res.status(status).json({
      success: false,
      message: err.message || 'Fayl yüklənmədi',
      code: err.code || 'CHAT_UPLOAD_ERROR',
    });
  }
}

async function streamRoom(req, res) {
  let listener = null;
  let ping = null;
  try {
    void touchUserActivity(req.user.id);
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
  getGroups,
  postOpenRoom,
  getMessages,
  postMessage,
  postAttachment,
  getCapabilities,
  streamRoom,
};
