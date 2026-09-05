const db = require('../utils/db');
const { publicLiveChatAttachmentPath } = require('./liveChatAttachmentStorage');

function mapMessage(row) {
  const file = row.filename
    ? {
        url: publicLiveChatAttachmentPath(row.filename),
        name: row.original_name,
        type: row.content_type,
        size: Number(row.byte_size) || 0,
      }
    : null;
  return {
    id: row.id,
    text: row.body || '',
    file,
    sender_name: row.sender_name,
    user_id: row.uploaded_by_user_id || null,
    guest_participant_id: row.guest_participant_id || null,
    created_at: row.created_at,
  };
}

async function insertLiveChatMessage({
  roomId,
  body = '',
  senderName,
  userId = null,
  guestParticipantId = null,
  attachmentUrl = null,
}) {
  let attachmentId = null;
  const url = String(attachmentUrl || '').trim();
  if (url) {
    const filename = url.split('/').pop();
    const { rows } = await db.query(
      `SELECT id FROM live_chat_attachments WHERE room_id = $1 AND filename = $2 LIMIT 1`,
      [roomId, filename],
    );
    attachmentId = rows[0]?.id || null;
  }
  const { rows } = await db.query(
    `INSERT INTO live_chat_messages
       (room_id, body, sender_name, uploaded_by_user_id, guest_participant_id, attachment_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, created_at`,
    [roomId, String(body || '').slice(0, 240), String(senderName || 'İştirakçı').slice(0, 255), userId, guestParticipantId, attachmentId],
  );
  return rows[0];
}

async function listLiveChatHistory(roomId) {
  const { rows: messages } = await db.query(
    `SELECT m.id, m.body, m.sender_name, m.uploaded_by_user_id, m.guest_participant_id, m.created_at,
            a.filename, a.original_name, a.content_type, a.byte_size
     FROM live_chat_messages m
     LEFT JOIN live_chat_attachments a ON a.id = m.attachment_id
     WHERE m.room_id = $1
     ORDER BY m.created_at ASC
     LIMIT 200`,
    [roomId],
  );

  const { rows: orphans } = await db.query(
    `SELECT a.id, ''::varchar AS body,
            COALESCE(u.full_name, g.full_name, 'İştirakçı') AS sender_name,
            a.uploaded_by_user_id, a.guest_participant_id, a.created_at,
            a.filename, a.original_name, a.content_type, a.byte_size
     FROM live_chat_attachments a
     LEFT JOIN live_chat_messages m ON m.attachment_id = a.id
     LEFT JOIN users u ON u.id = a.uploaded_by_user_id
     LEFT JOIN live_guest_participants g ON g.id = a.guest_participant_id
     WHERE a.room_id = $1 AND m.id IS NULL
     ORDER BY a.created_at ASC`,
    [roomId],
  );

  return [...messages, ...orphans]
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .slice(-200)
    .map(mapMessage);
}

module.exports = { insertLiveChatMessage, listLiveChatHistory, mapMessage };
