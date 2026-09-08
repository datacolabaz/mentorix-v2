const db = require('../utils/db');
const { userHasRole } = require('./userRolesService');
const {
  writeOrgAudit,
  listOrgAudit,
  listOrgMembers,
  listOrgRoles,
  updateMemberRole,
  ensureStaffMembership,
  removeMembership,
  permissionsForRole,
} = require('./orgRbacService');

const EXAM_LIFECYCLE_SQL = `CASE
  WHEN COALESCE(e.is_deleted, FALSE) = TRUE THEN 'archived'
  WHEN lower(COALESCE(e.status, '')) = 'draft' THEN 'draft'
  WHEN lower(COALESCE(e.status, '')) IN ('completed', 'ended', 'closed', 'cancelled') THEN 'completed'
  WHEN e.available_until IS NOT NULL AND e.available_until < NOW() THEN 'completed'
  WHEN e.available_from IS NOT NULL AND e.available_from > NOW() THEN 'scheduled'
  WHEN lower(COALESCE(e.status, '')) IN ('scheduled', 'planned', 'pending') THEN 'scheduled'
  WHEN lower(COALESCE(e.status, '')) = 'active' THEN 'active'
  WHEN e.available_from IS NOT NULL AND e.available_from <= NOW()
       AND (e.available_until IS NULL OR e.available_until >= NOW()) THEN 'active'
  ELSE COALESCE(NULLIF(lower(e.status), ''), 'draft')
END`;

function trainerIdsSql(alias = 'ct') {
  return `(
    SELECT ${alias}.instructor_user_id
    FROM course_teachers ${alias}
    WHERE ${alias}.course_id = $1
      AND ${alias}.is_active = TRUE
      AND ${alias}.status = 'ACTIVE'
    UNION
    SELECT c.owner_user_id FROM courses c WHERE c.id = $1
  )`;
}

function csvEscape(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers, rows) {
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }
  return `\uFEFF${lines.join('\n')}`;
}

async function listOrgExams(courseId, { status } = {}) {
  const params = [courseId];
  let where = `e.instructor_id IN ${trainerIdsSql()}`;
  if (status && status !== 'all') {
    params.push(status);
    where += ` AND ${EXAM_LIFECYCLE_SQL} = $${params.length}`;
    if (status !== 'archived') {
      where += ` AND COALESCE(e.is_deleted, FALSE) = FALSE`;
    }
  } else {
    where += ` AND COALESCE(e.is_deleted, FALSE) = FALSE`;
  }

  const { rows } = await db.query(
    `SELECT
       e.id,
       e.title,
       e.subject,
       e.status AS raw_status,
       e.available_from,
       e.available_until,
       e.start_time,
       e.created_at,
       e.instructor_id,
       u.full_name AS created_by,
       ${EXAM_LIFECYCLE_SQL} AS lifecycle,
       COUNT(DISTINCT ea.student_id)::int AS participants,
       COUNT(DISTINCT er.student_id) FILTER (WHERE er.submitted_at IS NOT NULL)::int AS completed_count,
       ROUND(AVG(er.score) FILTER (WHERE er.submitted_at IS NOT NULL))::int AS average_score
     FROM exams e
     JOIN users u ON u.id = e.instructor_id
     LEFT JOIN exam_assignments ea ON ea.exam_id = e.id
     LEFT JOIN exam_results er ON er.exam_id = e.id
     WHERE ${where}
     GROUP BY e.id, u.full_name
     ORDER BY COALESCE(e.available_from, e.start_time, e.created_at) DESC NULLS LAST`,
    params,
  );
  return rows.map((row) => ({
    ...row,
    completion:
      row.participants > 0 ? Math.round((Number(row.completed_count) / Number(row.participants)) * 100) : 0,
  }));
}

async function getExamKpis(courseId) {
  const { rows } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE lifecycle = 'active')::int AS active_exams,
       COUNT(*) FILTER (WHERE lifecycle = 'completed')::int AS completed_assessments,
       ROUND(AVG(average_score) FILTER (WHERE average_score IS NOT NULL))::int AS average_score
     FROM (
       SELECT
         ${EXAM_LIFECYCLE_SQL} AS lifecycle,
         ROUND(AVG(er.score) FILTER (WHERE er.submitted_at IS NOT NULL))::int AS average_score
       FROM exams e
       LEFT JOIN exam_results er ON er.exam_id = e.id
       WHERE e.instructor_id IN ${trainerIdsSql()}
         AND COALESCE(e.is_deleted, FALSE) = FALSE
       GROUP BY e.id
     ) x`,
    [courseId],
  );
  return rows[0] || { active_exams: 0, completed_assessments: 0, average_score: null };
}

async function listOrgParticipants(courseId, filters = {}) {
  const params = [courseId];
  const where = [`cs.course_id = $1`];
  if (filters.archived === '1' || filters.archived === 'true') {
    where.push(`cs.archived_at IS NOT NULL`);
  } else {
    where.push(`cs.archived_at IS NULL`);
  }
  if (filters.q) {
    params.push(`%${String(filters.q).trim()}%`);
    where.push(`(u.full_name ILIKE $${params.length} OR COALESCE(u.phone, '') ILIKE $${params.length} OR COALESCE(u.email, '') ILIKE $${params.length})`);
  }
  if (filters.team_id) {
    params.push(filters.team_id);
    where.push(`tm.team_id = $${params.length}`);
  }
  if (filters.group_id) {
    params.push(filters.group_id);
    where.push(`cg.id = $${params.length}`);
  }
  if (filters.status === 'inactive') {
    where.push(`COALESCE(u.is_active, TRUE) = FALSE`);
  } else if (filters.status === 'active') {
    where.push(`COALESCE(u.is_active, TRUE) = TRUE`);
  }

  const { rows } = await db.query(
    `SELECT
       u.id,
       u.full_name,
       u.phone,
       u.email,
       u.is_active,
       u.last_activity_at,
       cs.created_at,
       cs.archived_at,
       cg.id AS group_id,
       cg.name AS group_name,
       tm.team_id,
       t.name AS team_name,
       scores.avg_score,
       scores.completed_count,
       scores.assigned_count,
       CASE
         WHEN COALESCE(scores.assigned_count, 0) = 0 THEN 'none'
         WHEN COALESCE(scores.completed_count, 0) >= COALESCE(scores.assigned_count, 0) THEN 'completed'
         WHEN COALESCE(scores.started_count, 0) > 0 THEN 'in_progress'
         ELSE 'assigned'
       END AS assessment_status
     FROM course_students cs
     INNER JOIN users u ON u.id = cs.student_id
     LEFT JOIN LATERAL (
       SELECT g.id, g.name
       FROM course_group_members cgm
       INNER JOIN course_groups g ON g.id = cgm.group_id AND g.course_id = cs.course_id AND g.is_active = TRUE
         AND g.instructor_group_id IS NULL
       WHERE cgm.student_id = cs.student_id
       ORDER BY g.name
       LIMIT 1
     ) cg ON TRUE
     LEFT JOIN LATERAL (
       SELECT otm.team_id
       FROM org_team_members otm
       INNER JOIN org_teams ot ON ot.id = otm.team_id AND ot.course_id = cs.course_id AND ot.is_active = TRUE
       WHERE otm.user_id = cs.student_id
       ORDER BY ot.name
       LIMIT 1
     ) tm ON TRUE
     LEFT JOIN org_teams t ON t.id = tm.team_id
     LEFT JOIN LATERAL (
       SELECT
         ROUND(AVG(er.score) FILTER (WHERE er.submitted_at IS NOT NULL))::int AS avg_score,
         COUNT(DISTINCT ea.exam_id)::int AS assigned_count,
         COUNT(DISTINCT er.exam_id) FILTER (WHERE er.submitted_at IS NOT NULL)::int AS completed_count,
         COUNT(DISTINCT er.exam_id) FILTER (WHERE er.started_at IS NOT NULL)::int AS started_count
       FROM exam_assignments ea
       INNER JOIN exams e ON e.id = ea.exam_id AND e.instructor_id IN ${trainerIdsSql()}
         AND COALESCE(e.is_deleted, FALSE) = FALSE
       LEFT JOIN exam_results er ON er.exam_id = e.id AND er.student_id = cs.student_id
       WHERE ea.student_id = cs.student_id
     ) scores ON TRUE
     WHERE ${where.join(' AND ')}
     ORDER BY u.full_name ASC NULLS LAST`,
    params,
  );

  let out = rows;
  if (filters.assessment_status) {
    out = out.filter((r) => r.assessment_status === filters.assessment_status);
  }
  if (filters.score_min != null && filters.score_min !== '') {
    const min = Number(filters.score_min);
    out = out.filter((r) => r.avg_score != null && Number(r.avg_score) >= min);
  }
  if (filters.score_max != null && filters.score_max !== '') {
    const max = Number(filters.score_max);
    out = out.filter((r) => r.avg_score != null && Number(r.avg_score) <= max);
  }
  return out;
}

async function archiveParticipants(courseId, userIds, actorUserId) {
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
  if (!ids.length) {
    const err = new Error('İştirakçı seçin');
    err.statusCode = 400;
    throw err;
  }
  await db.query(
    `UPDATE course_students SET archived_at = NOW()
     WHERE course_id = $1 AND student_id = ANY($2::uuid[]) AND archived_at IS NULL`,
    [courseId, ids],
  );
  await writeOrgAudit({
    courseId,
    actorUserId,
    action: 'user.archived',
    targetType: 'participant',
    metadata: { count: ids.length },
  });
  return listOrgParticipants(courseId);
}

async function addParticipantsToTeam(courseId, teamId, userIds, actorUserId) {
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
  const team = await getTeamRow(courseId, teamId);
  if (!ids.length) {
    const err = new Error('İştirakçı seçin');
    err.statusCode = 400;
    throw err;
  }
  for (const userId of ids) {
    await db.query(
      `INSERT INTO org_team_members (team_id, user_id, member_kind)
       VALUES ($1, $2, 'participant')
       ON CONFLICT (team_id, user_id) DO UPDATE SET member_kind = 'participant'`,
      [team.id, userId],
    );
  }
  await writeOrgAudit({
    courseId,
    actorUserId,
    action: 'team.members_added',
    targetType: 'team',
    targetId: team.id,
    metadata: { count: ids.length },
  });
  return getTeamDetail(courseId, team.id);
}

async function addParticipantsToGroup(courseId, groupId, userIds, actorUserId) {
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
  const { rows: group } = await db.query(
    `SELECT id FROM course_groups
     WHERE id = $1 AND course_id = $2 AND is_active = TRUE AND instructor_group_id IS NULL`,
    [groupId, courseId],
  );
  if (!group[0]) {
    const err = new Error('Qrup tapılmadı');
    err.statusCode = 404;
    throw err;
  }
  if (!ids.length) {
    const err = new Error('İştirakçı seçin');
    err.statusCode = 400;
    throw err;
  }
  for (const userId of ids) {
    const { rows: st } = await db.query(
      `SELECT enrollment_id FROM course_students WHERE course_id = $1 AND student_id = $2`,
      [courseId, userId],
    );
    if (!st[0]) continue;
    await db.query(
      `INSERT INTO course_group_members (group_id, student_id, enrollment_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (group_id, student_id) DO UPDATE SET enrollment_id = COALESCE(EXCLUDED.enrollment_id, course_group_members.enrollment_id)`,
      [group[0].id, userId, st[0].enrollment_id],
    );
  }
  await writeOrgAudit({
    courseId,
    actorUserId,
    action: 'group.members_added',
    targetType: 'group',
    targetId: group[0].id,
    metadata: { count: ids.length },
  });
}

async function assignAssessments(courseId, examId, userIds, actorUserId) {
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
  const { rows: exam } = await db.query(
    `SELECT id, title FROM exams e
     WHERE e.id = $2 AND e.instructor_id IN ${trainerIdsSql()}
       AND COALESCE(e.is_deleted, FALSE) = FALSE`,
    [courseId, examId],
  );
  if (!exam[0]) {
    const err = new Error('İmtahan tapılmadı və ya bu təşkilata aid deyil');
    err.statusCode = 404;
    throw err;
  }
  if (!ids.length) {
    const err = new Error('İştirakçı seçin');
    err.statusCode = 400;
    throw err;
  }
  for (const userId of ids) {
    await db.query(
      `INSERT INTO exam_assignments (exam_id, student_id)
       VALUES ($1, $2)
       ON CONFLICT (exam_id, student_id) DO NOTHING`
      [exam[0].id, userId],
    );
  }
  await writeOrgAudit({
    courseId,
    actorUserId,
    action: 'assessment.assigned',
    targetType: 'exam',
    targetId: exam[0].id,
    metadata: { count: ids.length, title: exam[0].title },
  });
}

async function getTeamRow(courseId, teamId) {
  const { rows } = await db.query(
    `SELECT * FROM org_teams WHERE id = $1 AND course_id = $2 AND is_active = TRUE`,
    [teamId, courseId],
  );
  if (!rows[0]) {
    const err = new Error('Komanda tapılmadı');
    err.statusCode = 404;
    throw err;
  }
  return rows[0];
}

async function listOrgTeams(courseId) {
  const { rows } = await db.query(
    `SELECT
       t.id, t.name, t.description, t.created_at,
       COUNT(DISTINCT otm.user_id) FILTER (WHERE otm.member_kind = 'participant')::int AS member_count,
       COUNT(DISTINCT otm.user_id) FILTER (WHERE otm.member_kind = 'trainer')::int AS trainer_count,
       COUNT(DISTINCT cg.id)::int AS group_count,
       ROUND(AVG(er.score) FILTER (WHERE er.submitted_at IS NOT NULL))::int AS average_score,
       COALESCE(
         ROUND(
           100.0 * COUNT(DISTINCT er.exam_id) FILTER (WHERE er.submitted_at IS NOT NULL)
           / NULLIF(COUNT(DISTINCT ea.exam_id), 0)
         )::int,
         0
       ) AS completion_rate
     FROM org_teams t
     LEFT JOIN org_team_members otm ON otm.team_id = t.id
     LEFT JOIN course_groups cg ON cg.team_id = t.id AND cg.course_id = t.course_id AND cg.is_active = TRUE
     LEFT JOIN exam_assignments ea ON ea.student_id = otm.user_id
     LEFT JOIN exams e ON e.id = ea.exam_id AND e.instructor_id IN ${trainerIdsSql()}
       AND COALESCE(e.is_deleted, FALSE) = FALSE
     LEFT JOIN exam_results er ON er.exam_id = e.id AND er.student_id = otm.user_id
     WHERE t.course_id = $1 AND t.is_active = TRUE
     GROUP BY t.id
     ORDER BY t.name ASC`,
    [courseId],
  );
  return rows;
}

async function createOrgTeam(courseId, body, actorUserId) {
  const name = String(body?.name || '').trim();
  if (!name) {
    const err = new Error('Komanda adı tələb olunur');
    err.statusCode = 400;
    throw err;
  }
  const description = body?.description != null ? String(body.description).trim() : null;
  const { rows } = await db.query(
    `INSERT INTO org_teams (course_id, name, description)
     VALUES ($1, $2, $3)
     RETURNING id, name, description, created_at`,
    [courseId, name, description],
  );
  await writeOrgAudit({
    courseId,
    actorUserId,
    action: 'team.created',
    targetType: 'team',
    targetId: rows[0].id,
    metadata: { name },
  });
  return rows[0];
}

async function updateOrgTeam(courseId, teamId, body, actorUserId) {
  const team = await getTeamRow(courseId, teamId);
  const name = body?.name != null ? String(body.name).trim() : team.name;
  if (!name) {
    const err = new Error('Komanda adı tələb olunur');
    err.statusCode = 400;
    throw err;
  }
  const description = body?.description !== undefined ? String(body.description || '').trim() : team.description;
  const { rows } = await db.query(
    `UPDATE org_teams SET name = $3, description = $4, updated_at = NOW()
     WHERE id = $1 AND course_id = $2
     RETURNING id, name, description, created_at`,
    [team.id, courseId, name, description || null],
  );
  await writeOrgAudit({
    courseId,
    actorUserId,
    action: 'team.updated',
    targetType: 'team',
    targetId: team.id,
    metadata: { name },
  });
  return rows[0];
}

async function getTeamDetail(courseId, teamId) {
  const team = await getTeamRow(courseId, teamId);
  const { rows: members } = await db.query(
    `SELECT u.id, u.full_name, u.phone, u.email, u.last_activity_at, otm.member_kind, otm.created_at
     FROM org_team_members otm
     JOIN users u ON u.id = otm.user_id
     WHERE otm.team_id = $1
     ORDER BY otm.member_kind, u.full_name`,
    [team.id],
  );
  const { rows: groups } = await db.query(
    `SELECT id, name FROM course_groups
     WHERE course_id = $1 AND team_id = $2 AND is_active = TRUE
     ORDER BY name`,
    [courseId, team.id],
  );
  const exams = await listOrgExams(courseId);
  const memberIds = new Set(members.map((m) => String(m.id)));
  const assessments = exams.filter((exam) => Number(exam.participants) > 0).slice(0, 20);
  const scores = members.filter((m) => m.member_kind === 'participant');
  const { rows: stats } = await db.query(
    `SELECT
       ROUND(AVG(er.score) FILTER (WHERE er.submitted_at IS NOT NULL))::int AS average_score,
       COUNT(DISTINCT er.id) FILTER (WHERE er.submitted_at IS NOT NULL)::int AS completed_count,
       COUNT(DISTINCT ea.id)::int AS assigned_count
     FROM org_team_members otm
     LEFT JOIN exam_assignments ea ON ea.student_id = otm.user_id
     LEFT JOIN exams e ON e.id = ea.exam_id AND e.instructor_id IN ${trainerIdsSql()}
       AND COALESCE(e.is_deleted, FALSE) = FALSE
     LEFT JOIN exam_results er ON er.exam_id = e.id AND er.student_id = otm.user_id
     WHERE otm.team_id = $2`,
    [courseId, team.id],
  );
  const assigned = Number(stats[0]?.assigned_count || 0);
  const completed = Number(stats[0]?.completed_count || 0);
  return {
    ...team,
    members,
    groups,
    assessments,
    member_ids: [...memberIds],
    participant_count: scores.length,
    average_score: stats[0]?.average_score ?? null,
    completion_rate: assigned ? Math.round((completed / assigned) * 100) : 0,
  };
}

async function setTrainerTeam(courseId, trainerUserId, teamId, actorUserId) {
  if (teamId) {
    const team = await getTeamRow(courseId, teamId);
    await db.query(
      `INSERT INTO org_team_members (team_id, user_id, member_kind)
       VALUES ($1, $2, 'trainer')
       ON CONFLICT (team_id, user_id) DO UPDATE SET member_kind = 'trainer'`,
      [team.id, trainerUserId],
    );
  }
  await writeOrgAudit({
    courseId,
    actorUserId,
    action: 'trainer.team_assigned',
    targetType: 'user',
    targetId: trainerUserId,
    metadata: { team_id: teamId || null },
  });
}

async function listOrgQuestions(courseId, filters = {}) {
  const params = [courseId];
  const where = [`e.instructor_id IN ${trainerIdsSql()}`, `COALESCE(e.is_deleted, FALSE) = FALSE`];
  if (filters.q) {
    params.push(`%${String(filters.q).trim()}%`);
    where.push(`eq.question_text ILIKE $${params.length}`);
  }
  if (filters.subject) {
    params.push(filters.subject);
    where.push(`e.subject = $${params.length}`);
  }
  const { rows } = await db.query(
    `SELECT
       eq.id,
       eq.question_text,
       eq.question_type,
       eq.points,
       e.id AS exam_id,
       e.title AS exam_title,
       e.subject,
       u.full_name AS owner_name,
       e.instructor_id AS owner_id
     FROM exam_questions eq
     JOIN exams e ON e.id = eq.exam_id
     JOIN users u ON u.id = e.instructor_id
     WHERE ${where.join(' AND ')}
     ORDER BY eq.order_num ASC NULLS LAST, eq.id DESC
     LIMIT 300`,
    params,
  );
  return rows;
}

async function listOrgMaterials(courseId) {
  try {
    const { rows } = await db.query(
      `SELECT
         cm.id,
         cm.title,
         cm.original_filename,
         cm.file_type,
         cm.file_size,
         cm.created_at,
         cm.instructor_id,
         u.full_name AS owner_name
       FROM course_materials cm
       JOIN users u ON u.id = cm.instructor_id
       WHERE cm.instructor_id IN ${trainerIdsSql()}
       ORDER BY cm.created_at DESC
       LIMIT 200`,
      [courseId],
    );
    return rows;
  } catch {
    return [];
  }
}

async function getOrgAnalytics(courseId, filters = {}) {
  const params = [courseId];
  const examWhere = [`e.instructor_id IN ${trainerIdsSql()}`, `COALESCE(e.is_deleted, FALSE) = FALSE`];
  if (filters.instructor_id) {
    params.push(filters.instructor_id);
    examWhere.push(`e.instructor_id = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    examWhere.push(`COALESCE(e.available_from, e.created_at) >= $${params.length}::timestamptz`);
  }
  if (filters.to) {
    params.push(filters.to);
    examWhere.push(`COALESCE(e.available_from, e.created_at) <= $${params.length}::timestamptz`);
  }

  const { rows: summary } = await db.query(
    `SELECT
       COUNT(DISTINCT ea.student_id)::int AS participation,
       COUNT(DISTINCT er.student_id) FILTER (WHERE er.submitted_at IS NOT NULL)::int AS completion,
       ROUND(AVG(er.score) FILTER (WHERE er.submitted_at IS NOT NULL))::int AS average_score
     FROM exams e
     LEFT JOIN exam_assignments ea ON ea.exam_id = e.id
     LEFT JOIN exam_results er ON er.exam_id = e.id
     WHERE ${examWhere.join(' AND ')}`,
    params,
  );

  const { rows: distribution } = await db.query(
    `SELECT
       width_bucket(er.score, 0, 100, 5) AS bucket,
       COUNT(*)::int AS count
     FROM exam_results er
     JOIN exams e ON e.id = er.exam_id
     WHERE ${examWhere.join(' AND ')} AND er.submitted_at IS NOT NULL AND er.score IS NOT NULL
     GROUP BY 1
     ORDER BY 1`,
    params,
  );

  const { rows: trends } = await db.query(
    `SELECT date_trunc('week', er.submitted_at)::date AS week,
            ROUND(AVG(er.score))::int AS average_score,
            COUNT(*)::int AS completed
     FROM exam_results er
     JOIN exams e ON e.id = er.exam_id
     WHERE ${examWhere.join(' AND ')} AND er.submitted_at IS NOT NULL
       AND er.submitted_at >= NOW() - INTERVAL '12 weeks'
     GROUP BY 1
     ORDER BY 1`,
    params,
  );

  const teams = await listOrgTeams(courseId);
  const exams = await listOrgExams(courseId, {});
  let participants = await listOrgParticipants(courseId, {});
  if (filters.team_id) {
    participants = participants.filter((p) => String(p.team_id) === String(filters.team_id));
  }
  if (filters.group_id) {
    participants = participants.filter((p) => String(p.group_id) === String(filters.group_id));
  }

  const buckets = [
    { label: '0–20', count: 0 },
    { label: '21–40', count: 0 },
    { label: '41–60', count: 0 },
    { label: '61–80', count: 0 },
    { label: '81–100', count: 0 },
  ];
  for (const row of distribution) {
    const idx = Math.min(Math.max(Number(row.bucket) - 1, 0), 4);
    buckets[idx].count += Number(row.count) || 0;
  }

  return {
    summary: summary[0] || { participation: 0, completion: 0, average_score: null },
    score_distribution: buckets,
    trends,
    teams: teams.map((t) => ({
      id: t.id,
      name: t.name,
      average_score: t.average_score,
      completion_rate: t.completion_rate,
      member_count: t.member_count,
    })),
    assessments: exams.slice(0, 30).map((e) => ({
      id: e.id,
      name: e.title,
      average_score: e.average_score,
      completion: e.completion,
      participants: e.participants,
      created_by: e.created_by,
      lifecycle: e.lifecycle,
    })),
    participants: participants.slice(0, 40).map((p) => ({
      id: p.id,
      name: p.full_name,
      team_name: p.team_name,
      group_name: p.group_name,
      avg_score: p.avg_score,
      assessment_status: p.assessment_status,
      last_activity_at: p.last_activity_at,
    })),
  };
}

async function listTrainerDetail(courseId, trainerUserId) {
  const { rows: exams } = await db.query(
    `SELECT e.id, e.title, e.created_at, ${EXAM_LIFECYCLE_SQL} AS lifecycle
     FROM exams e
     WHERE e.instructor_id = $1 AND COALESCE(e.is_deleted, FALSE) = FALSE
     ORDER BY e.created_at DESC
     LIMIT 50`,
    [trainerUserId],
  );
  const { rows: activity } = await db.query(
    `SELECT last_activity_at, full_name, phone, email FROM users WHERE id = $1`,
    [trainerUserId],
  );
  return {
    trainer: activity[0] || null,
    created_assessments: exams,
  };
}

async function getOrgOverview(courseId, actorUserId) {
  const [participants, trainersRow, examKpis, teams, exams, recentParticipants, audit, canTeach] =
    await Promise.all([
      db.query(
        `SELECT COUNT(*)::int AS c FROM course_students cs
         JOIN users u ON u.id = cs.student_id
         WHERE cs.course_id = $1 AND cs.archived_at IS NULL AND COALESCE(u.is_active, TRUE) = TRUE`,
        [courseId],
      ),
      db.query(
        `SELECT COUNT(*)::int AS c FROM course_teachers ct
         JOIN users u ON u.id = ct.instructor_user_id
         WHERE ct.course_id = $1 AND ct.is_active = TRUE AND ct.status = 'ACTIVE' AND COALESCE(u.is_active, TRUE) = TRUE`,
        [courseId],
      ),
      getExamKpis(courseId),
      listOrgTeams(courseId),
      listOrgExams(courseId),
      listOrgParticipants(courseId, {}).then((rows) => rows.slice(0, 8)),
      listOrgAudit(courseId, { limit: 12 }),
      userHasRole(actorUserId, 'instructor'),
    ]);

  const activeExams = exams.filter((e) => e.lifecycle === 'active').slice(0, 8);
  const upcomingExams = exams.filter((e) => e.lifecycle === 'scheduled').slice(0, 8);
  const examResults = exams
    .filter((e) => e.completed_count > 0)
    .slice(0, 8)
    .map((e) => ({
      id: e.id,
      name: e.title,
      average_score: e.average_score,
      completion: e.completion,
      participants: e.participants,
      created_by: e.created_by,
    }));

  return {
    kpis: {
      active_participants: participants.rows[0]?.c ?? 0,
      active_trainers: trainersRow.rows[0]?.c ?? 0,
      active_exams: examKpis.active_exams ?? 0,
      completed_assessments: examKpis.completed_assessments ?? 0,
      average_score: examKpis.average_score,
    },
    recent_activity: audit,
    active_exams: activeExams,
    upcoming_exams: upcomingExams,
    team_performance: teams.slice(0, 8),
    exam_results: examResults,
    recent_participants: recentParticipants,
    capabilities: {
      instructor_exam_workspace: Boolean(canTeach),
    },
  };
}

async function listOrgNotifications(userId) {
  try {
    const { rows } = await db.query(
      `SELECT id, title, body, type, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId],
    );
    return rows;
  } catch {
    return [];
  }
}

async function exportParticipantsCsv(courseId, filters) {
  const rows = await listOrgParticipants(courseId, filters);
  return toCsv(
    ['full_name', 'phone', 'email', 'team_name', 'group_name', 'assessment_status', 'avg_score', 'last_activity_at'],
    rows,
  );
}

async function exportExamsCsv(courseId, filters) {
  const rows = await listOrgExams(courseId, filters);
  return toCsv(
    ['title', 'created_by', 'participants', 'completion', 'average_score', 'lifecycle', 'available_from'],
    rows.map((r) => ({
      title: r.title,
      created_by: r.created_by,
      participants: r.participants,
      completion: r.completion,
      average_score: r.average_score,
      lifecycle: r.lifecycle,
      available_from: r.available_from,
    })),
  );
}

async function exportAnalyticsCsv(courseId, filters) {
  const data = await getOrgAnalytics(courseId, filters);
  return toCsv(
    ['name', 'team_name', 'group_name', 'avg_score', 'assessment_status'],
    data.participants.map((p) => ({
      name: p.name,
      team_name: p.team_name,
      group_name: p.group_name,
      avg_score: p.avg_score,
      assessment_status: p.assessment_status,
    })),
  );
}

module.exports = {
  listOrgExams,
  listOrgParticipants,
  archiveParticipants,
  addParticipantsToTeam,
  addParticipantsToGroup,
  assignAssessments,
  listOrgTeams,
  createOrgTeam,
  updateOrgTeam,
  getTeamDetail,
  setTrainerTeam,
  listOrgQuestions,
  listOrgMaterials,
  getOrgAnalytics,
  listTrainerDetail,
  getOrgOverview,
  listOrgNotifications,
  exportParticipantsCsv,
  exportExamsCsv,
  exportAnalyticsCsv,
  listOrgAudit,
  listOrgMembers,
  listOrgRoles,
  updateMemberRole,
  ensureStaffMembership,
  removeMembership,
  permissionsForRole,
  writeOrgAudit,
};
