const db = require('../utils/db');
const {
  decorateGroupInvitationFields,
  buildInvitationLink,
} = require('../services/joinInvitationService');
const { parseGroupDefaultsPayload, rowToDefaults } = require('../services/groupInviteDefaults');
const {
  assertGroupMutable,
  assertSubjectMutable,
  isReservedSystemSubjectName,
} = require('../services/systemGroupGuards');
const { promoteParticipantToCrmGroup, listParticipantCohorts } = require('../services/participantGroupService');

function parsePublicLabel(v) {
  const s = String(v || '').trim().toLowerCase();
  if (s === 'trainer' || s === 'telimci' || s === 'təlimçi') return 'trainer';
  return 'instructor';
}

function looksUuid(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(s || '').trim());
}

/** Tələbələr siyahısı ilə eyni müqayisə (JWT UUID format fərqləri) */
function normalizedInstructorId(userId) {
  return String(userId || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '');
}

const INSTRUCTOR_ID_MATCH = `REPLACE(LOWER(TRIM(%COL%::text)), '-', '')`;

function instructorIdWhere(column, paramIndex = 1) {
  return `${INSTRUCTOR_ID_MATCH.replace('%COL%', column)} = $${paramIndex}`;
}

async function loadInstructorGroups(instructorUserId) {
  const iidNorm = normalizedInstructorId(instructorUserId);
  const baseCols = `id, subject_id, name, sort_order, join_code, join_code_expires_at,
              invitation_code, invitation_link, is_system, system_kind, system_ref_id,
              default_billing_type, default_package_fee, default_discount_percent,
              default_billing_timing, default_payment_plan, default_lesson_weekdays,
              default_lesson_times, default_notifications_enabled, default_initial_payment_status`;
  const withEndTimes = `${baseCols}, default_lesson_end_times`;
  try {
    const { rows } = await db.query(
      `SELECT ${withEndTimes}
       FROM instructor_groups
       WHERE ${instructorIdWhere('instructor_id', 1)}
       ORDER BY sort_order ASC, name ASC`,
      [iidNorm],
    );
    return rows;
  } catch (err) {
    const msg = String(err?.message || '');
    if (!/default_lesson_end_times|does not exist/i.test(msg)) throw err;
    const { rows } = await db.query(
      `SELECT ${baseCols}
       FROM instructor_groups
       WHERE ${instructorIdWhere('instructor_id', 1)}
       ORDER BY sort_order ASC, name ASC`,
      [iidNorm],
    );
    return rows.map((g) => ({ ...g, default_lesson_end_times: {} }));
  }
}

async function generateUniqueJoinCode() {
  // Format: MX-12345
  for (let i = 0; i < 50; i++) {
    const code = `MX-${String(Math.floor(Math.random() * 100000)).padStart(5, '0')}`;
    const { rows } = await db.query(
      `SELECT 1 FROM instructor_groups WHERE join_code = $1 LIMIT 1`,
      [code],
    );
    if (!rows[0]) return code;
  }
  throw new Error('Join code yaradıla bilmədi');
}

/** Müəllim: görünən ad + sahə/qrup siyahısı */
const getTeaching = async (req, res) => {
  try {
    const iid = req.user.id;
    const iidNorm = normalizedInstructorId(iid);

    // Köhnə məlumat: sahə başqa instructor_id ilə qalıbsa, aktiv qruplar/tələbələrə görə düzəlt
    await db.query(
      `UPDATE instructor_subjects ist
       SET instructor_id = $2::uuid
       WHERE ist.id IN (
         SELECT DISTINCT g.subject_id
         FROM instructor_groups g
         WHERE ${instructorIdWhere('g.instructor_id', 1)}
           AND g.subject_id IS NOT NULL
         UNION
         SELECT DISTINCT e.subject_id
         FROM enrollments e
         WHERE ${instructorIdWhere('e.instructor_id', 1)}
           AND e.deleted_at IS NULL
           AND e.subject_id IS NOT NULL
       )
       AND NOT (${instructorIdWhere('ist.instructor_id', 1)})`,
      [iidNorm, iid],
    ).catch(() => {});

    const { rows: prof } = await db.query(
      `SELECT COALESCE(NULLIF(TRIM(public_label), ''), 'instructor') AS public_label,
              latitude,
              longitude,
              COALESCE(NULLIF(TRIM(map_profile_kind), ''), 'teacher') AS map_profile_kind,
              COALESCE(map_visible, TRUE) AS map_visible,
              COALESCE(map_search_radius_km, 10) AS map_search_radius_km,
              avatar_url
       FROM instructor_profiles WHERE user_id = $1`,
      [iid]
    );
    const p = prof[0];
    const public_label = parsePublicLabel(p?.public_label);

    const { rows: subjects } = await db.query(
      `SELECT DISTINCT ist.id, ist.name, ist.sort_order, COALESCE(ist.is_system, FALSE) AS is_system
       FROM instructor_subjects ist
       WHERE ${instructorIdWhere('ist.instructor_id', 1)}
          OR ist.id IN (
            SELECT e.subject_id
            FROM enrollments e
            WHERE ${instructorIdWhere('e.instructor_id', 1)}
              AND e.deleted_at IS NULL
              AND e.subject_id IS NOT NULL
          )
          OR ist.id IN (
            SELECT g.subject_id
            FROM instructor_groups g
            WHERE ${instructorIdWhere('g.instructor_id', 1)}
              AND g.subject_id IS NOT NULL
          )
       ORDER BY ist.sort_order ASC, ist.name ASC`,
      [iidNorm],
    );
    const { rows: subjectStats } = await db.query(
      `WITH students_by_subject AS (
         SELECT e.subject_id, COUNT(DISTINCT e.student_id)::int AS student_count
         FROM enrollments e
         WHERE ${instructorIdWhere('e.instructor_id', 1)}
           AND e.deleted_at IS NULL
           AND e.subject_id IS NOT NULL
           AND COALESCE(LOWER(TRIM(e.status)), 'active') IN ('active', 'pending_setup', 'pending_approval')
         GROUP BY e.subject_id
       ),
       income_by_subject AS (
         SELECT e.subject_id, COALESCE(SUM(p.amount), 0)::numeric AS income_this_month
         FROM payments p
         INNER JOIN enrollments e ON e.id = p.enrollment_id
         WHERE ${instructorIdWhere('e.instructor_id', 1)}
           AND e.deleted_at IS NULL
           AND e.subject_id IS NOT NULL
           AND p.status = 'completed'
           AND (p.notes IS NULL OR TRIM(p.notes) NOT LIKE '[Balans düzəlişi]%')
           AND COALESCE(p.payment_date::timestamptz, p.paid_at, NOW()) >= date_trunc('month', NOW())
         GROUP BY e.subject_id
       )
       SELECT COALESCE(s.subject_id, i.subject_id) AS subject_id,
              COALESCE(s.student_count, 0) AS student_count,
              COALESCE(i.income_this_month, 0) AS income_this_month
       FROM students_by_subject s
       FULL OUTER JOIN income_by_subject i ON i.subject_id = s.subject_id`,
      [iidNorm],
    );
    const statsBySubject = new Map(
      subjectStats.map((r) => [
        String(r.subject_id),
        {
          student_count: Number(r.student_count) || 0,
          income_this_month: Number(r.income_this_month) || 0,
        },
      ]),
    );
    const groups = await loadInstructorGroups(iid);
    const byId = new Map(
      subjects.map((s) => {
        const st = statsBySubject.get(String(s.id)) || { student_count: 0, income_this_month: 0 };
        return {
          id: s.id,
          name: s.name,
          sort_order: s.sort_order,
          is_system: Boolean(s.is_system),
          student_count: st.student_count,
          income_this_month: st.income_this_month,
          groups: [],
        };
      }),
    );
    for (const g of groups) {
      if (!g?.id) continue;
      let bucket = byId.get(String(g.subject_id));
      if (!bucket && g.subject_id) {
        const { rows: subRows } = await db.query(
          `SELECT id, name, sort_order, COALESCE(is_system, FALSE) AS is_system FROM instructor_subjects WHERE id = $1 LIMIT 1`,
          [g.subject_id],
        );
        if (subRows[0]) {
          const st = statsBySubject.get(String(subRows[0].id)) || {
            student_count: 0,
            income_this_month: 0,
          };
          bucket = {
            id: subRows[0].id,
            name: subRows[0].name,
            sort_order: subRows[0].sort_order,
            is_system: Boolean(subRows[0].is_system),
            student_count: st.student_count,
            income_this_month: st.income_this_month,
            groups: [],
          };
          byId.set(String(subRows[0].id), bucket);
        }
      }
      if (!bucket) continue;
      bucket.groups.push(
        decorateGroupInvitationFields({
          id: g.id,
          name: g.name,
          sort_order: g.sort_order,
          is_system: Boolean(g.is_system),
          system_kind: g.system_kind || null,
          system_ref_id: g.system_ref_id || null,
          join_code: g.is_system ? null : g.join_code || null,
          join_code_expires_at: g.join_code_expires_at || null,
          invitation_code: g.invitation_code || null,
          invitation_link: g.invitation_link || null,
          default_billing_type: g.default_billing_type || '8_lessons',
          default_package_fee: g.default_package_fee != null ? Number(g.default_package_fee) : null,
          default_discount_percent:
            g.default_discount_percent != null ? Number(g.default_discount_percent) : null,
          default_billing_timing: g.default_billing_timing || 'postpaid',
          default_payment_plan: g.default_payment_plan || 'full',
          default_lesson_weekdays: g.default_lesson_weekdays || [],
          default_lesson_times: g.default_lesson_times || {},
          default_lesson_end_times: g.default_lesson_end_times || {},
          default_notifications_enabled: g.default_notifications_enabled !== false,
          default_initial_payment_status: g.default_initial_payment_status || 'unpaid',
          invite_ready: Boolean(rowToDefaults(g)),
        }),
      );
    }

    const teachingSubjects = [...byId.values()]
      .filter((s) => !s.is_system)
      .map((s) => ({
        ...s,
        groups: (s.groups || []).filter((g) => !g.is_system),
      }))
      .filter((s) => (s.groups || []).length > 0 || !/^\[System\]/i.test(String(s.name || '')));

    const participant_cohorts = await listParticipantCohorts(iid);

    res.json({
      success: true,
      public_label,
      avatar_url: p?.avatar_url || null,
      map: {
        latitude: p?.latitude != null ? Number(p.latitude) : null,
        longitude: p?.longitude != null ? Number(p.longitude) : null,
        map_profile_kind: p?.map_profile_kind === 'trainer' ? 'trainer' : 'teacher',
        map_visible: p?.map_visible !== false,
        map_search_radius_km:
          p?.map_search_radius_km != null ? Number(p.map_search_radius_km) : 10,
      },
      subjects: teachingSubjects,
      participant_cohorts,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const patchPublicLabel = async (req, res) => {
  try {
    const pl = parsePublicLabel(req.body?.public_label);
    const { rowCount } = await db.query(`UPDATE instructor_profiles SET public_label = $1 WHERE user_id = $2`, [
      pl,
      req.user.id,
    ]);
    if (!rowCount) {
      return res.status(404).json({ success: false, message: 'Müəllim profili tapılmadı' });
    }
    res.json({ success: true, public_label: pl });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const postSubject = async (req, res) => {
  try {
    const name = req.body?.name != null ? String(req.body.name).trim() : '';
    if (!name) return res.status(400).json({ success: false, message: 'Sahə adı tələb olunur' });
    if (name.length > 200) return res.status(400).json({ success: false, message: 'Sahə adı çox uzundur' });
    if (isReservedSystemSubjectName(name)) {
      return res.status(400).json({
        success: false,
        message: '«[System]» adlı sahələr avtomatik yaradılır — əl ilə yaradıla bilməz.',
      });
    }
    const { rows: mx } = await db.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM instructor_subjects WHERE instructor_id = $1`,
      [req.user.id]
    );
    const so = Number(mx[0]?.n) || 0;
    const { rows } = await db.query(
      `INSERT INTO instructor_subjects (instructor_id, name, sort_order) VALUES ($1, $2, $3) RETURNING id, name, sort_order`,
      [req.user.id, name, so]
    );
    res.status(201).json({
      success: true,
      subject: { ...rows[0], groups: [], student_count: 0, income_this_month: 0 },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const deleteSubject = async (req, res) => {
  try {
    const id = req.params.id;
    if (!looksUuid(id)) return res.status(400).json({ success: false, message: 'ID düzgün deyil' });
    await assertSubjectMutable(id, req.user.id, 'delete');
    const { rowCount } = await db.query(
      `DELETE FROM instructor_subjects WHERE id = $1 AND instructor_id = $2`,
      [id, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const postGroup = async (req, res) => {
  try {
    const subject_id = req.body?.subject_id;
    const name = req.body?.name != null ? String(req.body.name).trim() : '';
    if (!looksUuid(subject_id)) return res.status(400).json({ success: false, message: 'Sahə seçilməlidir' });
    if (!name) return res.status(400).json({ success: false, message: 'Qrup adı tələb olunur' });
    if (name.length > 200) return res.status(400).json({ success: false, message: 'Qrup adı çox uzundur' });
    const { rows: sub } = await db.query(`SELECT id FROM instructor_subjects WHERE id = $1 AND instructor_id = $2`, [
      subject_id,
      req.user.id,
    ]);
    if (!sub[0]) return res.status(403).json({ success: false, message: 'Bu sahəyə icazə yoxdur' });
    const { rows: mxg } = await db.query(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM instructor_groups WHERE subject_id = $1`,
      [subject_id]
    );
    const sgo = Number(mxg[0]?.n) || 0;
    const joinCode = await generateUniqueJoinCode();
    const defs = parseGroupDefaultsPayload(req.body);
    const { rows } = await db.query(
      `INSERT INTO instructor_groups (
         instructor_id, subject_id, name, sort_order, join_code, invitation_code, invitation_link,
         default_billing_type, default_package_fee, default_discount_percent,
         default_billing_timing, default_payment_plan, default_lesson_weekdays,
         default_lesson_times, default_lesson_end_times,
         default_notifications_enabled, default_initial_payment_status
       ) VALUES ($1, $2, $3, $4, $5::text, $6::varchar, $7, $8, $9, $10, $11, $12, $13::jsonb, $14::jsonb, $15::jsonb, $16, $17)
       RETURNING *`,
      [
        req.user.id,
        subject_id,
        name,
        sgo,
        joinCode,
        joinCode,
        buildInvitationLink(joinCode),
        defs.billing_type,
        defs.package_fee,
        defs.discount_percent,
        defs.billing_timing,
        defs.payment_plan,
        JSON.stringify(defs.lesson_weekdays),
        JSON.stringify(defs.lesson_times),
        JSON.stringify(defs.lesson_end_times || {}),
        defs.notifications_enabled,
        defs.initial_payment_status,
      ],
    );
    const g = decorateGroupInvitationFields(rows[0]);
    res.status(201).json({
      success: true,
      group: { ...g, invite_ready: Boolean(rowToDefaults(rows[0])) },
    });
  } catch (err) {
    const msg = String(err?.message || '');
    if (/column/i.test(msg) && /does not exist|undefined column/i.test(msg)) {
      return res.status(503).json({
        success: false,
        message:
          'Server verilənlər bazası yenilənməlidir (qrup paketi sütunları). Bir neçə dəqiqə gözləyin və ya dəstək yazın.',
        code: 'SCHEMA_OUTDATED',
      });
    }
    if (err?.code === '23505') {
      return res.status(409).json({ success: false, message: 'Bu qrup və ya dəvət kodu artıq mövcuddur' });
    }
    res.status(500).json({ success: false, message: msg || 'Qrup yaradılmadı' });
  }
};

const patchGroup = async (req, res) => {
  try {
    const id = req.params.id;
    if (!looksUuid(id)) return res.status(400).json({ success: false, message: 'ID düzgün deyil' });
    await assertGroupMutable(id, req.user.id, 'rename_or_configure');
    const defs = parseGroupDefaultsPayload(req.body);
    const { rows } = await db.query(
      `UPDATE instructor_groups SET
         name = COALESCE(NULLIF($3, ''), name),
         default_billing_type = $4,
         default_package_fee = $5,
         default_discount_percent = $6,
         default_billing_timing = $7,
         default_payment_plan = $8,
         default_lesson_weekdays = $9::jsonb,
         default_lesson_times = $10::jsonb,
         default_lesson_end_times = $11::jsonb,
         default_notifications_enabled = $12,
         default_initial_payment_status = $13
       WHERE id = $1 AND instructor_id = $2
       RETURNING *`,
      [
        id,
        req.user.id,
        req.body?.name != null ? String(req.body.name).trim() : null,
        defs.billing_type,
        defs.package_fee,
        defs.discount_percent,
        defs.billing_timing,
        defs.payment_plan,
        JSON.stringify(defs.lesson_weekdays),
        JSON.stringify(defs.lesson_times),
        JSON.stringify(defs.lesson_end_times || {}),
        defs.notifications_enabled,
        defs.initial_payment_status,
      ],
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    const g = decorateGroupInvitationFields(rows[0]);
    res.json({ success: true, group: { ...g, invite_ready: Boolean(rowToDefaults(rows[0])) } });
  } catch (err) {
    const msg = String(err?.message || '');
    if (/column/i.test(msg) && /does not exist|undefined column/i.test(msg)) {
      return res.status(503).json({
        success: false,
        message: 'Server verilənlər bazası yenilənməlidir. Bir neçə dəqiqə gözləyin və ya dəstək yazın.',
        code: 'SCHEMA_OUTDATED',
      });
    }
    res.status(500).json({ success: false, message: msg || 'Qrup yenilənmədi' });
  }
};

const deleteGroup = async (req, res) => {
  try {
    const id = req.params.id;
    if (!looksUuid(id)) return res.status(400).json({ success: false, message: 'ID düzgün deyil' });
    await assertGroupMutable(id, req.user.id, 'delete');
    const { rowCount } = await db.query(`DELETE FROM instructor_groups WHERE id = $1 AND instructor_id = $2`, [
      id,
      req.user.id,
    ]);
    if (!rowCount) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const postPromoteParticipant = async (req, res) => {
  try {
    const studentId = req.body?.student_id;
    const systemGroupId = req.body?.system_group_id;
    const targetGroupId = req.body?.target_group_id;
    if (!looksUuid(studentId) || !looksUuid(systemGroupId) || !looksUuid(targetGroupId)) {
      return res.status(400).json({ success: false, message: 'Tələbə, sistem qrupu və hədəf qrup seçilməlidir' });
    }
    const result = await db.transaction(async (client) =>
      promoteParticipantToCrmGroup(client, {
        instructorId: req.user.id,
        studentId,
        systemGroupId,
        targetGroupId,
      }),
    );
    res.json({
      success: true,
      message: `${result.student_name} «${result.target_group_name}» qrupuna əlavə edildi — artıq daimi tələbədir.`,
      ...result,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      code: err.code,
    });
  }
};

module.exports = {
  getTeaching,
  patchPublicLabel,
  postSubject,
  deleteSubject,
  postGroup,
  patchGroup,
  deleteGroup,
  postPromoteParticipant,
};
