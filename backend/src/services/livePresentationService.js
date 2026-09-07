const db = require('../utils/db');
const { getLiveRoomForUser } = require('./liveRoomService');
const { mapPresentationRow, listAnnotations } = require('./presentationsService');
const { readPresentationBuffer } = require('./presentationStorage');

function respondentKey(user) {
  return `${user?.role || 'user'}:${user?.id || ''}`;
}

function sanitizeOptions(raw) {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((opt, i) => ({
      id: String(opt?.id || `o${i + 1}`).slice(0, 32),
      text: String(opt?.text || '').trim().slice(0, 120),
    }))
    .filter((opt) => opt.text)
    .slice(0, 6);
}

function mapPoll(row, { counts = {}, myOptionId = null, revealCorrect = false } = {}) {
  if (!row) return null;
  const options = sanitizeOptions(row.options).map((opt) => ({
    ...opt,
    count: Number(counts[opt.id]) || 0,
  }));
  return {
    id: row.id,
    question: row.question,
    options,
    kind: row.kind === 'quiz' ? 'quiz' : 'poll',
    status: row.status,
    slide_index: Number(row.slide_index) || 0,
    total: options.reduce((s, o) => s + o.count, 0),
    my_option_id: myOptionId,
    correct_option_id: revealCorrect || row.status === 'closed' ? row.correct_option_id || null : null,
  };
}

async function loadPollCounts(pollId) {
  const { rows } = await db.query(
    `SELECT option_id, COUNT(*)::int AS n
     FROM presentation_poll_responses
     WHERE poll_id = $1
     GROUP BY option_id`,
    [pollId],
  );
  const counts = {};
  for (const r of rows) counts[r.option_id] = Number(r.n) || 0;
  return counts;
}

async function getMyVote(pollId, user) {
  const { rows } = await db.query(
    `SELECT option_id FROM presentation_poll_responses WHERE poll_id = $1 AND respondent_key = $2 LIMIT 1`,
    [pollId, respondentKey(user)],
  );
  return rows[0]?.option_id || null;
}

async function getActivePoll(roomId, user, { revealCorrect = false } = {}) {
  const { rows } = await db.query(
    `SELECT * FROM presentation_polls WHERE room_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
    [roomId],
  );
  const row = rows[0];
  if (!row) return null;
  const counts = await loadPollCounts(row.id);
  const myOptionId = await getMyVote(row.id, user);
  return mapPoll(row, { counts, myOptionId, revealCorrect: revealCorrect || user?.role === 'instructor' });
}

async function getPresentationState(roomCode, user) {
  const room = await getLiveRoomForUser(roomCode, user);
  if (!room.presentation_id) {
    return { room, presentation: null, slide_index: 0, annotations: {}, poll: null };
  }
  const { rows } = await db.query(`SELECT * FROM presentations WHERE id = $1 LIMIT 1`, [room.presentation_id]);
  const presentation = rows[0] ? mapPresentationRow(rows[0]) : null;
  const annotations = rows[0] ? await listAnnotations(rows[0].id) : {};
  const poll = await getActivePoll(room.id, user);
  return {
    room,
    presentation,
    slide_index: Number(room.presentation_slide) || 0,
    annotations,
    poll,
  };
}

async function setPresentationState(roomCode, user, { presentationId, slideIndex, close = false }) {
  const room = await getLiveRoomForUser(roomCode, user);
  if (user.role !== 'instructor' || String(room.instructor_id) !== String(user.id)) {
    const err = new Error('İcazə yoxdur');
    err.status = 403;
    throw err;
  }

  if (close || presentationId === null) {
    await db.query(
      `UPDATE live_rooms SET presentation_id = NULL, presentation_slide = 0, presentation_state = '{}'::jsonb WHERE id = $1`,
      [room.id],
    );
    await db.query(`UPDATE presentation_polls SET status = 'closed' WHERE room_id = $1 AND status = 'open'`, [room.id]);
    return getPresentationState(roomCode, user);
  }

  if (presentationId) {
    const { rows } = await db.query(
      `SELECT id FROM presentations WHERE id = $1 AND instructor_id = $2 LIMIT 1`,
      [presentationId, user.id],
    );
    if (!rows[0]) {
      const err = new Error('Təqdimat tapılmadı');
      err.status = 404;
      throw err;
    }
    const slide = Number.isFinite(Number(slideIndex)) ? Math.max(0, Math.round(Number(slideIndex))) : 0;
    await db.query(
      `UPDATE live_rooms SET presentation_id = $2, presentation_slide = $3, presentation_state = '{}'::jsonb WHERE id = $1`,
      [room.id, presentationId, slide],
    );
    return getPresentationState(roomCode, user);
  }

  if (slideIndex != null) {
    const slide = Math.max(0, Math.round(Number(slideIndex) || 0));
    await db.query(`UPDATE live_rooms SET presentation_slide = $2 WHERE id = $1`, [room.id, slide]);
  }
  return getPresentationState(roomCode, user);
}

async function createPoll(roomCode, user, body) {
  const room = await getLiveRoomForUser(roomCode, user);
  if (user.role !== 'instructor' || String(room.instructor_id) !== String(user.id)) {
    const err = new Error('İcazə yoxdur');
    err.status = 403;
    throw err;
  }
  const question = String(body?.question || '').trim().slice(0, 240);
  const options = sanitizeOptions(body?.options);
  if (!question || options.length < 2) {
    const err = new Error('Sual və ən azı 2 variant lazımdır');
    err.status = 400;
    throw err;
  }
  const kind = body?.kind === 'quiz' ? 'quiz' : 'poll';
  const correct = kind === 'quiz' ? String(body?.correct_option_id || options[0].id) : null;
  await db.query(`UPDATE presentation_polls SET status = 'closed' WHERE room_id = $1 AND status = 'open'`, [room.id]);
  const { rows } = await db.query(
    `INSERT INTO presentation_polls (
       room_id, presentation_id, slide_index, question, options, kind, correct_option_id, created_by
     ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
     RETURNING *`,
    [
      room.id,
      room.presentation_id || null,
      Number(room.presentation_slide) || 0,
      question,
      JSON.stringify(options),
      kind,
      correct,
      user.id,
    ],
  );
  return mapPoll(rows[0], { revealCorrect: true });
}

async function respondPoll(roomCode, user, pollId, optionId) {
  const room = await getLiveRoomForUser(roomCode, user);
  const { rows } = await db.query(
    `SELECT * FROM presentation_polls WHERE id = $1 AND room_id = $2 LIMIT 1`,
    [pollId, room.id],
  );
  const poll = rows[0];
  if (!poll) {
    const err = new Error('Sual tapılmadı');
    err.status = 404;
    throw err;
  }
  if (poll.status !== 'open') {
    const err = new Error('Sual bağlanıb');
    err.status = 400;
    throw err;
  }
  const options = sanitizeOptions(poll.options);
  const option = options.find((o) => o.id === String(optionId || ''));
  if (!option) {
    const err = new Error('Variant tapılmadı');
    err.status = 400;
    throw err;
  }
  await db.query(
    `INSERT INTO presentation_poll_responses (poll_id, respondent_key, option_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (poll_id, respondent_key) DO UPDATE SET option_id = EXCLUDED.option_id, created_at = NOW()`,
    [poll.id, respondentKey(user), option.id],
  );
  const counts = await loadPollCounts(poll.id);
  const reveal = user.role === 'instructor';
  return mapPoll(poll, { counts, myOptionId: option.id, revealCorrect: reveal });
}

async function closePoll(roomCode, user, pollId) {
  const room = await getLiveRoomForUser(roomCode, user);
  if (user.role !== 'instructor' || String(room.instructor_id) !== String(user.id)) {
    const err = new Error('İcazə yoxdur');
    err.status = 403;
    throw err;
  }
  const { rows } = await db.query(
    `UPDATE presentation_polls SET status = 'closed' WHERE id = $1 AND room_id = $2 RETURNING *`,
    [pollId, room.id],
  );
  if (!rows[0]) {
    const err = new Error('Sual tapılmadı');
    err.status = 404;
    throw err;
  }
  const counts = await loadPollCounts(rows[0].id);
  return mapPoll(rows[0], { counts, revealCorrect: true });
}

async function getOpenPresentationFile(roomCode, user) {
  const state = await getPresentationState(roomCode, user);
  if (!state.presentation?.file_url) {
    const err = new Error('Təqdimat açıq deyil');
    err.status = 404;
    throw err;
  }
  const filename = String(state.presentation.file_url).split('/').pop();
  const hit = await readPresentationBuffer(filename);
  if (!hit) {
    const err = new Error('Fayl tapılmadı');
    err.status = 404;
    throw err;
  }
  return { hit, presentation: state.presentation };
}

module.exports = {
  getPresentationState,
  setPresentationState,
  createPoll,
  respondPoll,
  closePoll,
  getOpenPresentationFile,
};
