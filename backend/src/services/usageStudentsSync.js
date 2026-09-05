const db = require('../utils/db');
const { instructorVisibleStudentsWhereSql } = require('../lib/instructorVisibleStudents');

/**
 * Paket kartındakı 👥 sayı — Tələbələrim siyahısı ilə eyni dəst:
 * silinməmiş, aktiv hesab + görünən enrollment.
 * instructor_students cədvəli lifetime unikal linkdir (imtahan qonağı, silinmiş tələbə)
 * və sidebar «cari tələbə» kimi oxunmamalıdır.
 */
async function countDistinctStudents(instructorId, dbConn = db) {
  const { rows } = await dbConn.query(
    `SELECT COUNT(DISTINCT e.student_id)::int AS n
     FROM enrollments e
     JOIN users u ON u.id = e.student_id
     WHERE ${instructorVisibleStudentsWhereSql({ instructorParam: 1 })}`,
    [instructorId],
  );
  return Number(rows[0]?.n ?? 0) || 0;
}

async function syncUsageStudentsCount(instructorId, dbConn = db) {
  const n = await countDistinctStudents(instructorId, dbConn);
  await dbConn
    .query(
      `INSERT INTO usage_counters (user_id, students_count, storage_used_mb, storage_used_bytes, sms_used_monthly, sms_period_ym)
       VALUES ($1, $2, 0, 0, 0, to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku'), 'YYYY-MM'))
       ON CONFLICT (user_id) DO UPDATE
       SET students_count = $2, updated_at = NOW()`,
      [instructorId, n],
    )
    .catch(() => {});
  return n;
}

module.exports = {
  countDistinctStudents,
  syncUsageStudentsCount,
};
