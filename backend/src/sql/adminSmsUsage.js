/** Cari ay (Asia/Baku) üzrə uğurlu SMS sayı — admin panel və limit yoxlaması. */
const SMS_LOGS_MONTHLY_COUNT_SUBQUERY = `
  (
    SELECT COUNT(*)::int
    FROM sms_logs sl
    WHERE sl.instructor_id = u.id
      AND to_char(
            (COALESCE(sl.created_at, sl.sent_at) AT TIME ZONE 'Asia/Baku'),
            'YYYY-MM'
          ) = to_char((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Baku'), 'YYYY-MM')
      AND COALESCE(LOWER(TRIM(sl.status)), 'sent') NOT LIKE 'failed%'
  )`;

module.exports = { SMS_LOGS_MONTHLY_COUNT_SUBQUERY };
