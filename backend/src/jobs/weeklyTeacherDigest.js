/**
 * Weekly results/activity summary for teachers (in-app + email, category "digest", preference-aware).
 * Runs Monday morning for the previous Baku week. The dedupe key is per teacher per week, so a second
 * replica or a re-run inserts nothing. Teachers with no activity in the week get nothing.
 */
const db = require('../utils/db');
const { instructorVisibleStudentsWhereSql } = require('../lib/instructorVisibleStudents');
const { createNotificationSafe } = require('../services/notificationService');

const BAKU_OFFSET_MS = 4 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Previous Monday-00:00 → Monday-00:00 window in Baku time (instants). */
function previousBakuWeek(now = new Date()) {
  const local = new Date(now.getTime() + BAKU_OFFSET_MS);
  const dow = local.getUTCDay() === 0 ? 7 : local.getUTCDay();
  const mondayLocalMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - (dow - 1) * DAY_MS;
  const end = new Date(mondayLocalMidnight - BAKU_OFFSET_MS);
  const start = new Date(end.getTime() - 7 * DAY_MS);
  return { start, end };
}

function ddmm(d, withYear = false) {
  const l = new Date(d.getTime() + BAKU_OFFSET_MS);
  const s = `${String(l.getUTCDate()).padStart(2, '0')}.${String(l.getUTCMonth() + 1).padStart(2, '0')}`;
  return withYear ? `${s}.${l.getUTCFullYear()}` : s;
}

function periodLabel({ start, end }) {
  return `${ddmm(start)} – ${ddmm(new Date(end.getTime() - DAY_MS), true)}`;
}

function weekKey({ start }) {
  return new Date(start.getTime() + BAKU_OFFSET_MS).toISOString().slice(0, 10);
}

async function teacherWeekStats(instructorId, { start, end }) {
  const { rows } = await db.query(
    `SELECT
       (SELECT COUNT(DISTINCT e.student_id)::int
          FROM enrollments e JOIN users u ON u.id = e.student_id
         WHERE ${instructorVisibleStudentsWhereSql({ instructorParam: 1 })}) AS active_students,
       (SELECT COUNT(*)::int FROM exam_results er JOIN exams ex ON ex.id = er.exam_id
         WHERE ex.instructor_id = $1 AND er.submitted_at >= $2 AND er.submitted_at < $3) AS exam_submissions,
       (SELECT COUNT(*)::int FROM student_assignments sa JOIN assignments a ON a.id = sa.assignment_id
         WHERE a.instructor_id = $1 AND sa.submitted_at >= $2 AND sa.submitted_at < $3) AS assignment_submissions,
       (SELECT COUNT(*)::int FROM student_assignments sa JOIN assignments a ON a.id = sa.assignment_id
         WHERE a.instructor_id = $1 AND sa.submitted_at IS NOT NULL AND sa.reviewed_at IS NULL
           AND LOWER(COALESCE(sa.status, '')) NOT IN ('returned', 'reviewed', 'late_rejected')) AS pending_reviews,
       (SELECT COUNT(*)::int FROM live_rooms lr
         WHERE lr.instructor_id = $1 AND lr.provider <> 'mentorix_live' AND lr.cancelled_at IS NULL
           AND lr.scheduled_at >= $2 AND lr.scheduled_at < $3) AS live_lessons`,
    [instructorId, start, end],
  );
  const r = rows[0] || {};
  return {
    activeStudents: Number(r.active_students) || 0,
    examSubmissions: Number(r.exam_submissions) || 0,
    assignmentSubmissions: Number(r.assignment_submissions) || 0,
    pendingReviews: Number(r.pending_reviews) || 0,
    liveLessons: Number(r.live_lessons) || 0,
  };
}

function hasActivity(s) {
  return s.examSubmissions + s.assignmentSubmissions + s.pendingReviews + s.liveLessons > 0;
}

async function runWeeklyTeacherDigest({ now = new Date() } = {}) {
  const week = previousBakuWeek(now);
  const key = weekKey(week);
  const label = periodLabel(week);
  const { rows: teachers } = await db.query(
    `SELECT id FROM users
     WHERE role = 'instructor' AND is_active = TRUE AND deleted_at IS NULL
     ORDER BY id`,
  );
  const stats = { teachers: teachers.length, notified: 0, skipped_no_activity: 0 };
  for (const t of teachers) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const s = await teacherWeekStats(t.id, week);
      if (!hasActivity(s)) {
        stats.skipped_no_activity += 1;
        continue;
      }
      // eslint-disable-next-line no-await-in-loop
      const out = await createNotificationSafe({
        recipientId: t.id,
        category: 'digest',
        eventType: 'weekly_teacher_digest',
        params: {
          periodLabel: label,
          activeStudents: String(s.activeStudents),
          examSubmissions: String(s.examSubmissions),
          assignmentSubmissions: String(s.assignmentSubmissions),
          pendingReviews: String(s.pendingReviews),
          liveLessons: String(s.liveLessons),
        },
        meta: { week_start: key, href: '/instructor/analytics' },
        providerWorkspaceId: t.id,
        dedupeKey: `weekly_teacher_digest:${key}`,
        email: true,
      });
      if (out?.created) stats.notified += 1;
    } catch (e) {
      console.error('[weekly-digest]', String(t.id).slice(0, 8), e?.message || e);
    }
  }
  return stats;
}

module.exports = { runWeeklyTeacherDigest, previousBakuWeek, periodLabel, weekKey, hasActivity };
