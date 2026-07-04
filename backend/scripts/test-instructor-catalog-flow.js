#!/usr/bin/env node
/**
 * Simulates instructor form submit: certificate + is_public → admin pending queue.
 * Usage:
 *   node backend/scripts/test-instructor-catalog-flow.js
 *   TEST_INSTRUCTOR_EMAIL=you@example.com node backend/scripts/test-instructor-catalog-flow.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../src/utils/db');

const TEST_EMAIL = process.env.TEST_INSTRUCTOR_EMAIL || 'datanalystelman@gmail.com';
const EXAM_TITLE = `Kataloq Test — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`;

function makeOptions(correct) {
  return ['A', 'B', 'C', 'D'].map((key) => ({ key, text: `Variant ${key}` }));
}

async function main() {
  const result = await db.transaction(async (client) => {
    const { rows: users } = await client.query(
      `SELECT id, email FROM users WHERE LOWER(email) = LOWER($1) AND role = 'instructor' LIMIT 1`,
      [TEST_EMAIL],
    );
    const instructor = users[0];
    if (!instructor) throw new Error(`Instructor tapılmadı: ${TEST_EMAIL}`);

    const { rows: cats } = await client.query(
      `SELECT id, name, slug FROM exam_categories WHERE slug = 'data-analytics' LIMIT 1`,
    );
    const category = cats[0];
    if (!category) throw new Error('data-analytics kateqoriyası tapılmadı');

    const now = new Date();
    const until = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { rows: created } = await client.query(
      `INSERT INTO exams (
         instructor_id, title, subject, topic, duration_minutes,
         start_time, available_from, available_until,
         show_results, certificate_enabled, certificate_pass_pct,
         category_id, level, certificate_type, is_public, is_verified, status
       ) VALUES ($1,$2,'Data Analytics','Test',20,$3::timestamptz,$3::timestamptz,$4::timestamptz,
         TRUE,TRUE,70,$5,'intermediate','fundamentals',TRUE,FALSE,'scheduled')
       RETURNING id, title, is_public, is_verified, category_id, level, certificate_type`,
      [instructor.id, EXAM_TITLE, now.toISOString(), until.toISOString(), category.id],
    );
    const exam = created[0];

    const questions = [
      'Test sual 1: median nədir?',
      'Test sual 2: p-value nə deməkdir?',
      'Test sual 3: JOIN növləri?',
    ];
    for (let i = 0; i < questions.length; i++) {
      await client.query(
        `INSERT INTO exam_questions (exam_id, question_text, question_type, points, order_num, correct_answer, options, negative_marking)
         VALUES ($1,$2,'closed',1,$3,'B',$4::jsonb,0)`,
        [exam.id, questions[i], i + 1, JSON.stringify(makeOptions('B'))],
      );
    }

    const { rows: pending } = await client.query(
      `SELECT e.id, e.title, u.email AS instructor_email
       FROM exams e
       JOIN users u ON u.id = e.instructor_id
       WHERE e.is_public = TRUE AND e.is_verified = FALSE
         AND COALESCE(e.is_deleted, FALSE) = FALSE AND e.certificate_enabled = TRUE
         AND e.id = $1`,
      [exam.id],
    );

    return { instructor, category, exam, inPendingQueue: pending.length > 0, pendingRow: pending[0] };
  });

  console.log('\n=== Kataloq verifikasiya testi ===\n');
  console.log('Müəllim:     ', result.instructor.email);
  console.log('Kateqoriya:  ', result.category.name, `(${result.category.slug})`);
  console.log('Exam ID:     ', result.exam.id);
  console.log('Başlıq:      ', result.exam.title);
  console.log('level:       ', result.exam.level);
  console.log('cert type:   ', result.exam.certificate_type);
  console.log('is_public:   ', result.exam.is_public);
  console.log('is_verified: ', result.exam.is_verified);
  console.log('\nAdmin pending queue:', result.inPendingQueue ? '✅ GÖRÜNÜR' : '❌ YOX');
  if (result.pendingRow) {
    console.log('→ /admin/certified-exams səhifəsində bu imtahan görünməlidir.\n');
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('Xəta:', err.message || err);
  process.exit(1);
});
