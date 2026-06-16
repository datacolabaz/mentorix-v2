const TZ = 'Asia/Baku';

function monthStartSql() {
  return `date_trunc('month', (CURRENT_TIMESTAMP AT TIME ZONE $2)::timestamp) AT TIME ZONE $2`;
}

/** Cari təqvim ayında (Bakı TZ) müəllimin yaratdığı imtahanların sayı. */
async function countInstructorExamsThisMonth(dbConn, instructorId) {
  const { rows } = await dbConn.query(
    `SELECT COUNT(*)::int AS cnt
     FROM exams
     WHERE instructor_id = $1
       AND COALESCE(is_deleted, FALSE) = FALSE
       AND created_at >= (${monthStartSql()})`,
    [instructorId, TZ]
  );
  return Math.max(0, Number(rows[0]?.cnt) || 0);
}

/** Cari təqvim ayında (Bakı TZ) müəllimin yaratdığı tapşırıqların sayı. */
async function countInstructorHomeworksThisMonth(dbConn, instructorId) {
  const { rows } = await dbConn.query(
    `SELECT COUNT(*)::int AS cnt
     FROM assignments
     WHERE instructor_id = $1
       AND created_at >= (${monthStartSql()})`,
    [instructorId, TZ]
  );
  return Math.max(0, Number(rows[0]?.cnt) || 0);
}

module.exports = { countInstructorExamsThisMonth, countInstructorHomeworksThisMonth };
