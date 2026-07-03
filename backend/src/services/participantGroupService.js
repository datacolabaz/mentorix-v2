const db = require('../utils/db');
const {
  friendlyParticipantLabel,
  participantKindFromSystemKind,
  displayGroupLabel,
} = require('../lib/participantGroupLabels');
const { batchCrmStudentIds } = require('./crmStudentService');

const SYSTEM_SUBJECT_NAME = 'Link iştirakçıları';
const SYSTEM_KIND_EXAM = 'exam_participants';
const SYSTEM_KIND_ASSIGNMENT = 'assignment_participants';

const normHex = (id) => (id == null ? '' : String(id).trim().toLowerCase().replace(/-/g, ''));

function buildParticipantGroupName(title) {
  const base = String(title || '').trim() || 'İştirakçılar';
  const max = 200;
  return base.length > max ? `${base.slice(0, max - 1)}…` : base;
}

async function ensureSystemParticipantSubject(client, instructorId) {
  const { rows } = await client.query(
    `SELECT id, name FROM instructor_subjects
     WHERE instructor_id = $1::uuid AND is_system = TRUE
     ORDER BY created_at ASC NULLS LAST
     LIMIT 1`,
    [instructorId],
  );
  if (rows[0]?.id) return rows[0];

  const { rows: mx } = await client.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM instructor_subjects WHERE instructor_id = $1::uuid`,
    [instructorId],
  );
  const sortOrder = Number(mx[0]?.n) || 9999;
  const { rows: ins } = await client.query(
    `INSERT INTO instructor_subjects (instructor_id, name, sort_order, is_system)
     VALUES ($1::uuid, $2, $3, TRUE)
     RETURNING id, name`,
    [instructorId, SYSTEM_SUBJECT_NAME, sortOrder],
  );
  return ins[0];
}

async function createSystemParticipantGroup(client, {
  instructorId,
  title,
  systemKind,
  systemRefId,
  linkTable,
  linkColumn,
}) {
  if (!instructorId || !systemRefId || !systemKind) return null;

  const { rows: linked } = await client.query(
    `SELECT participant_group_id FROM ${linkTable} WHERE id = $1::uuid LIMIT 1`,
    [systemRefId],
  );
  if (linked[0]?.participant_group_id) {
    const { rows: g } = await client.query(
      `SELECT id, subject_id, name, is_system FROM instructor_groups WHERE id = $1::uuid LIMIT 1`,
      [linked[0].participant_group_id],
    );
    return g[0] || { id: linked[0].participant_group_id };
  }

  const { rows: existing } = await client.query(
    `SELECT id, subject_id, name FROM instructor_groups
     WHERE instructor_id = $1::uuid
       AND is_system = TRUE
       AND system_kind = $2
       AND system_ref_id = $3::uuid
     LIMIT 1`,
    [instructorId, systemKind, systemRefId],
  );
  if (existing[0]?.id) {
    await client.query(
      `UPDATE ${linkTable} SET ${linkColumn} = $2::uuid WHERE id = $1::uuid AND participant_group_id IS NULL`,
      [systemRefId, existing[0].id],
    );
    return existing[0];
  }

  const subject = await ensureSystemParticipantSubject(client, instructorId);
  const groupName = buildParticipantGroupName(title);

  const { rows: mxg } = await client.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM instructor_groups WHERE subject_id = $1::uuid`,
    [subject.id],
  );
  const sortOrder = Number(mxg[0]?.n) || 0;

  const { rows: ins } = await client.query(
    `INSERT INTO instructor_groups (
       instructor_id, subject_id, name, sort_order, is_system, system_kind, system_ref_id,
       default_notifications_enabled, default_lesson_weekdays, default_lesson_times, default_lesson_end_times
     ) VALUES ($1::uuid, $2::uuid, $3, $4, TRUE, $5, $6::uuid, FALSE, '[]'::jsonb, '{}'::jsonb, '{}'::jsonb)
     RETURNING id, subject_id, name, is_system`,
    [instructorId, subject.id, groupName, sortOrder, systemKind, systemRefId],
  );
  const group = ins[0];
  if (group?.id) {
    await client.query(
      `UPDATE ${linkTable} SET ${linkColumn} = $2::uuid WHERE id = $1::uuid`,
      [systemRefId, group.id],
    );
  }
  return group;
}

async function ensureExamParticipantGroup(client, instructorId, examId, examTitle) {
  return createSystemParticipantGroup(client, {
    instructorId,
    title: examTitle,
    systemKind: SYSTEM_KIND_EXAM,
    systemRefId: examId,
    linkTable: 'exams',
    linkColumn: 'participant_group_id',
  });
}

async function ensureAssignmentParticipantGroup(client, instructorId, assignmentId, assignmentTitle) {
  return createSystemParticipantGroup(client, {
    instructorId,
    title: assignmentTitle,
    systemKind: SYSTEM_KIND_ASSIGNMENT,
    systemRefId: assignmentId,
    linkTable: 'assignments',
    linkColumn: 'participant_group_id',
  });
}

async function resolveParticipantGroupForExam(client, examId) {
  const { rows } = await client.query(
    `SELECT e.id, e.instructor_id, e.title, e.participant_group_id,
            g.subject_id AS participant_subject_id
     FROM exams e
     LEFT JOIN instructor_groups g ON g.id = e.participant_group_id
     WHERE e.id = $1::uuid
     LIMIT 1`,
    [examId],
  );
  const exam = rows[0];
  if (!exam) return null;
  if (exam.participant_group_id) {
    return {
      groupId: exam.participant_group_id,
      subjectId: exam.participant_subject_id,
      instructorId: exam.instructor_id,
      sourceRefId: exam.id,
    };
  }
  const group = await ensureExamParticipantGroup(client, exam.instructor_id, exam.id, exam.title);
  return group
    ? {
        groupId: group.id,
        subjectId: group.subject_id,
        instructorId: exam.instructor_id,
        sourceRefId: exam.id,
      }
    : null;
}

async function resolveParticipantGroupForAssignment(client, assignmentId) {
  const { rows } = await client.query(
    `SELECT a.id, a.instructor_id, a.title, a.participant_group_id,
            g.subject_id AS participant_subject_id
     FROM assignments a
     LEFT JOIN instructor_groups g ON g.id = a.participant_group_id
     WHERE a.id = $1::uuid
     LIMIT 1`,
    [assignmentId],
  );
  const task = rows[0];
  if (!task) return null;
  if (task.participant_group_id) {
    return {
      groupId: task.participant_group_id,
      subjectId: task.participant_subject_id,
      instructorId: task.instructor_id,
      sourceRefId: task.id,
    };
  }
  const group = await ensureAssignmentParticipantGroup(
    client,
    task.instructor_id,
    task.id,
    task.title,
  );
  return group
    ? {
        groupId: group.id,
        subjectId: group.subject_id,
        instructorId: task.instructor_id,
        sourceRefId: task.id,
      }
    : null;
}

async function ensureStudentInParticipantGroup(client, {
  instructorId,
  studentId,
  groupId,
  subjectId,
  enrollmentSource,
  sourceRefId,
}) {
  if (!instructorId || !studentId || !groupId || !subjectId) return null;
  const source = String(enrollmentSource || 'exam').trim().toLowerCase();

  await client.query(
    `INSERT INTO instructor_group_members (
       instructor_id, student_id, group_id, subject_id, membership_source, source_ref_id
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::uuid)
     ON CONFLICT (group_id, student_id) DO NOTHING`,
    [instructorId, studentId, groupId, subjectId, source, sourceRefId || null],
  );

  const ni = normHex(instructorId);
  const { rows: enr } = await client.query(
    `SELECT id, group_id, status FROM enrollments
     WHERE student_id = $1::uuid
       AND REPLACE(LOWER(TRIM(instructor_id::text)), '-', '') = $2
       AND (deleted_at IS NULL)
       AND COALESCE(LOWER(TRIM(status)), '') NOT IN ('rejected', 'left', 'archived')
     LIMIT 1`,
    [studentId, ni],
  );

  if (enr[0]?.id) {
    if (!enr[0].group_id) {
      await client.query(
        `UPDATE enrollments
         SET group_id = $2::uuid,
             subject_id = $3::uuid,
             enrollment_source = $4,
             status = 'active',
             configured_at = COALESCE(configured_at, NOW()),
             notifications_enabled = FALSE
         WHERE id = $1::uuid`,
        [enr[0].id, groupId, subjectId, source],
      );
    } else if (String(enr[0].status || '').toLowerCase() === 'pending_setup') {
      await client.query(
        `UPDATE enrollments
         SET status = 'active', configured_at = COALESCE(configured_at, NOW()), notifications_enabled = FALSE
         WHERE id = $1::uuid`,
        [enr[0].id],
      );
    }
    return enr[0].id;
  }

  const { rows: ins } = await client.query(
    `INSERT INTO enrollments (
       instructor_id, student_id, status, enrolled_at, enrollment_source,
       group_id, subject_id, notifications_enabled, configured_at
     ) VALUES ($1::uuid, $2::uuid, 'active', NOW(), $3, $4::uuid, $5::uuid, FALSE, NOW())
     RETURNING id`,
    [instructorId, studentId, source, groupId, subjectId],
  );
  return ins[0]?.id || null;
}

async function addStudentToExamParticipantGroup(client, examId, studentId) {
  const ctx = await resolveParticipantGroupForExam(client, examId);
  if (!ctx?.groupId) return null;
  return ensureStudentInParticipantGroup(client, {
    instructorId: ctx.instructorId,
    studentId,
    groupId: ctx.groupId,
    subjectId: ctx.subjectId,
    enrollmentSource: 'exam',
    sourceRefId: ctx.sourceRefId,
  });
}

async function addStudentToAssignmentParticipantGroup(client, assignmentId, studentId) {
  const ctx = await resolveParticipantGroupForAssignment(client, assignmentId);
  if (!ctx?.groupId) return null;
  return ensureStudentInParticipantGroup(client, {
    instructorId: ctx.instructorId,
    studentId,
    groupId: ctx.groupId,
    subjectId: ctx.subjectId,
    enrollmentSource: 'task',
    sourceRefId: ctx.sourceRefId,
  });
}

function guestCohortFieldsFromMember(m) {
  const sourceTitle = m.exam_title || m.assignment_title || null;
  const baseTitle = displayGroupLabel({
    name: m.track_group_name,
    is_system: true,
    system_kind: m.system_kind,
    exam_title: sourceTitle,
    assignment_title: m.assignment_title,
  });
  const participantKind = participantKindFromSystemKind(m.system_kind) || 'exam';
  const cohortLabel =
    participantKind === 'task' ? `${baseTitle} — Qonaq (Tapşırıq)` : `${baseTitle} — Qonaq`;
  return {
    track_group_name: baseTitle,
    track_subject_name:
      participantKind === 'task' ? 'Qonaq tapşırıq iştirakçıları' : 'Qonaq imtahan iştirakçıları',
    is_participant_group_row: true,
    is_guest_participant_row: true,
    is_crm_student: false,
    is_system_group: Boolean(m.is_system),
    participant_kind: participantKind,
    participant_cohort_label: cohortLabel,
    participant_ref_id: m.system_ref_id || null,
    link_join_badge: true,
  };
}

async function expandStudentsWithParticipantGroups(students, instructorId) {
  if (!Array.isArray(students) || !students.length || !instructorId) return students;
  const ni = normHex(instructorId);
  let memberRows = [];
  try {
    const { rows } = await db.query(
      `SELECT igm.student_id, igm.group_id, igm.subject_id, igm.joined_at, igm.membership_source,
              ig.name AS track_group_name, ist.name AS track_subject_name, ig.is_system,
              ig.system_kind, ig.system_ref_id,
              e.title AS exam_title, a.title AS assignment_title
       FROM instructor_group_members igm
       JOIN instructor_groups ig ON ig.id = igm.group_id
       LEFT JOIN instructor_subjects ist ON ist.id = igm.subject_id
       LEFT JOIN exams e ON ig.system_kind = 'exam_participants' AND e.id = ig.system_ref_id
       LEFT JOIN assignments a ON ig.system_kind = 'assignment_participants' AND a.id = ig.system_ref_id
       WHERE REPLACE(LOWER(TRIM(igm.instructor_id::text)), '-', '') = $1`,
      [ni],
    );
    memberRows = rows;
  } catch (e) {
    if (!/instructor_group_members/i.test(String(e.message || ''))) return students;
    throw e;
  }
  if (!memberRows.length) return students;

  const crmIds = await batchCrmStudentIds(
    instructorId,
    students.map((s) => s.id).concat(memberRows.map((m) => m.student_id)),
  );
  const byStudent = new Map(students.map((s) => [String(s.id), s]));
  const extra = [];
  for (const m of memberRows) {
    if (crmIds.has(String(m.student_id))) continue;
    const base = byStudent.get(String(m.student_id));
    if (!base) continue;

    if (String(base.group_id || '') === String(m.group_id)) {
      if (m.is_system) {
        Object.assign(base, guestCohortFieldsFromMember(m), {
          enrollment_source: m.membership_source || base.enrollment_source,
          enrolled_at: m.joined_at || base.enrolled_at,
        });
      }
      continue;
    }
    if (
      String(base.track_group_name || '').trim() === String(m.track_group_name || '').trim() &&
      !base.is_participant_group_row
    ) {
      continue;
    }
    extra.push({
      ...base,
      enrollment_id: `${base.enrollment_id || base.id}-pg-${m.group_id}`,
      group_id: m.group_id,
      subject_id: m.subject_id,
      enrollment_source: m.membership_source || base.enrollment_source,
      enrolled_at: m.joined_at || base.enrolled_at,
      ...guestCohortFieldsFromMember(m),
    });
  }
  return extra.length ? [...students, ...extra] : students;
}

async function promoteParticipantToCrmGroup(client, {
  instructorId,
  studentId,
  systemGroupId,
  targetGroupId,
}) {
  const { assertGroupMutable, fetchGroupGuard } = require('./systemGroupGuards');
  const { getGroupInviteDefaults, assertGroupDefaultsReady } = require('./groupInviteDefaults');
  const { activateEnrollmentFromGroupDefaults } = require('./enrollmentActivationService');

  const sysGrp = await fetchGroupGuard(client, systemGroupId, instructorId);
  if (!sysGrp?.is_system) {
    const err = new Error('Yalnız sistem iştirakçı qrupundan köçürmə mümkündür');
    err.statusCode = 400;
    throw err;
  }
  await assertGroupMutable(targetGroupId, instructorId, 'promote_target', client);

  const { rows: tgtRows } = await client.query(
    `SELECT id, name, subject_id FROM instructor_groups
     WHERE id = $1::uuid AND instructor_id = $2::uuid LIMIT 1`,
    [targetGroupId, instructorId],
  );
  const targetGroup = tgtRows[0];
  if (!targetGroup) {
    const err = new Error('Hədəf qrup tapılmadı');
    err.statusCode = 404;
    throw err;
  }

  const { rows: member } = await client.query(
    `SELECT 1 FROM instructor_group_members
     WHERE group_id = $1::uuid AND student_id = $2::uuid LIMIT 1`,
    [systemGroupId, studentId],
  );
  if (!member[0]) {
    const err = new Error('Tələbə bu iştirakçı qrupunda deyil');
    err.statusCode = 400;
    throw err;
  }

  const { rows: enr } = await client.query(
    `SELECT id FROM enrollments
     WHERE student_id = $1::uuid AND instructor_id = $2::uuid
       AND (deleted_at IS NULL)
       AND COALESCE(LOWER(TRIM(status)), '') NOT IN ('rejected', 'left', 'archived')
     LIMIT 1`,
    [studentId, instructorId],
  );
  if (!enr[0]?.id) {
    const err = new Error('Tələbə qeydiyyatı tapılmadı');
    err.statusCode = 404;
    throw err;
  }

  const defaults = await getGroupInviteDefaults(targetGroupId);
  assertGroupDefaultsReady(defaults);

  await activateEnrollmentFromGroupDefaults(client, {
    enrollmentId: enr[0].id,
    studentId,
    instructorId,
    groupId: targetGroupId,
    subjectId: targetGroup.subject_id,
    defaults: { ...defaults, source: 'promoted_from_participant' },
  });

  await client.query(`UPDATE enrollments SET enrollment_source = 'group' WHERE id = $1::uuid`, [
    enr[0].id,
  ]);

  await client.query(
    `DELETE FROM instructor_group_members WHERE group_id = $1::uuid AND student_id = $2::uuid`,
    [systemGroupId, studentId],
  );

  const { rows: urows } = await client.query(`SELECT full_name FROM users WHERE id = $1::uuid LIMIT 1`, [
    studentId,
  ]);

  return {
    enrollment_id: enr[0].id,
    student_id: studentId,
    student_name: urows[0]?.full_name || 'Tələbə',
    system_group_id: systemGroupId,
    system_group_name: sysGrp.name,
    target_group_id: targetGroupId,
    target_group_name: targetGroup.name,
  };
}

async function listParticipantCohorts(instructorId) {
  if (!instructorId) return [];
  const ni = normHex(instructorId);
  try {
    const { rows } = await db.query(
      `SELECT ig.id AS group_id, ig.name AS group_name, ig.system_kind, ig.system_ref_id,
              e.title AS exam_title, a.title AS assignment_title,
              COUNT(DISTINCT igm.student_id)::int AS student_count,
              COUNT(DISTINCT igm.student_id) FILTER (
                WHERE EXISTS (
                  SELECT 1 FROM enrollments en
                  JOIN instructor_groups ig2 ON ig2.id = en.group_id
                  WHERE en.student_id = igm.student_id
                    AND en.instructor_id = ig.instructor_id
                    AND en.deleted_at IS NULL
                    AND en.group_id IS NOT NULL
                    AND COALESCE(ig2.is_system, FALSE) = FALSE
                )
              )::int AS crm_count,
              COUNT(DISTINCT igm.student_id) FILTER (
                WHERE NOT EXISTS (
                  SELECT 1 FROM enrollments en
                  JOIN instructor_groups ig2 ON ig2.id = en.group_id
                  WHERE en.student_id = igm.student_id
                    AND en.instructor_id = ig.instructor_id
                    AND en.deleted_at IS NULL
                    AND en.group_id IS NOT NULL
                    AND COALESCE(ig2.is_system, FALSE) = FALSE
                )
              )::int AS guest_count
       FROM instructor_groups ig
       LEFT JOIN instructor_group_members igm ON igm.group_id = ig.id
       LEFT JOIN exams e ON ig.system_kind = 'exam_participants' AND e.id = ig.system_ref_id
       LEFT JOIN assignments a ON ig.system_kind = 'assignment_participants' AND a.id = ig.system_ref_id
       WHERE REPLACE(LOWER(TRIM(ig.instructor_id::text)), '-', '') = $1
         AND COALESCE(ig.is_system, FALSE) = TRUE
       GROUP BY ig.id, ig.name, ig.system_kind, ig.system_ref_id, e.title, a.title, ig.instructor_id
       ORDER BY ig.name ASC`,
      [ni],
    );
    return rows.map((r) => {
      const sourceTitle = r.exam_title || r.assignment_title || null;
      const baseTitle =
        String(sourceTitle || '').trim() ||
        friendlyParticipantLabel({ group_name: r.group_name }).replace(/\s*\([^)]*\)\s*$/, '');
      const kind = participantKindFromSystemKind(r.system_kind) || 'exam';
      const crmCount = Number(r.crm_count) || 0;
      const guestCount = Number(r.guest_count) || 0;
      return {
        group_id: r.group_id,
        label:
          kind === 'task' ? `${baseTitle} (Tapşırıq)` : `${baseTitle} (İmtahan)`,
        guest_label: kind === 'task' ? `${baseTitle} — Qonaq` : `${baseTitle} — Qonaq`,
        kind,
        ref_id: r.system_ref_id,
        student_count: Number(r.student_count) || 0,
        crm_count: crmCount,
        guest_count: guestCount,
        exam_title: r.exam_title || null,
        assignment_title: r.assignment_title || null,
      };
    });
  } catch (e) {
    if (!/instructor_group_members|participant_group_id/i.test(String(e.message || ''))) return [];
    throw e;
  }
}

module.exports = {
  SYSTEM_SUBJECT_NAME,
  SYSTEM_KIND_EXAM,
  SYSTEM_KIND_ASSIGNMENT,
  buildParticipantGroupName,
  ensureExamParticipantGroup,
  ensureAssignmentParticipantGroup,
  ensureStudentInParticipantGroup,
  addStudentToExamParticipantGroup,
  addStudentToAssignmentParticipantGroup,
  resolveParticipantGroupForExam,
  resolveParticipantGroupForAssignment,
  expandStudentsWithParticipantGroups,
  listParticipantCohorts,
  promoteParticipantToCrmGroup,
};
