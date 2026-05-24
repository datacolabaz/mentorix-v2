const db = require('../utils/db');
const { roundMoney } = require('../services/subscriptionBilling');

function normUuid(id) {
  return String(id).trim().toLowerCase().replace(/-/g, '');
}

function pctChange(current, previous) {
  const c = Number(current);
  const p = Number(previous);
  if (!Number.isFinite(c) || !Number.isFinite(p)) return 0;
  if (p === 0) return c > 0 ? 100 : 0;
  return Math.round(((c - p) / p) * 100);
}

const getTeacherDashboardStats = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const iid = normUuid(instructorId);

    const monthStartSql = "date_trunc('month', NOW())";
    const lastMonthStartSql = "date_trunc('month', NOW()) - interval '1 month'";

    const paymentJoinWhere = `
       FROM payments p
       JOIN enrollments e ON e.id = p.enrollment_id
       WHERE REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1
         AND p.status = 'completed'
         AND (p.deleted_at IS NULL)
         AND (p.notes IS NULL OR TRIM(p.notes) NOT LIKE '[Balans düzəlişi]%')`;

    const incomeQ = db.query(
      `SELECT COALESCE(SUM(p.amount), 0)::numeric AS income_this_month
       ${paymentJoinWhere}
         AND COALESCE(p.payment_date::timestamptz, p.paid_at, NOW()) >= ${monthStartSql}`,
      [iid],
    );

    const incomeLastMonthQ = db.query(
      `SELECT COALESCE(SUM(p.amount), 0)::numeric AS income_last_month
       ${paymentJoinWhere}
         AND COALESCE(p.payment_date::timestamptz, p.paid_at, NOW()) >= ${lastMonthStartSql}
         AND COALESCE(p.payment_date::timestamptz, p.paid_at, NOW()) < ${monthStartSql}`,
      [iid],
    );

    const totalQ = db.query(
      `SELECT COALESCE(SUM(p.amount), 0)::numeric AS total_earnings_all
       ${paymentJoinWhere}`,
      [iid],
    );

    const incomeWindowsQ = db.query(
      `SELECT
         COALESCE(SUM(p.amount) FILTER (
           WHERE COALESCE(p.payment_date::timestamptz, p.paid_at) >= NOW() - interval '30 days'
         ), 0)::numeric AS sum_30d,
         COALESCE(SUM(p.amount) FILTER (
           WHERE COALESCE(p.payment_date::timestamptz, p.paid_at) >= NOW() - interval '60 days'
             AND COALESCE(p.payment_date::timestamptz, p.paid_at) < NOW() - interval '30 days'
         ), 0)::numeric AS sum_prev_30d
       ${paymentJoinWhere}`,
      [iid],
    );

    const enrollmentStatsQ = db.query(
      `SELECT
         COUNT(*)::int AS active_enrollments,
         COUNT(*) FILTER (
           WHERE e.enrolled_at >= ${monthStartSql}
             AND e.enrolled_at < ${monthStartSql} + interval '1 month'
         )::int AS new_enrollments_this_month,
         COUNT(*) FILTER (
           WHERE e.enrolled_at >= ${lastMonthStartSql}
             AND e.enrolled_at < ${monthStartSql}
         )::int AS new_enrollments_last_month
       FROM enrollments e
       JOIN users u ON u.id = e.student_id
       WHERE u.role = 'student'
         AND u.is_active = TRUE
         AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1`,
      [iid],
    );

    const examAggQ = db.query(
      `WITH per_result AS (
         SELECT er.score::numeric AS score_pts,
                COALESCE(
                  (SELECT SUM(COALESCE(eq.points, 0)::numeric) FROM exam_questions eq WHERE eq.exam_id = er.exam_id),
                  0
                ) AS max_pts,
                er.submitted_at
         FROM exam_results er
         JOIN exams ex ON ex.id = er.exam_id
         WHERE er.submitted_at IS NOT NULL
           AND COALESCE(ex.is_deleted, FALSE) = FALSE
           AND REPLACE(LOWER(TRIM(ex.instructor_id::text)), '-', '') = $1
       ),
       scored AS (
         SELECT submitted_at,
                CASE
                  WHEN max_pts > 0 THEN LEAST(100, GREATEST(0, (score_pts / max_pts) * 100))
                  ELSE 0::numeric
                END AS pct
         FROM per_result
       )
       SELECT
         ROUND(AVG(pct), 2)::numeric AS exam_avg_pct,
         ROUND(AVG(pct) FILTER (WHERE submitted_at >= NOW() - interval '30 days'), 2)::numeric AS exam_avg_30d,
         ROUND(
           AVG(pct) FILTER (
             WHERE submitted_at >= NOW() - interval '60 days' AND submitted_at < NOW() - interval '30 days'
           ),
           2
         )::numeric AS exam_avg_prev_30d
       FROM scored`,
      [iid],
    );

    const sparkIncomeQ = db.query(
      `WITH months AS (
         SELECT generate_series(
           ${monthStartSql} - interval '5 months',
           ${monthStartSql},
           interval '1 month'
         ) AS m
       )
       SELECT COALESCE(
         json_agg(amt ORDER BY ym) FILTER (WHERE true),
         '[]'::json
       )::text AS series
       FROM (
         SELECT to_char(months.m, 'YYYY-MM') AS ym,
                COALESCE(sub.amt, 0)::numeric AS amt
         FROM months
         LEFT JOIN LATERAL (
           SELECT SUM(p.amount)::numeric AS amt
           ${paymentJoinWhere}
             AND date_trunc('month', COALESCE(p.payment_date::timestamptz, p.paid_at, NOW())) = months.m
         ) sub ON true
       ) t`,
      [iid],
    );

    const sparkEnrollmentQ = db.query(
      `WITH months AS (
         SELECT generate_series(
           ${monthStartSql} - interval '5 months',
           ${monthStartSql},
           interval '1 month'
         ) AS m
       )
       SELECT COALESCE(
         json_agg(cnt ORDER BY ym) FILTER (WHERE true),
         '[]'::json
       )::text AS series
       FROM (
         SELECT to_char(months.m, 'YYYY-MM') AS ym,
                COALESCE(sub.cnt, 0)::int AS cnt
         FROM months
         LEFT JOIN LATERAL (
           SELECT COUNT(*)::int AS cnt
           FROM enrollments e
           JOIN users u ON u.id = e.student_id
           WHERE u.role = 'student'
             AND u.is_active = TRUE
             AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $1
             AND e.enrolled_at >= months.m
             AND e.enrolled_at < months.m + interval '1 month'
         ) sub ON true
       ) t`,
      [iid],
    );

    const sparkExamQ = db.query(
      `WITH months AS (
         SELECT generate_series(
           ${monthStartSql} - interval '5 months',
           ${monthStartSql},
           interval '1 month'
         ) AS m
       ),
       per_result AS (
         SELECT er.submitted_at,
                er.score::numeric AS score_pts,
                COALESCE(
                  (SELECT SUM(COALESCE(eq.points, 0)::numeric) FROM exam_questions eq WHERE eq.exam_id = er.exam_id),
                  0
                ) AS max_pts
         FROM exam_results er
         JOIN exams ex ON ex.id = er.exam_id
         WHERE er.submitted_at IS NOT NULL
           AND COALESCE(ex.is_deleted, FALSE) = FALSE
           AND REPLACE(LOWER(TRIM(ex.instructor_id::text)), '-', '') = $1
       ),
       scored AS (
         SELECT date_trunc('month', submitted_at) AS m,
                CASE
                  WHEN max_pts > 0 THEN LEAST(100, GREATEST(0, (score_pts / max_pts) * 100))
                  ELSE 0::numeric
                END AS pct
         FROM per_result
       )
       SELECT COALESCE(
         json_agg(avg_pct ORDER BY ym) FILTER (WHERE true),
         '[]'::json
       )::text AS series
       FROM (
         SELECT to_char(months.m, 'YYYY-MM') AS ym,
                COALESCE(ROUND(AVG(s.pct), 2), 0)::numeric AS avg_pct
         FROM months
         LEFT JOIN scored s ON s.m = months.m
         GROUP BY months.m
       ) t`,
      [iid],
    );

    const [
      { rows: incomeRows },
      { rows: incomeLastRows },
      { rows: totalRows },
      { rows: winRows },
      { rows: enrRows },
      { rows: examRows },
      { rows: sparkInc },
      { rows: sparkEnr },
      { rows: sparkEx },
    ] = await Promise.all([
      incomeQ,
      incomeLastMonthQ,
      totalQ,
      incomeWindowsQ,
      enrollmentStatsQ,
      examAggQ,
      sparkIncomeQ,
      sparkEnrollmentQ,
      sparkExamQ,
    ]);

    const incomeThisMonth = Number(incomeRows[0]?.income_this_month ?? 0);
    const incomeLastMonth = Number(incomeLastRows[0]?.income_last_month ?? 0);
    const sum30 = Number(winRows[0]?.sum_30d ?? 0);
    const sumPrev30 = Number(winRows[0]?.sum_prev_30d ?? 0);

    const activeEnrollments = Number(enrRows[0]?.active_enrollments ?? 0);
    const newThisM = Number(enrRows[0]?.new_enrollments_this_month ?? 0);
    const newLastM = Number(enrRows[0]?.new_enrollments_last_month ?? 0);

    const examAvg = examRows[0]?.exam_avg_pct != null ? Number(examRows[0].exam_avg_pct) : null;
    const exam30 = examRows[0]?.exam_avg_30d != null ? Number(examRows[0].exam_avg_30d) : null;
    const examPrev30 = examRows[0]?.exam_avg_prev_30d != null ? Number(examRows[0].exam_avg_prev_30d) : null;

    function parseJsonSeries(raw, fallbackLen = 6) {
      try {
        const arr = JSON.parse(String(raw || '[]'));
        return Array.isArray(arr) ? arr.map((v) => Number(v) || 0) : Array(fallbackLen).fill(0);
      } catch {
        return Array(fallbackLen).fill(0);
      }
    }

    const spark_income_months = parseJsonSeries(sparkInc[0]?.series);
    const spark_enrollment_months = parseJsonSeries(sparkEnr[0]?.series);
    const spark_exam_months = parseJsonSeries(sparkEx[0]?.series);

    res.json({
      success: true,
      stats: {
        income_this_month: incomeThisMonth,
        income_last_month: incomeLastMonth,
        total_earnings_all: Number(totalRows[0]?.total_earnings_all ?? 0),
        active_enrollments: activeEnrollments,
        exam_avg_pct: examAvg,
        income_delta_pct: pctChange(incomeThisMonth, incomeLastMonth),
        total_income_flow_delta_pct: pctChange(sum30, sumPrev30),
        enrollment_growth_delta_pct: pctChange(newThisM, newLastM),
        exam_trend_delta_pct:
          exam30 != null && examPrev30 != null && (exam30 > 0 || examPrev30 > 0)
            ? pctChange(exam30, examPrev30)
            : 0,
        spark_income_months,
        spark_enrollment_months,
        spark_exam_months,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getTeacherDashboardStats };
