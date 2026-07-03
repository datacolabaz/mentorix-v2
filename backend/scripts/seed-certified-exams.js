#!/usr/bin/env node
/**
 * Seed verified certified exams for public catalog (local/staging).
 * Usage: node backend/scripts/seed-certified-exams.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const db = require('../src/utils/db');

const OFFICIAL_EMAIL = process.env.MENTORIX_OFFICIAL_EMAIL || 'mentorix.resmi@mentorix.local';
const OFFICIAL_NAME = 'Mentorix Rəsmi';

const EXAMS = [
  {
    title: 'IELTS Academic Reading — Practice Test 1',
    subject: 'IELTS',
    category: 'beynelxalq',
    duration_minutes: 30,
    pass_pct: 70,
    questions: [
      { text: 'Reading passage 1: The main idea is…', correct: 'B' },
      { text: 'According to the text, researchers found…', correct: 'A' },
      { text: 'The author suggests that…', correct: 'C' },
    ],
  },
  {
    title: 'SAT Math — Algebra & Functions',
    subject: 'SAT',
    category: 'beynelxalq',
    duration_minutes: 25,
    pass_pct: 65,
    questions: [
      { text: 'If 2x + 5 = 17, what is x?', correct: 'B' },
      { text: 'Which function is linear?', correct: 'A' },
      { text: 'Slope of line through (0,0) and (2,4)?', correct: 'C' },
    ],
  },
  {
    title: 'Data Analytics Professional Certification',
    subject: 'Data Analytics',
    category: 'is-heyati',
    duration_minutes: 25,
    pass_pct: 70,
    questions: [
      { text: 'Which metric best measures central tendency for skewed data?', correct: 'B' },
      { text: 'A/B test p-value < 0.05 means…', correct: 'A' },
      { text: 'SQL window function ROW_NUMBER() is used for…', correct: 'C' },
    ],
  },
  {
    title: 'Excel for Business — Intermediate',
    subject: 'Excel',
    category: 'is-heyati',
    duration_minutes: 20,
    pass_pct: 75,
    questions: [
      { text: 'VLOOKUP searches…', correct: 'A' },
      { text: 'Pivot table is best for…', correct: 'B' },
      { text: 'INDEX/MATCH advantage over VLOOKUP…', correct: 'C' },
    ],
  },
  {
    title: 'SQL Fundamentals — SELECT & JOIN',
    subject: 'SQL',
    category: 'is-heyati',
    duration_minutes: 20,
    pass_pct: 70,
    questions: [
      { text: 'INNER JOIN returns…', correct: 'A' },
      { text: 'GROUP BY is used with…', correct: 'B' },
      { text: 'Primary key must be…', correct: 'C' },
    ],
  },
];

function makeOptions(correct) {
  const keys = ['A', 'B', 'C', 'D'];
  return keys.map((key) => ({ key, text: `Variant ${key}` }));
}

async function ensureOfficialInstructor(client) {
  const { rows } = await client.query(
    `SELECT id, role FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [OFFICIAL_EMAIL],
  );
  if (rows[0]) return rows[0].id;

  const { rows: created } = await client.query(
    `INSERT INTO users (email, full_name, role, is_active, is_verified, password_hash)
     VALUES ($1, $2, 'instructor', TRUE, TRUE, NULL)
     RETURNING id`,
    [OFFICIAL_EMAIL, OFFICIAL_NAME],
  );
  return created[0].id;
}

async function seedExam(client, instructorId, spec) {
  const { rows: existing } = await client.query(
    `SELECT id FROM exams WHERE instructor_id = $1 AND title = $2 AND COALESCE(is_deleted, FALSE) = FALSE LIMIT 1`,
    [instructorId, spec.title],
  );
  if (existing[0]) {
    await client.query(
      `UPDATE exams SET
         category = $2,
         is_public = TRUE,
         is_verified = TRUE,
         certificate_enabled = TRUE,
         certificate_pass_pct = $3,
         updated_at = NOW()
       WHERE id = $1`,
      [existing[0].id, spec.category, spec.pass_pct],
    );
    return existing[0].id;
  }

  const now = new Date();
  const until = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

  const { rows } = await client.query(
    `INSERT INTO exams (
       instructor_id, title, subject, topic, duration_minutes,
       start_time, available_from, available_until,
       show_results, certificate_enabled, certificate_pass_pct,
       category, is_public, is_verified, status
     ) VALUES ($1,$2,$3,$4,$5,$6::timestamptz,$6::timestamptz,$7::timestamptz,TRUE,TRUE,$8,$9,TRUE,TRUE,'scheduled')
     RETURNING id`,
    [
      instructorId,
      spec.title,
      spec.subject,
      spec.subject,
      spec.duration_minutes,
      now.toISOString(),
      until.toISOString(),
      spec.pass_pct,
      spec.category,
    ],
  );
  const examId = rows[0].id;

  for (let i = 0; i < spec.questions.length; i++) {
    const q = spec.questions[i];
    await client.query(
      `INSERT INTO exam_questions (
         exam_id, question_text, question_type, points, order_num, correct_answer, options, negative_marking
       ) VALUES ($1,$2,'closed',1,$3,$4,$5::jsonb,0)`,
      [
        examId,
        q.text,
        i + 1,
        q.correct,
        JSON.stringify(makeOptions(q.correct)),
      ],
    );
  }

  return examId;
}

async function main() {
  await db.transaction(async (client) => {
    const instructorId = await ensureOfficialInstructor(client);
    console.log('Official instructor:', instructorId, OFFICIAL_EMAIL);
    for (const spec of EXAMS) {
      const id = await seedExam(client, instructorId, spec);
      console.log('Seeded exam:', spec.title, id);
    }
  });
  console.log('Done.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
