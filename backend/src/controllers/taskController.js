const path = require('path');
const db = require('../utils/db');
const { recomputeInstructorStorageUsageMb } = require('../services/resourceUsageService');
const {
  isPastDueYmd,
  normalizeStatus,
  notifyStudentsOfNewAssignment,
  resolveGroupStudentIds,
} = require('../services/assignmentHomeworkService');
const { upsertStudentContactPhone } = require('../utils/studentPhone');
const { autoGrantTaskAccessForStudent } = require('../services/guestAccessService');
const { withBakuDisplayTimes } = require('../utils/azDatetime');
const { resolveEntitlements } = require('../services/billingEntitlements');

function subscriptionInactiveError(ent) {
  const err = new Error(
    ent?.messages?.banner ||
      `14 günlük SADƏ sınaq müddəti bitib. Davam etmək üçün ${ent?.upgrade_labels?.higher_paid_label || 'ödənişli paket'} seçin.`,
  );
  err.code = 'SUBSCRIPTION_INACTIVE';
  err.statusCode = 403;
  return err;
}

async function assertInstructorSubscriptionActive(instructorId) {
  const ent = await resolveEntitlements(instructorId);
  if (ent.should_block) throw subscriptionInactiveError(ent);
  return ent;
}

function parseDate(v) {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, mo, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return s;
}

function parseMaxScore(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = parseInt(String(v), 10);
  if (!Number.isFinite(n) || n < 1 || n > 10000) return null;
  return n;
}

const normalizeUrl = (u) => {
  if (!u) return null;
  const s = String(u).trim();
  if (!s) return null;
  if (s.startsWith('/api/uploads/')) return s;
  try {
    const p = new URL(s);
    if (p.protocol === 'http:' || p.protocol === 'https:') return s;
  } catch {
    // ignore
  }
  return null;
};

const listInstructorTasks = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { rows } = await db.query(
      `SELECT t.*,
              ig.name AS group_name,
              COALESCE(c.assigned_count, 0)::int AS assigned_count,
              COALESCE(c.submitted_count, 0)::int AS submitted_count,
              COALESCE(c.pending_count, 0)::int AS pending_count,
              COALESCE(c.reviewed_count, 0)::int AS reviewed_count,
              COALESCE(c.done_count, 0)::int AS done_count,
              COALESCE(r.recipients, '[]'::json) AS recipients
       FROM assignments t
       LEFT JOIN instructor_groups ig ON ig.id = t.group_id
       LEFT JOIN (
         SELECT assignment_id,
                COUNT(*)::int AS assigned_count,
                COUNT(*) FILTER (WHERE status IN ('submitted', 'late', 'reviewed'))::int AS submitted_count,
                COUNT(*) FILTER (WHERE status = 'pending')::int AS pending_count,
                COUNT(*) FILTER (WHERE status = 'reviewed')::int AS reviewed_count,
                COUNT(*) FILTER (WHERE status IN ('submitted', 'late', 'reviewed'))::int AS done_count
         FROM student_assignments
         GROUP BY assignment_id
       ) c ON c.assignment_id = t.id
       LEFT JOIN (
         SELECT a.assignment_id,
                json_agg(
                  json_build_object(
                    'student_id', a.student_id,
                    'full_name', u.full_name,
                    'status', a.status,
                    'student_assignment_id', a.id,
                    'submitted_at', a.submitted_at,
                    'reviewed_at', a.reviewed_at,
                    'score', a.score,
                    'late_decision', a.late_decision
                  )
                  ORDER BY u.full_name
                ) AS recipients
         FROM student_assignments a
         JOIN users u ON u.id = a.student_id
         GROUP BY a.assignment_id
       ) r ON r.assignment_id = t.id
       WHERE t.instructor_id = $1
       ORDER BY t.created_at DESC`,
      [instructorId],
    );
    res.json({
      success: true,
      tasks: rows.map((r) => withBakuDisplayTimes(r, ['created_at'])),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const createInstructorTask = async (req, res) => {
  try {
    const instructorId = req.user.id;
    await assertInstructorSubscriptionActive(instructorId);
    const title = String(req.body.title || '').trim();
    const topic = req.body.topic != null ? String(req.body.topic).trim() : '';
    const question_file_url = normalizeUrl(req.body.question_file_url);
    const description = req.body.description != null ? String(req.body.description).trim() : '';
    const due_date = parseDate(req.body.due_date);
    const max_score = parseMaxScore(req.body.max_score);
    const group_id = req.body.group_id || null;
    let student_ids = Array.isArray(req.body.student_ids)
      ? [...new Set(req.body.student_ids.filter((x) => x != null && String(x).trim() !== ''))]
      : [];

    if (!title) return res.status(400).json({ success: false, message: 'Tapşırığın adı tələb olunur' });

    if (group_id) {
      const fromGroup = await resolveGroupStudentIds(instructorId, group_id);
      student_ids = [...new Set([...student_ids, ...fromGroup])];
    }

    const out = await db.transaction(async (client) => {
      const { rows: trows } = await client.query(
        `INSERT INTO assignments (
           instructor_id, title, topic, question_file_url, description, due_date,
           max_score, group_id
         )
         VALUES ($1,$2,NULLIF($3,''),NULLIF($4,''),NULLIF($5,''),$6,$7,$8::uuid)
         RETURNING *`,
        [instructorId, title, topic || null, question_file_url, description || null, due_date, max_score, group_id],
      );
      const task = trows[0];

      const { ensureAssignmentParticipantGroup, addStudentToAssignmentParticipantGroup } = require('../services/participantGroupService');
      await ensureAssignmentParticipantGroup(client, instructorId, task.id, task.title);

      const { rows: ok } = await client.query(
        `SELECT DISTINCT e.student_id
         FROM enrollments e
         WHERE e.instructor_id = $1
           AND e.deleted_at IS NULL
           AND COALESCE(LOWER(TRIM(e.status)), 'active') IN ('active', 'pending_setup', 'pending_approval')
           AND e.student_id = ANY($2::uuid[])`,
        [instructorId, student_ids],
      );
      const targets = ok.map((r) => r.student_id).filter(Boolean);

      if (targets.length) {
        await client.query(
          `INSERT INTO student_assignments (assignment_id, student_id, status)
           SELECT $1::uuid, x::uuid, 'pending'
           FROM UNNEST($2::uuid[]) AS x
           ON CONFLICT (assignment_id, student_id) DO NOTHING`,
          [task.id, targets],
        );

        for (const sid of targets) {
          await addStudentToAssignmentParticipantGroup(client, task.id, sid);
        }
      }

      return { task, assignedCount: targets.length, studentIds: targets };
    });

    const { rows: iu } = await db.query(`SELECT full_name FROM users WHERE id = $1 LIMIT 1`, [instructorId]);
    if (out.studentIds?.length) {
      await notifyStudentsOfNewAssignment(out.task, out.studentIds, iu[0]?.full_name || '');
    }

    res.status(201).json({
      success: true,
      task: withBakuDisplayTimes(out.task, ['created_at']),
      assignedCount: out.assignedCount,
    });
  } catch (err) {
    if (err.code === 'SUBSCRIPTION_INACTIVE') {
      return res.status(403).json({ success: false, code: err.code, message: err.message });
    }
    const msg = err.message || 'Xəta';
    if (msg.includes('aktiv siyahısında')) {
      return res.status(400).json({ success: false, message: msg });
    }
    res.status(500).json({ success: false, message: msg });
  }
};

const deleteInstructorAssignment = async (req, res) => {
  try {
    const instructorId = req.user.id;
    await assertInstructorSubscriptionActive(instructorId);
    const id = req.params.id;
    const { rowCount } = await db.query(`DELETE FROM assignments WHERE id = $1 AND instructor_id = $2`, [
      id,
      instructorId,
    ]);
    if (rowCount === 0) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    await recomputeInstructorStorageUsageMb(instructorId, { persist: true });
    res.json({ success: true });
  } catch (err) {
    if (err.code === 'SUBSCRIPTION_INACTIVE') {
      return res.status(403).json({ success: false, code: err.code, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

const updateInstructorAssignment = async (req, res) => {
  try {
    const instructorId = req.user.id;
    await assertInstructorSubscriptionActive(instructorId);
    const id = req.params.id;

    const { rows: cur } = await db.query(
      `SELECT id, title, topic, question_file_url, description, due_date, max_score, group_id
       FROM assignments WHERE id = $1 AND instructor_id = $2 LIMIT 1`,
      [id, instructorId],
    );
    if (!cur[0]) return res.status(404).json({ success: false, message: 'Tapılmadı' });

    const title =
      req.body.title !== undefined ? String(req.body.title || '').trim() : String(cur[0].title || '').trim();
    if (!title) return res.status(400).json({ success: false, message: 'Tapşırığın adı tələb olunur' });

    const topic =
      req.body.topic !== undefined
        ? req.body.topic != null
          ? String(req.body.topic).trim()
          : ''
        : cur[0].topic;
    const description =
      req.body.description !== undefined
        ? req.body.description != null
          ? String(req.body.description).trim()
          : ''
        : cur[0].description;
    const due_date =
      req.body.due_date !== undefined ? parseDate(req.body.due_date) : cur[0].due_date;
    const max_score =
      req.body.max_score !== undefined ? parseMaxScore(req.body.max_score) : cur[0].max_score;
    const question_file_url =
      req.body.question_file_url !== undefined
        ? normalizeUrl(req.body.question_file_url)
        : cur[0].question_file_url;

    const { rows } = await db.query(
      `UPDATE assignments
       SET title = $3,
           topic = NULLIF($4, ''),
           description = NULLIF($5, ''),
           due_date = $6,
           max_score = $7,
           question_file_url = $8
       WHERE id = $1 AND instructor_id = $2
       RETURNING *`,
      [
        id,
        instructorId,
        title,
        topic || null,
        description || null,
        due_date,
        max_score,
        question_file_url,
      ],
    );

    res.json({ success: true, task: rows[0] });
  } catch (err) {
    if (err.code === 'SUBSCRIPTION_INACTIVE') {
      return res.status(403).json({ success: false, code: err.code, message: err.message });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

const { resolveEnrollmentScope } = require('../services/studentEnrollmentsService');

const listMyTasks = async (req, res) => {
  try {
    const studentId = req.user.id;
    const enrollmentId = String(req.query.enrollment_id || '').trim() || null;
    const scope = enrollmentId ? await resolveEnrollmentScope(studentId, enrollmentId) : null;
    if (enrollmentId && !scope) {
      return res.status(404).json({ success: false, message: 'Qrup tapılmadı' });
    }

    const params = [studentId];
    let instructorFilter = '';
    if (scope?.instructor_id) {
      params.push(scope.instructor_id);
      instructorFilter = ` AND t.instructor_id = $${params.length}`;
    }

    const { rows } = await db.query(
      `SELECT a.id AS assignment_id, a.status, a.done_at, a.submitted_at, a.seen_at,
              a.score, a.feedback, a.reviewed_at, a.late_decision,
              a.created_at AS assigned_at,
              t.id AS task_id, t.title, t.topic, t.description, t.due_date, t.max_score,
              t.question_file_url, t.created_at AS assignment_created_at,
              t.instructor_id, u.full_name AS instructor_name
       FROM student_assignments a
       JOIN assignments t ON t.id = a.assignment_id
       JOIN users u ON u.id = t.instructor_id
       WHERE a.student_id = $1${instructorFilter}
       ORDER BY COALESCE(t.due_date, DATE '2999-12-31') ASC, t.created_at DESC`,
      params,
    );

    const tasks = rows.map((r) => ({
      ...withBakuDisplayTimes(r, ['assignment_created_at', 'submitted_at', 'reviewed_at', 'assigned_at']),
      display_status: normalizeStatus(r),
    }));

    res.json({ success: true, tasks, enrollment_id: scope?.enrollment_id || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const markMyTaskDone = async (req, res) => {
  try {
    const studentId = req.user.id;
    const id = req.params.id;
    const { rows: cur } = await db.query(
      `SELECT a.status, a.submitted_at, t.due_date
       FROM student_assignments a
       JOIN assignments t ON t.id = a.assignment_id
       WHERE a.id = $1 AND a.student_id = $2`,
      [id, studentId],
    );
    if (!cur[0]) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (cur[0].status === 'late_rejected') {
      return res.status(403).json({ success: false, message: 'Gecikmiş təslim rədd edilib' });
    }
    if (cur[0].submitted_at) return res.json({ success: true, already: true });

    const nextStatus = isPastDueYmd(cur[0].due_date) ? 'late' : 'submitted';
    const { rowCount } = await db.query(
      `UPDATE student_assignments
       SET status = $3, done_at = NOW(), submitted_at = NOW()
       WHERE id = $1 AND student_id = $2`,
      [id, studentId, nextStatus],
    );
    if (rowCount > 0) return res.json({ success: true });
    return res.status(400).json({ success: false, message: 'Əməliyyat mümkün deyil' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getMyAssignment = async (req, res) => {
  try {
    const studentId = req.user.id;
    const id = req.params.id;
    const { rows } = await db.query(
      `SELECT a.id AS assignment_id, a.status, a.answer_text, a.attachment_urls,
              a.submitted_at, a.score, a.feedback, a.reviewed_at, a.late_decision,
              t.title, t.topic, t.question_file_url, t.description, t.due_date, t.max_score,
              t.created_at AS assignment_created_at,
              u.full_name AS instructor_name
       FROM student_assignments a
       JOIN assignments t ON t.id = a.assignment_id
       JOIN users u ON u.id = t.instructor_id
       WHERE a.id = $1 AND a.student_id = $2
       LIMIT 1`,
      [id, studentId],
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Tapılmadı' });

    const { rows: seenRows } = await db.query(
      `UPDATE student_assignments
       SET seen_at = COALESCE(seen_at, NOW())
       WHERE id = $1 AND student_id = $2
       RETURNING seen_at`,
      [id, studentId],
    );

    await db
      .query(
        `UPDATE notifications
         SET is_read = TRUE
         WHERE user_id = $1
           AND is_read = FALSE
           AND type IN ('assignment_new', 'assignment_reminder', 'assignment_overdue')
           AND (meta->>'assignment_id')::text = (
             SELECT sa.assignment_id::text FROM student_assignments sa
             WHERE sa.id = $2 AND sa.student_id = $1
             LIMIT 1
           )`,
        [studentId, id],
      )
      .catch(() => {});

    const assignment = {
      ...withBakuDisplayTimes(rows[0], ['assignment_created_at', 'submitted_at', 'reviewed_at']),
      seen_at: seenRows[0]?.seen_at || rows[0].seen_at,
      display_status: normalizeStatus(rows[0]),
    };
    res.json({ success: true, assignment });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const saveMyAssignmentDraft = async (req, res) => {
  try {
    const studentId = req.user.id;
    const id = req.params.id;
    const answer_text = req.body.answer_text != null ? String(req.body.answer_text) : null;
    const attachment_urls = Array.isArray(req.body.attachment_urls)
      ? req.body.attachment_urls.map(normalizeUrl).filter(Boolean)
      : null;

    const { rows: cur } = await db.query(
      `SELECT a.status, a.submitted_at, a.late_decision
       FROM student_assignments a WHERE a.id = $1 AND a.student_id = $2 LIMIT 1`,
      [id, studentId],
    );
    if (!cur[0]) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (cur[0].late_decision === 'rejected') {
      return res.status(403).json({ success: false, message: 'Gecikmiş təslim rədd edilib' });
    }
    if (cur[0].submitted_at || ['submitted', 'reviewed', 'late'].includes(cur[0].status)) {
      return res.status(409).json({ success: false, message: 'Bu tapşırıq artıq təslim edilib və dəyişilə bilməz' });
    }

    const { rows } = await db.query(
      `UPDATE student_assignments
       SET answer_text = COALESCE($1, answer_text),
           attachment_urls = COALESCE($2, attachment_urls)
       WHERE id = $3 AND student_id = $4
       RETURNING id AS assignment_id, status, submitted_at, answer_text, attachment_urls`,
      [answer_text, attachment_urls, id, studentId],
    );
    res.json({ success: true, assignment: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const submitMyAssignment = async (req, res) => {
  try {
    const studentId = req.user.id;
    const id = req.params.id;
    const answer_text = req.body.answer_text != null ? String(req.body.answer_text) : null;
    const attachment_urls = Array.isArray(req.body.attachment_urls)
      ? req.body.attachment_urls.map(normalizeUrl).filter(Boolean)
      : null;

    const { rows: cur } = await db.query(
      `SELECT a.status, a.submitted_at, a.late_decision, t.due_date
       FROM student_assignments a
       JOIN assignments t ON t.id = a.assignment_id
       WHERE a.id = $1 AND a.student_id = $2 LIMIT 1`,
      [id, studentId],
    );
    if (!cur[0]) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    if (cur[0].late_decision === 'rejected') {
      return res.status(403).json({ success: false, message: 'Gecikmiş təslim rədd edilib' });
    }
    if (cur[0].submitted_at) return res.json({ success: true, already: true });

    const nextStatus = isPastDueYmd(cur[0].due_date) ? 'late' : 'submitted';
    const { rows } = await db.query(
      `UPDATE student_assignments
       SET answer_text = COALESCE($1, answer_text),
           attachment_urls = COALESCE($2, attachment_urls),
           status = $5,
           done_at = COALESCE(done_at, NOW()),
           submitted_at = NOW()
       WHERE id = $3 AND student_id = $4
       RETURNING id AS assignment_id, status, submitted_at`,
      [answer_text, attachment_urls, id, studentId, nextStatus],
    );

    const { notifyStudent } = require('../services/assignmentHomeworkService');
    const { rows: inst } = await db.query(
      `SELECT t.instructor_id, t.title, u.full_name AS student_name
       FROM student_assignments a
       JOIN assignments t ON t.id = a.assignment_id
       JOIN users u ON u.id = a.student_id
       WHERE a.id = $1`,
      [id],
    );
    if (inst[0]) {
      await notifyStudent(
        inst[0].instructor_id,
        'Tapşırıq təslim edildi',
        `${inst[0].student_name} «${inst[0].title}» tapşırığını təslim etdi.`,
        'assignment_submitted',
      );
    }

    try {
      const { rows: meta } = await db.query(
        `SELECT assignment_id FROM student_assignments WHERE id = $1 LIMIT 1`,
        [id],
      );
      if (meta[0]?.assignment_id) {
        await db.transaction(async (client) => {
          const { addStudentToAssignmentParticipantGroup } = require('../services/participantGroupService');
          await addStudentToAssignmentParticipantGroup(client, meta[0].assignment_id, studentId);
        });
      }
    } catch (e) {
      console.error('addStudentToAssignmentParticipantGroup', e.message);
    }

    res.json({ success: true, assignment: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const requestAiReviewSuggestion = async (req, res) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return res.status(503).json({
        success: false,
        message: 'AI xidməti aktiv deyil. OPENAI_API_KEY təyin edin.',
      });
    }

    const instructorId = req.user.id;
    const id = req.params.id;
    const { rows } = await db.query(
      `SELECT a.id, a.status, a.answer_text, a.attachment_urls, a.submitted_at, a.ai_metadata,
              t.title, t.topic, t.description, t.max_score, t.instructor_id
       FROM student_assignments a
       JOIN assignments t ON t.id = a.assignment_id
       WHERE a.id = $1 AND t.instructor_id = $2
       LIMIT 1`,
      [id, instructorId],
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Tapılmadı' });

    if (!rows[0].submitted_at || !['submitted', 'late', 'reviewed'].includes(rows[0].status)) {
      return res.status(400).json({ success: false, message: 'Yalnız təslim edilmiş iş üçün AI təklifi mümkündür' });
    }

    const pending = {
      status: 'pending',
      requested_at: new Date().toISOString(),
    };
    await db.query(`UPDATE student_assignments SET ai_metadata = $1::jsonb WHERE id = $2`, [
      JSON.stringify(pending),
      id,
    ]);

    const { runAssignmentAiReview } = require('../services/assignmentAiReviewService');
    let ai;
    try {
      ai = await runAssignmentAiReview(rows[0]);
    } catch (err) {
      const failed = {
        status: 'error',
        error: err.message || 'AI xətası',
        completed_at: new Date().toISOString(),
      };
      await db.query(`UPDATE student_assignments SET ai_metadata = $1::jsonb WHERE id = $2`, [
        JSON.stringify(failed),
        id,
      ]);
      return res.status(422).json({ success: false, message: failed.error, ai: failed });
    }

    await db.query(`UPDATE student_assignments SET ai_metadata = $1::jsonb WHERE id = $2`, [
      JSON.stringify(ai),
      id,
    ]);

    res.json({ success: true, ai });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getInstructorStudentAssignment = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const id = req.params.id;
    const { rows } = await db.query(
      `SELECT a.id AS student_assignment_id, a.status, a.answer_text, a.attachment_urls,
              a.submitted_at, a.score, a.feedback, a.reviewed_at, a.late_decision, a.ai_metadata,
              s.full_name AS student_name, s.id AS student_id,
              t.id AS assignment_id, t.title, t.topic, t.question_file_url, t.description,
              t.due_date, t.max_score, t.created_at AS assignment_created_at
       FROM student_assignments a
       JOIN assignments t ON t.id = a.assignment_id
       JOIN users s ON s.id = a.student_id
       WHERE a.id = $1 AND t.instructor_id = $2
       LIMIT 1`,
      [id, instructorId],
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    res.json({
      success: true,
      review: withBakuDisplayTimes(rows[0], ['assignment_created_at', 'submitted_at', 'reviewed_at']),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const reviewInstructorAssignment = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const id = req.params.id;
    const scoreRaw = req.body.score;
    const feedback = req.body.feedback != null ? String(req.body.feedback).trim() : null;
    const late_decision = req.body.late_decision;

    const { rows: cur } = await db.query(
      `SELECT a.status, a.student_id, t.title, t.max_score, t.instructor_id
       FROM student_assignments a
       JOIN assignments t ON t.id = a.assignment_id
       WHERE a.id = $1 AND t.instructor_id = $2`,
      [id, instructorId],
    );
    if (!cur[0]) return res.status(404).json({ success: false, message: 'Tapılmadı' });

    let nextStatus = cur[0].status;
    let lateDecision = cur[0].late_decision || null;

    if (late_decision === 'accepted' || late_decision === 'rejected') {
      lateDecision = late_decision;
      nextStatus = late_decision === 'accepted' ? 'submitted' : 'late_rejected';
    }

    let score = null;
    if (scoreRaw !== undefined && scoreRaw !== null && scoreRaw !== '') {
      score = Number(scoreRaw);
      if (!Number.isFinite(score)) {
        return res.status(400).json({ success: false, message: 'Qiymət düzgün deyil' });
      }
      const max = cur[0].max_score != null ? Number(cur[0].max_score) : null;
      if (max != null && score > max) {
        return res.status(400).json({ success: false, message: `Qiymət ${max}-dən çox ola bilməz` });
      }
      if (score < 0) return res.status(400).json({ success: false, message: 'Qiymət mənfi ola bilməz' });
      nextStatus = 'reviewed';
    } else if (feedback) {
      nextStatus = 'reviewed';
    }

    const { rows } = await db.query(
      `UPDATE student_assignments
       SET score = COALESCE($1, score),
           feedback = COALESCE($2, feedback),
           late_decision = COALESCE($3, late_decision),
           status = $4,
           reviewed_at = CASE WHEN $1 IS NOT NULL OR $2 IS NOT NULL THEN COALESCE(reviewed_at, NOW()) ELSE reviewed_at END
       WHERE id = $5
       RETURNING *`,
      [score, feedback, lateDecision, nextStatus, id],
    );

    if (score != null || feedback) {
      const { notifyStudent } = require('../services/assignmentHomeworkService');
      const scoreLine =
        score != null && cur[0].max_score != null
          ? ` Bal: ${score} / ${cur[0].max_score}.`
          : score != null
            ? ` Bal: ${score}.`
            : '';
      await notifyStudent(
        cur[0].student_id,
        'Tapşırıq yoxlanıldı',
        `«${cur[0].title}» üçün müəllim rəy bildirdi.${scoreLine}`,
        'assignment_reviewed',
      );
    }

    res.json({ success: true, review: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const listParentAssignments = async (req, res) => {
  try {
    const parentId = req.user.id;
    const studentId = req.query.student_id || null;
    const params = [parentId];
    let studentFilter = '';
    if (studentId) {
      params.push(studentId);
      studentFilter = ` AND u.id = $${params.length}::uuid`;
    }

    const { rows } = await db.query(
      `SELECT a.id AS student_assignment_id, a.status, a.submitted_at, a.reviewed_at,
              a.score, a.feedback, a.late_decision,
              u.id AS student_id, u.full_name AS student_name,
              t.id AS assignment_id, t.title, t.description, t.due_date, t.max_score,
              t.created_at AS assignment_created_at,
              iu.full_name AS instructor_name
       FROM student_assignments a
       JOIN assignments t ON t.id = a.assignment_id
       JOIN users u ON u.id = a.student_id
       JOIN student_profiles sp ON sp.user_id = u.id
       JOIN users iu ON iu.id = t.instructor_id
       WHERE sp.parent_id = $1${studentFilter}
       ORDER BY COALESCE(t.due_date, DATE '2999-12-31') DESC, t.created_at DESC`,
      params,
    );

    const items = rows.map((r) => ({
      ...withBakuDisplayTimes(r, ['assignment_created_at', 'submitted_at', 'reviewed_at']),
      display_status: normalizeStatus(r),
    }));

    const { rows: children } = await db.query(
      `SELECT u.id, u.full_name
       FROM users u
       JOIN student_profiles sp ON sp.user_id = u.id
       WHERE sp.parent_id = $1 AND u.is_active = TRUE
       ORDER BY u.full_name`,
      [parentId],
    );

    const summary = {
      assigned: items.length,
      submitted: items.filter((x) => ['submitted', 'late', 'reviewed'].includes(x.status)).length,
      reviewed: items.filter((x) => x.status === 'reviewed').length,
      pending: items.filter((x) => x.status === 'pending' && x.display_status !== 'overdue').length,
      overdue: items.filter((x) => x.display_status === 'overdue' || x.status === 'late').length,
    };

    res.json({ success: true, items, children, summary });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAssignmentAnalytics = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const { rows } = await db.query(
      `SELECT
         COUNT(*)::int AS total_assignments,
         COUNT(*) FILTER (WHERE a.status IN ('submitted', 'late', 'reviewed'))::int AS total_submissions,
         COUNT(*) FILTER (WHERE a.status = 'late')::int AS late_submissions,
         ROUND(AVG(a.score) FILTER (WHERE a.score IS NOT NULL), 1) AS average_score
       FROM student_assignments a
       JOIN assignments t ON t.id = a.assignment_id
       WHERE t.instructor_id = $1`,
      [instructorId],
    );
    const { rows: top } = await db.query(
      `SELECT u.full_name, AVG(a.score)::numeric AS avg_score, COUNT(*)::int AS reviewed_count
       FROM student_assignments a
       JOIN assignments t ON t.id = a.assignment_id
       JOIN users u ON u.id = a.student_id
       WHERE t.instructor_id = $1 AND a.score IS NOT NULL
       GROUP BY u.id, u.full_name
       HAVING COUNT(*) >= 1
       ORDER BY avg_score DESC
       LIMIT 5`,
      [instructorId],
    );
    const { rows: byTask } = await db.query(
      `SELECT t.id, t.title, t.due_date, t.max_score, ig.name AS group_name,
              COUNT(a.id)::int AS assigned_count,
              COUNT(a.id) FILTER (WHERE a.status IN ('submitted', 'late', 'reviewed'))::int AS submitted_count,
              COUNT(a.id) FILTER (WHERE a.status = 'pending')::int AS pending_count,
              COUNT(a.id) FILTER (WHERE a.status = 'late')::int AS late_count,
              ROUND(AVG(a.score) FILTER (WHERE a.score IS NOT NULL), 1) AS average_score
       FROM assignments t
       LEFT JOIN instructor_groups ig ON ig.id = t.group_id
       LEFT JOIN student_assignments a ON a.assignment_id = t.id
       WHERE t.instructor_id = $1
       GROUP BY t.id, t.title, t.due_date, t.max_score, ig.name
       ORDER BY t.created_at DESC`,
      [instructorId],
    );

    const base = rows[0] || {};
    const assigned = Number(base.total_assignments) || 0;
    const submitted = Number(base.total_submissions) || 0;
    res.json({
      success: true,
      analytics: {
        submission_rate: assigned > 0 ? Math.round((submitted / assigned) * 100) : 0,
        average_score: base.average_score != null ? Number(base.average_score) : null,
        late_submissions: Number(base.late_submissions) || 0,
        total_student_slots: assigned,
        total_submissions: submitted,
        top_students: top.map((r) => ({
          full_name: r.full_name,
          average_score: r.avg_score != null ? Number(r.avg_score) : null,
          reviewed_count: r.reviewed_count,
        })),
        by_assignment: byTask.map((t) => {
          const ac = Number(t.assigned_count) || 0;
          const sc = Number(t.submitted_count) || 0;
          return {
            id: t.id,
            title: t.title,
            due_date: t.due_date,
            max_score: t.max_score != null ? Number(t.max_score) : null,
            group_name: t.group_name,
            assigned_count: ac,
            submitted_count: sc,
            pending_count: Number(t.pending_count) || 0,
            late_count: Number(t.late_count) || 0,
            submission_rate: ac > 0 ? Math.round((sc / ac) * 100) : 0,
            average_score: t.average_score != null ? Number(t.average_score) : null,
          };
        }),
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const {
  isSafeAssignmentFilename,
  sendAssignmentFileToResponse,
} = require('../services/assignmentFileStorage');

/** Vercel: /api/uploads/assignments proxysiz — JWT ilə fayl çatdırılması */
const serveAssignmentFile = async (req, res) => {
  try {
    const filename = path.basename(String(req.params.filename || ''));
    if (!isSafeAssignmentFilename(filename)) {
      return res.status(400).json({ success: false, message: 'Yanlış fayl adı' });
    }

    const role = req.user.role;
    const userId = req.user.id;
    const needle = `%${filename}%`;
    if (role === 'student') {
      const { rows: allowed } = await db.query(
        `SELECT 1 FROM student_assignments sa
         JOIN assignments t ON t.id = sa.assignment_id
         WHERE sa.student_id = $1::uuid
           AND (
             COALESCE(t.question_file_url, '') LIKE $2
             OR sa.attachment_urls::text LIKE $2
           )
         LIMIT 1`,
        [userId, needle],
      );
      if (!allowed[0]) {
        return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
      }
    } else if (role === 'instructor') {
      const { rows: allowed } = await db.query(
        `SELECT 1 FROM assignments t
         WHERE t.instructor_id = $1::uuid
           AND (
             COALESCE(t.question_file_url, '') LIKE $2
             OR EXISTS (
               SELECT 1 FROM student_assignments sa
               WHERE sa.assignment_id = t.id
                 AND sa.attachment_urls::text LIKE $2
             )
           )
         LIMIT 1`,
        [userId, needle],
      );
      if (!allowed[0]) {
        return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
      }
    } else if (role !== 'admin') {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    return sendAssignmentFileToResponse(res, filename);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const listInstructorGroups = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT g.id, g.name, g.subject_id, s.name AS subject_name
       FROM instructor_groups g
       LEFT JOIN instructor_subjects s ON s.id = g.subject_id
       WHERE g.instructor_id = $1
       ORDER BY s.name NULLS LAST, g.name`,
      [req.user.id],
    );
    res.json({ success: true, groups: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Tapşırıq paylaşım linki — avtomatik icazə (qonaq / CRM olmayan tələbə) */
const postTaskAccessFromLink = async (req, res) => {
  try {
    if (req.body?.phone != null && String(req.body.phone).trim() !== '') {
      await upsertStudentContactPhone(db, req.user.id, req.body.phone);
    }
    const result = await autoGrantTaskAccessForStudent(req.user.id, req.params.id);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
};

module.exports = {
  listInstructorTasks,
  createInstructorTask,
  updateInstructorAssignment,
  deleteInstructorAssignment,
  getMyAssignment,
  saveMyAssignmentDraft,
  submitMyAssignment,
  getInstructorStudentAssignment,
  requestAiReviewSuggestion,
  reviewInstructorAssignment,
  getAssignmentAnalytics,
  listParentAssignments,
  listInstructorGroups,
  listMyTasks,
  markMyTaskDone,
  serveAssignmentFile,
  postTaskAccessFromLink,
};
