#!/usr/bin/env node
'use strict';

/**
 * Aylıq tələbə ödəniş uyğunsuzluğu diaqnostikası.
 * İstifadə: cd backend && node scripts/diagnose-monthly-students.js "Elmir" "Elshen"
 */

require('dotenv').config();
const db = require('../src/utils/db');
const {
  getTodayBakuYmd,
  resolveMonthlyAnchorYmd,
  listBillingDueDatesUpTo,
  allocateMonthlyPaymentsToDues,
  lastPaidDueYmd,
} = require('../src/services/subscriptionBilling');

async function diagnoseStudent(row, todayBaku) {
  const anchorYmd = resolveMonthlyAnchorYmd({
    enrollment_start_date: row.enrollment_start_date,
    enrolled_at: row.enrolled_at,
    payment_start_date: row.payment_start_date,
    today_ymd: todayBaku,
  });
  const dues = listBillingDueDatesUpTo(anchorYmd, todayBaku);
  const { rows: payments } = await db.query(
    `SELECT id, amount, status,
            to_char(payment_date::date, 'YYYY-MM-DD') AS payment_date,
            paid_at, notes, period
     FROM payments
     WHERE enrollment_id = $1
       AND (deleted_at IS NULL)
     ORDER BY payment_date ASC NULLS LAST, paid_at ASC NULLS LAST`,
    [row.enrollment_id]
  );
  const { paidByDue, orphans } = allocateMonthlyPaymentsToDues({
    anchorYmd,
    todayYmd: todayBaku,
    payments,
  });
  const lastPaid = lastPaidDueYmd(paidByDue);
  const rawDates = (payments || [])
    .map((p) => String(p.payment_date || '').slice(0, 10))
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));

  return {
    full_name: row.full_name,
    enrollment_id: row.enrollment_id,
    billing_type: row.billing_type,
    enrollment_start_date: row.enrollment_start_date,
    enrolled_at_baku: row.enrolled_at,
    payment_start_date: row.payment_start_date,
    resolved_anchor: anchorYmd,
    today_baku: todayBaku,
    expected_dues_count: dues.length,
    schedule_last_due: dues.length ? dues[dues.length - 1] : null,
    db_payment_rows: payments.length,
    allocated_paid_months: paidByDue.size,
    last_paid_due: lastPaid,
    raw_payment_dates: rawDates,
    orphan_payments: orphans.length,
  };
}

async function main() {
  const names = process.argv.slice(2).filter(Boolean);
  const todayBaku = await getTodayBakuYmd(db);
  let sql = `
    SELECT e.id AS enrollment_id, e.billing_type,
           to_char(e.enrollment_start_date::date, 'YYYY-MM-DD') AS enrollment_start_date,
           to_char((e.enrolled_at AT TIME ZONE 'Asia/Baku')::date, 'YYYY-MM-DD') AS enrolled_at,
           to_char(sp.payment_start_date::date, 'YYYY-MM-DD') AS payment_start_date,
           u.full_name
    FROM enrollments e
    INNER JOIN users u ON u.id = e.student_id
    LEFT JOIN student_profiles sp ON sp.user_id = u.id
    WHERE u.role = 'student'
      AND (e.deleted_at IS NULL)
  `;
  const params = [];
  if (names.length) {
    sql += ` AND (` + names.map((_, i) => `u.full_name ILIKE $${i + 1}`).join(' OR ') + `)`;
    names.forEach((n) => params.push(`%${n}%`));
  } else {
    sql += ` AND (u.full_name ILIKE '%Elmir%' OR u.full_name ILIKE '%Elshen%' OR u.full_name ILIKE '%İsmayilov%')`;
  }
  sql += ` ORDER BY u.full_name`;

  const { rows } = await db.query(sql, params);
  if (!rows.length) {
    console.log('Tələbə tapılmadı.');
    process.exit(0);
  }
  console.log(JSON.stringify({ today_baku: todayBaku, students: await Promise.all(rows.map((r) => diagnoseStudent(r, todayBaku))) }, null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
