const db = require('../utils/db');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value, max = 1000) {
  const out = String(value ?? '').trim();
  return out ? out.slice(0, max) : null;
}

function uuid(value) {
  const out = text(value, 64);
  return out && UUID_RE.test(out) ? out : null;
}

function number(value, min, max, fallback = null) {
  const out = Number(value);
  return Number.isFinite(out) ? Math.min(max, Math.max(min, out)) : fallback;
}

function date(value) {
  const out = text(value, 40);
  return out && /^\d{4}-\d{2}-\d{2}/.test(out) ? out : null;
}

function enumValue(value, values, fallback) {
  const out = text(value, 40);
  return values.includes(out) ? out : fallback;
}

function ensureTitle(value, res, message) {
  const title = text(value, 180);
  if (!title) res.status(400).json({ success: false, message });
  return title;
}

async function hasMenteeAccess(mentorId, menteeId) {
  if (!menteeId) return true;
  const result = await db.query(
    `SELECT 1 FROM enrollments WHERE instructor_id = $1 AND student_id = $2 LIMIT 1`,
    [mentorId, menteeId],
  );
  return result.rowCount > 0;
}

async function hasOwnedReference(table, mentorId, id) {
  if (!id) return true;
  if (!['mentorship_goals', 'mentorship_sessions'].includes(table)) return false;
  const result = await db.query(`SELECT 1 FROM ${table} WHERE id = $1 AND mentor_id = $2 LIMIT 1`, [id, mentorId]);
  return result.rowCount > 0;
}

async function getWorkspace(req, res, next) {
  try {
    const mentorId = req.user.id;
    const [goals, milestones, sessions, actions, services, resources, agreements] = await Promise.all([
      db.query(`SELECT * FROM mentorship_goals WHERE mentor_id = $1 ORDER BY status = 'active' DESC, updated_at DESC`, [mentorId]),
      db.query(`SELECT m.* FROM mentorship_milestones m JOIN mentorship_goals g ON g.id = m.goal_id WHERE g.mentor_id = $1 ORDER BY m.sort_order, m.created_at`, [mentorId]),
      db.query(`SELECT * FROM mentorship_sessions WHERE mentor_id = $1 ORDER BY scheduled_at DESC NULLS LAST, created_at DESC`, [mentorId]),
      db.query(`SELECT * FROM mentorship_actions WHERE mentor_id = $1 ORDER BY status = 'done', due_date NULLS LAST, created_at DESC`, [mentorId]),
      db.query(`SELECT * FROM mentorship_services WHERE mentor_id = $1 ORDER BY active DESC, updated_at DESC`, [mentorId]),
      db.query(`SELECT * FROM mentorship_resources WHERE mentor_id = $1 ORDER BY created_at DESC`, [mentorId]),
      db.query(`SELECT * FROM mentorship_agreements WHERE mentor_id = $1 ORDER BY updated_at DESC`, [mentorId]),
    ]);
    const milestoneByGoal = milestones.rows.reduce((map, row) => {
      (map[row.goal_id] ||= []).push(row);
      return map;
    }, {});
    return res.json({
      goals: goals.rows.map((goal) => ({ ...goal, milestones: milestoneByGoal[goal.id] || [] })),
      sessions: sessions.rows,
      actions: actions.rows,
      services: services.rows,
      resources: resources.rows,
      agreements: agreements.rows,
    });
  } catch (err) {
    return next(err);
  }
}

async function createGoal(req, res, next) {
  try {
    const title = ensureTitle(req.body?.title, res, 'Məqsədin adını yazın');
    if (!title) return;
    const menteeId = uuid(req.body?.mentee_id);
    if (!(await hasMenteeAccess(req.user.id, menteeId))) {
      return res.status(403).json({ success: false, message: 'Bu mentee ilə aktiv əlaqəniz yoxdur' });
    }
    const { rows } = await db.query(
      `INSERT INTO mentorship_goals (mentor_id, mentee_id, title, why_text, success_metric, target_date, status, progress)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, menteeId, title, text(req.body?.why_text, 2000), text(req.body?.success_metric, 500), date(req.body?.target_date), enumValue(req.body?.status, ['draft', 'active', 'paused', 'completed'], 'active'), number(req.body?.progress, 0, 100, 0)],
    );
    return res.status(201).json({ goal: { ...rows[0], milestones: [] } });
  } catch (err) { return next(err); }
}

async function updateGoal(req, res, next) {
  try {
    const { rows } = await db.query(
      `UPDATE mentorship_goals SET
         title = COALESCE($3, title), why_text = COALESCE($4, why_text), success_metric = COALESCE($5, success_metric),
         target_date = COALESCE($6, target_date), status = COALESCE($7, status), progress = COALESCE($8, progress), updated_at = NOW()
       WHERE id = $1 AND mentor_id = $2 RETURNING *`,
      [uuid(req.params.id), req.user.id, text(req.body?.title, 180), text(req.body?.why_text, 2000), text(req.body?.success_metric, 500), date(req.body?.target_date), enumValue(req.body?.status, ['draft', 'active', 'paused', 'completed'], null), number(req.body?.progress, 0, 100, null)],
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Məqsəd tapılmadı' });
    return res.json({ goal: rows[0] });
  } catch (err) { return next(err); }
}

async function createMilestone(req, res, next) {
  try {
    const goalId = uuid(req.params.id);
    const title = ensureTitle(req.body?.title, res, 'Addımın adını yazın');
    if (!goalId || !title) return;
    const owns = await db.query(`SELECT 1 FROM mentorship_goals WHERE id = $1 AND mentor_id = $2`, [goalId, req.user.id]);
    if (!owns.rowCount) return res.status(404).json({ success: false, message: 'Məqsəd tapılmadı' });
    const { rows } = await db.query(
      `INSERT INTO mentorship_milestones (goal_id, title, due_date, status, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [goalId, title, date(req.body?.due_date), enumValue(req.body?.status, ['todo', 'doing', 'done'], 'todo'), number(req.body?.sort_order, 0, 10000, 0)],
    );
    return res.status(201).json({ milestone: rows[0] });
  } catch (err) { return next(err); }
}

async function updateMilestone(req, res, next) {
  try {
    const { rows } = await db.query(
      `UPDATE mentorship_milestones m SET title = COALESCE($4, m.title), due_date = COALESCE($5, m.due_date), status = COALESCE($6, m.status)
       FROM mentorship_goals g WHERE m.id = $1 AND m.goal_id = g.id AND g.mentor_id = $2 AND g.id = $3 RETURNING m.*`,
      [uuid(req.params.milestoneId), req.user.id, uuid(req.params.id), text(req.body?.title, 180), date(req.body?.due_date), enumValue(req.body?.status, ['todo', 'doing', 'done'], null)],
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Addım tapılmadı' });
    return res.json({ milestone: rows[0] });
  } catch (err) { return next(err); }
}

async function createSession(req, res, next) {
  try {
    const title = ensureTitle(req.body?.title, res, 'Sessiyanın adını yazın');
    if (!title) return;
    const menteeId = uuid(req.body?.mentee_id);
    if (!(await hasMenteeAccess(req.user.id, menteeId))) {
      return res.status(403).json({ success: false, message: 'Bu mentee ilə aktiv əlaqəniz yoxdur' });
    }
    const agenda = Array.isArray(req.body?.agenda) ? req.body.agenda.map((x) => text(x, 240)).filter(Boolean).slice(0, 12) : [];
    const { rows } = await db.query(
      `INSERT INTO mentorship_sessions (mentor_id, mentee_id, title, scheduled_at, duration_minutes, format, status, agenda, private_notes, shared_summary, check_in)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11) RETURNING *`,
      [req.user.id, menteeId, title, req.body?.scheduled_at || null, number(req.body?.duration_minutes, 15, 480, 60), enumValue(req.body?.format, ['online', 'in_person', 'phone'], 'online'), enumValue(req.body?.status, ['planned', 'completed', 'cancelled'], 'planned'), JSON.stringify(agenda), text(req.body?.private_notes, 6000), text(req.body?.shared_summary, 4000), number(req.body?.check_in, 1, 5, null)],
    );
    return res.status(201).json({ session: rows[0] });
  } catch (err) { return next(err); }
}

async function updateSession(req, res, next) {
  try {
    const agenda = Array.isArray(req.body?.agenda) ? JSON.stringify(req.body.agenda.map((x) => text(x, 240)).filter(Boolean).slice(0, 12)) : null;
    const { rows } = await db.query(
      `UPDATE mentorship_sessions SET title = COALESCE($3,title), scheduled_at = COALESCE($4,scheduled_at),
       duration_minutes = COALESCE($5,duration_minutes), format = COALESCE($6,format), status = COALESCE($7,status),
       agenda = COALESCE($8::jsonb,agenda), private_notes = COALESCE($9,private_notes), shared_summary = COALESCE($10,shared_summary),
       check_in = COALESCE($11,check_in), updated_at = NOW() WHERE id = $1 AND mentor_id = $2 RETURNING *`,
      [uuid(req.params.id), req.user.id, text(req.body?.title, 180), req.body?.scheduled_at || null, number(req.body?.duration_minutes, 15, 480, null), enumValue(req.body?.format, ['online', 'in_person', 'phone'], null), enumValue(req.body?.status, ['planned', 'completed', 'cancelled'], null), agenda, text(req.body?.private_notes, 6000), text(req.body?.shared_summary, 4000), number(req.body?.check_in, 1, 5, null)],
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Sessiya tapılmadı' });
    return res.json({ session: rows[0] });
  } catch (err) { return next(err); }
}

async function createAction(req, res, next) {
  try {
    const title = ensureTitle(req.body?.title, res, 'Öhdəliyin adını yazın');
    if (!title) return;
    const menteeId = uuid(req.body?.mentee_id);
    const sessionId = uuid(req.body?.session_id);
    const goalId = uuid(req.body?.goal_id);
    if (!(await hasMenteeAccess(req.user.id, menteeId))) {
      return res.status(403).json({ success: false, message: 'Bu mentee ilə aktiv əlaqəniz yoxdur' });
    }
    if (!(await hasOwnedReference('mentorship_sessions', req.user.id, sessionId)) || !(await hasOwnedReference('mentorship_goals', req.user.id, goalId))) {
      return res.status(403).json({ success: false, message: 'Sessiya və ya məqsəd sizə aid deyil' });
    }
    const { rows } = await db.query(
      `INSERT INTO mentorship_actions (mentor_id, session_id, goal_id, mentee_id, title, owner_type, due_date, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, sessionId, goalId, menteeId, title, enumValue(req.body?.owner_type, ['mentor', 'mentee', 'shared'], 'mentee'), date(req.body?.due_date), enumValue(req.body?.status, ['todo', 'doing', 'done'], 'todo')],
    );
    return res.status(201).json({ action: rows[0] });
  } catch (err) { return next(err); }
}

async function updateAction(req, res, next) {
  try {
    const { rows } = await db.query(
      `UPDATE mentorship_actions SET title = COALESCE($3,title), owner_type = COALESCE($4,owner_type), due_date = COALESCE($5,due_date), status = COALESCE($6,status), updated_at = NOW()
       WHERE id = $1 AND mentor_id = $2 RETURNING *`,
      [uuid(req.params.id), req.user.id, text(req.body?.title, 180), enumValue(req.body?.owner_type, ['mentor', 'mentee', 'shared'], null), date(req.body?.due_date), enumValue(req.body?.status, ['todo', 'doing', 'done'], null)],
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Öhdəlik tapılmadı' });
    return res.json({ action: rows[0] });
  } catch (err) { return next(err); }
}

async function createService(req, res, next) {
  try {
    const title = ensureTitle(req.body?.title, res, 'Xidmətin adını yazın');
    if (!title) return;
    const { rows } = await db.query(
      `INSERT INTO mentorship_services (mentor_id, title, description, delivery_format, duration_minutes, price_amount, currency, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.user.id, title, text(req.body?.description, 2000), enumValue(req.body?.delivery_format, ['one_to_one', 'package', 'group'], 'one_to_one'), number(req.body?.duration_minutes, 15, 10080, 60), number(req.body?.price_amount, 0, 999999, null), text(req.body?.currency, 3) || 'AZN', req.body?.active !== false],
    );
    return res.status(201).json({ service: rows[0] });
  } catch (err) { return next(err); }
}

async function updateService(req, res, next) {
  try {
    const { rows } = await db.query(
      `UPDATE mentorship_services SET title = COALESCE($3,title), description = COALESCE($4,description), delivery_format = COALESCE($5,delivery_format), duration_minutes = COALESCE($6,duration_minutes), price_amount = COALESCE($7,price_amount), active = COALESCE($8,active), updated_at = NOW()
       WHERE id = $1 AND mentor_id = $2 RETURNING *`,
      [uuid(req.params.id), req.user.id, text(req.body?.title, 180), text(req.body?.description, 2000), enumValue(req.body?.delivery_format, ['one_to_one', 'package', 'group'], null), number(req.body?.duration_minutes, 15, 10080, null), number(req.body?.price_amount, 0, 999999, null), typeof req.body?.active === 'boolean' ? req.body.active : null],
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Xidmət tapılmadı' });
    return res.json({ service: rows[0] });
  } catch (err) { return next(err); }
}

async function createResource(req, res, next) {
  try {
    const title = ensureTitle(req.body?.title, res, 'Resursun adını yazın');
    if (!title) return;
    const { rows } = await db.query(
      `INSERT INTO mentorship_resources (mentor_id, title, resource_type, url, category, visibility) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.id, title, enumValue(req.body?.resource_type, ['link', 'article', 'video', 'template', 'book'], 'link'), text(req.body?.url, 1500), text(req.body?.category, 120), enumValue(req.body?.visibility, ['private', 'mentees'], 'private')],
    );
    return res.status(201).json({ resource: rows[0] });
  } catch (err) { return next(err); }
}

async function deleteResource(req, res, next) {
  try {
    const result = await db.query(`DELETE FROM mentorship_resources WHERE id = $1 AND mentor_id = $2`, [uuid(req.params.id), req.user.id]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: 'Resurs tapılmadı' });
    return res.json({ success: true });
  } catch (err) { return next(err); }
}

async function upsertAgreement(req, res, next) {
  try {
    const menteeId = uuid(req.body?.mentee_id);
    if (!menteeId) return res.status(400).json({ success: false, message: 'Mentee seçin' });
    if (!(await hasMenteeAccess(req.user.id, menteeId))) {
      return res.status(403).json({ success: false, message: 'Bu mentee ilə aktiv əlaqəniz yoxdur' });
    }
    const { rows } = await db.query(
      `INSERT INTO mentorship_agreements (mentor_id, mentee_id, meeting_cadence, communication_channel, confidentiality, boundaries, success_definition, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (mentor_id, mentee_id) DO UPDATE SET meeting_cadence = EXCLUDED.meeting_cadence, communication_channel = EXCLUDED.communication_channel, confidentiality = EXCLUDED.confidentiality, boundaries = EXCLUDED.boundaries, success_definition = EXCLUDED.success_definition, status = EXCLUDED.status, updated_at = NOW()
       RETURNING *`,
      [req.user.id, menteeId, text(req.body?.meeting_cadence, 300), text(req.body?.communication_channel, 300), text(req.body?.confidentiality, 1500), text(req.body?.boundaries, 1500), text(req.body?.success_definition, 1500), enumValue(req.body?.status, ['draft', 'shared', 'accepted', 'archived'], 'draft')],
    );
    return res.json({ agreement: rows[0] });
  } catch (err) { return next(err); }
}

async function updateInquiryStatus(req, res, next) {
  try {
    const status = enumValue(req.body?.status, ['pending', 'accepted', 'declined', 'archived'], null);
    if (!status) return res.status(400).json({ success: false, message: 'Status düzgün deyil' });
    const { rows } = await db.query(
      `UPDATE student_inquiries SET status = $3 WHERE id = $1 AND instructor_user_id = $2 RETURNING id, status`,
      [uuid(req.params.id), req.user.id, status],
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Müraciət tapılmadı' });
    return res.json({ inquiry: rows[0] });
  } catch (err) { return next(err); }
}

module.exports = {
  getWorkspace,
  createGoal,
  updateGoal,
  createMilestone,
  updateMilestone,
  createSession,
  updateSession,
  createAction,
  updateAction,
  createService,
  updateService,
  createResource,
  deleteResource,
  upsertAgreement,
  updateInquiryStatus,
};
