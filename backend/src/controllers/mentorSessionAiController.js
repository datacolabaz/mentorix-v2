const db = require('../utils/db');
const { localeFromReq } = require('../lib/userLocale');
const { AI_OPS, withAiCredit } = require('../services/aiCreditService');
const { createGenerationRequest, updateGenerationRequestStatus } = require('../modules/generation/generation.repository');
const { toTeacherAiError } = require('../lib/sanitizeAiProviderError');
const { callAnthropic } = require('../services/mentorSessionAiService');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OWNERS = new Set(['mentor', 'mentee', 'shared']);

function uuid(value) {
  const text = String(value || '').trim();
  return UUID_RE.test(text) ? text : null;
}

function safeText(value, max) {
  const text = String(value || '').replace(/\u0000/g, '').trim();
  return text ? text.slice(0, max) : null;
}

function validDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

async function getOwnedSession(mentorId, sessionId, client = db) {
  const { rows } = await client.query(
    `SELECT s.*, g.title AS goal_title, g.success_metric AS goal_success_metric
     FROM mentorship_sessions s
     LEFT JOIN mentorship_goals g ON g.id = s.goal_id AND g.mentor_id = s.mentor_id
     WHERE s.id = $1 AND s.mentor_id = $2 LIMIT 1`,
    [sessionId, mentorId],
  );
  return rows[0] || null;
}

async function generateSessionDraftImpl(req, res) {
  const locale = localeFromReq(req);
  const sessionId = uuid(req.params.id);
  const rawNotes = safeText(req.body?.raw_notes, 12000);
  if (!sessionId) return res.status(400).json({ success: false, message: 'Sessiya ID düzgün deyil' });
  if (!rawNotes || rawNotes.length < 40) {
    return res.status(400).json({ success: false, message: 'AI xülasəsi üçün ən azı 40 simvol sessiya qeydi yazın' });
  }

  const session = await getOwnedSession(req.user.id, sessionId);
  if (!session) return res.status(404).json({ success: false, message: 'Sessiya tapılmadı' });

  const request = await createGenerationRequest({
    teacherId: req.user.id,
    requestPayload: { type: 'mentor_session_summary', session_id: sessionId, note_characters: rawNotes.length },
  });
  const started = Date.now();

  try {
    const result = await withAiCredit({
      userId: req.user.id,
      operation: AI_OPS.QUESTION_GENERATION,
      amount: 1,
      locale,
      run: async () => {
        const generated = await callAnthropic({
          session,
          notes: rawNotes,
          goal: session.goal_id ? { title: session.goal_title, success_metric: session.goal_success_metric } : null,
          locale,
        });
        return { ...generated, requestId: request.id };
      },
    });
    await updateGenerationRequestStatus(request.id, 'success', {
      modelUsed: result.model,
      tokenUsage: result.tokenUsage,
      latencyMs: Date.now() - started,
    });
    return res.json({
      success: true,
      draft: result.draft,
      meta: { request_id: request.id, model: result.model, generated_at: new Date().toISOString() },
    });
  } catch (err) {
    await updateGenerationRequestStatus(request.id, 'failed', {
      latencyMs: Date.now() - started,
      errorMessage: String(err?.message || 'AI generation failed').slice(0, 500),
    }).catch(() => {});
    const safe = toTeacherAiError(err, locale);
    return res.status(Number(err?.statusCode || err?.status) === 429 ? 429 : 502).json({ success: false, code: safe.code, message: safe.message });
  }
}

function generateSessionDraft(req, res, next) {
  generateSessionDraftImpl(req, res).catch(next);
}

async function completeSessionWithDraft(req, res, next) {
  const client = await db.pool.connect();
  try {
    const sessionId = uuid(req.params.id);
    if (!sessionId) return res.status(400).json({ success: false, message: 'Sessiya ID düzgün deyil' });
    const sharedSummary = safeText(req.body?.shared_summary, 4000);
    if (!sharedSummary) return res.status(400).json({ success: false, message: 'Paylaşılan xülasə boş ola bilməz' });
    const actionItems = Array.isArray(req.body?.action_items) ? req.body.action_items.slice(0, 10) : [];

    await client.query('BEGIN');
    const session = await getOwnedSession(req.user.id, sessionId, client);
    if (!session) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Sessiya tapılmadı' });
    }
    if (session.status === 'completed') {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, message: 'Sessiya artıq tamamlanıb' });
    }

    const { rows: sessions } = await client.query(
      `UPDATE mentorship_sessions SET status = 'completed', shared_summary = $3, private_notes = $4,
       check_in = $5, updated_at = NOW() WHERE id = $1 AND mentor_id = $2 RETURNING *`,
      [sessionId, req.user.id, sharedSummary, safeText(req.body?.private_notes, 6000), Math.min(5, Math.max(1, Number(req.body?.check_in) || 3))],
    );

    const createdActions = [];
    for (const item of actionItems) {
      const title = safeText(item?.title, 240);
      if (!title) continue;
      const { rows } = await client.query(
        `INSERT INTO mentorship_actions (mentor_id, session_id, goal_id, mentee_id, title, owner_type, due_date, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'todo') RETURNING *`,
        [req.user.id, sessionId, session.goal_id, session.mentee_id, title, OWNERS.has(item?.owner_type) ? item.owner_type : 'mentee', validDate(item?.due_date)],
      );
      createdActions.push(rows[0]);
    }

    await client.query('COMMIT');
    return res.json({ success: true, session: sessions[0], actions: createdActions });
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* ignore */ }
    return next(err);
  } finally {
    client.release();
  }
}

module.exports = {
  generateSessionDraft,
  completeSessionWithDraft,
};
