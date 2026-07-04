#!/usr/bin/env node
/**
 * Mark an existing instructor exam as pending catalog verification (QA).
 * Usage: node backend/scripts/seed-pending-catalog-exam.js
 * Optional: node backend/scripts/seed-pending-catalog-exam.js <exam-id>
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../src/utils/db');

const OFFICIAL_EMAIL = process.env.MENTORIX_OFFICIAL_EMAIL || 'mentorix.resmi@mentorix.local';
const PENDING_TITLE = 'Data Analytics Fundamentals (QA Pending)';

function makeOptions(correct) {
  return ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `Variant ${key}` }));
}

async function findCategoryId(client) {
  const { rows } = await client.query(
    `SELECT id, name, slug FROM exam_categories
     WHERE slug IN ('data-analytics-core', 'data-analytics')
     ORDER BY CASE slug WHEN 'data-analytics-core' THEN 0 ELSE 1 END
     LIMIT 1`,
  );
  return rows[0] || null;
}

async function findNonOfficialInstructor(client) {
  const { rows } = await client.query(
    `SELECT u.id, u.email, COALESCE(NULLIF(TRIM(u.full_name), ''), u.email) AS name
     FROM users u
     WHERE u.role = 'instructor'
       AND LOWER(u.email) <> LOWER($1)
     ORDER BY u.created_at ASC
     LIMIT 1`,
    [OFFICIAL_EMAIL],
  );
  return rows[0] || null;
}

async function ensurePendingExam(client, instructorId, categoryId) {
  const { rows: existing } = await client.query(
    `SELECT id FROM exams
     WHERE instructor_id = $1 AND title = $2 AND COALESCE(is_deleted, FALSE) = FALSE
     LIMIT 1`,
    [instructorId, PENDING_TITLE],
  );
  if (existing[0]) return existing[0].id;

  const now = new Date();
  const until = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const { rows } = await client.query(
    `INSERT INTO exams (
       instructor_id, title, subject, topic, duration_minutes,
       start_time, available_from, available_until,
       show_results, certificate_enabled, certificate_pass_pct,
       category_id, is_public, is_verified, status, level, certificate_type
     ) VALUES ($1,$2,'Data Analytics','Data Analytics',25,$3::timestamptz,$3::timestamptz,$4::timestamptz,
       TRUE,TRUE,70,$5,TRUE,FALSE,'scheduled','beginner','professional')
     RETURNING id`,
    [instructorId, PENDING_TITLE, now.toISOString(), until.toISOString(), categoryId],
  );
  const examId = rows[0].id;

  const questions = [
    { text: 'Which metric best measures central tendency for skewed data?', correct: 'B' },
    { text: 'A/B test p-value < 0.05 typically means…', correct: 'A' },
    { text: 'SQL window function ROW_NUMBER() is used for…', correct: 'C' },
    { text: 'Correlation does not imply…', correct: 'D' },
    { text: 'Which chart is best for part-to-whole comparison?', correct: 'B' },
    { text: 'Null hypothesis in a test is…', correct: 'A' },
    { text: 'ETL stands for…', correct: 'C' },
    { text: 'Median is resistant to…', correct: 'B' },
    { text: 'Primary key in a relational table must be…', correct: 'A' },
    { text: 'Dashboard KPI should be…', correct: 'D' },
  ];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    await client.query(
      `INSERT INTO exam_questions (
         exam_id, question_text, question_type, points, order_num, correct_answer, options, negative_marking
       ) VALUES ($1,$2,'closed',1,$3,$4,$5::jsonb,0)`,
      [examId, q.text, i + 1, q.correct, JSON.stringify(makeOptions(q.correct))],
    );
  }

  return examId;
}

async function main() {
  const argExamId = process.argv[2] || null;

  await db.transaction(async (client) => {
    const category = await findCategoryId(client);
    if (!category) {
      throw new Error('exam_categories slug data-analytics tapılmadı — əvvəlcə seed-skill-assessment-catalog.js işə salın');
    }

    let examId = argExamId;
    let instructor = null;

    if (examId) {
      const { rows } = await client.query(
        `SELECT e.id, e.title, e.instructor_id, u.email AS instructor_email
         FROM exams e JOIN users u ON u.id = e.instructor_id
         WHERE e.id = $1 AND COALESCE(e.is_deleted, FALSE) = FALSE`,
        [examId],
      );
      if (!rows[0]) throw new Error(`Exam tapılmadı: ${examId}`);
      instructor = { id: rows[0].instructor_id, email: rows[0].instructor_email };
    } else {
      instructor = await findNonOfficialInstructor(client);
      if (!instructor) {
        throw new Error('Rəsmi olmayan müəllim tapılmadı — əvvəlcə adi instructor hesabı yaradın');
      }
      examId = await ensurePendingExam(client, instructor.id, category.id);
    }

    const { rows: updated } = await client.query(
      `UPDATE exams SET
         is_public = TRUE,
         is_verified = FALSE,
         certificate_enabled = TRUE,
         category_id = COALESCE(category_id, $2),
         catalog_rejection_reason = NULL,
         catalog_rejected_at = NULL,
         updated_at = NOW()
       WHERE id = $1
       RETURNING id, title, is_public, is_verified, category_id`,
      [examId, category.id],
    );

    const { rows: qCount } = await client.query(
      `SELECT COUNT(*)::int AS n FROM exam_questions WHERE exam_id = $1`,
      [examId],
    );

    console.log('\n✅ Pending catalog exam hazırdır (admin panel test üçün):\n');
    console.log('  Exam ID:     ', updated[0].id);
    console.log('  Title:       ', updated[0].title);
    console.log('  Instructor:  ', instructor.email || instructor.id);
    console.log('  Category:    ', category.name, `(${category.slug})`);
    console.log('  Questions:   ', qCount[0].n);
    console.log('  is_public:   ', updated[0].is_public);
    console.log('  is_verified: ', updated[0].is_verified);
    console.log('\n→ /admin/certified-exams səhifəsində «Gözləyən verifikasiyalar» bölməsində görünməlidir.\n');
  });

  process.exit(0);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
