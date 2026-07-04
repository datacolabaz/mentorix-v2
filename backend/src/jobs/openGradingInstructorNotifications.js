const db = require('../utils/db');
const { sendEmail, userEmail } = require('./emailService');

/**
 * Gündəlik batch: hər imtahan üçün bir dəfə müəllimə açıq sual təsdiq bildirişi.
 */
async function runOpenGradingInstructorNotifications() {
  const { rows } = await db.query(
    `SELECT er.id AS exam_result_id, er.exam_id, er.student_id, er.grading, er.answers,
            e.title AS exam_title, e.instructor_id
     FROM exam_results er
     JOIN exams e ON e.id = er.exam_id
     JOIN exam_questions eq ON eq.exam_id = er.exam_id
       AND eq.question_type = 'open'
       AND COALESCE(TRIM(eq.model_answer), '') <> ''
     WHERE er.submitted_at IS NOT NULL
       AND COALESCE(e.is_deleted, FALSE) = FALSE
     GROUP BY er.id, e.title, e.instructor_id`,
  );

  const pendingByExam = new Map();

  for (const row of rows) {
    let grading = row.grading;
    if (typeof grading === 'string') {
      try {
        grading = JSON.parse(grading);
      } catch {
        grading = {};
      }
    }
    if (!grading || typeof grading !== 'object') continue;

    let answers = row.answers;
    if (typeof answers === 'string') {
      try {
        answers = JSON.parse(answers);
      } catch {
        answers = {};
      }
    }

    const needsConfirm = Object.values(grading).some(
      (g) => g && g.type === 'open' && g.grading_status === 'ai_suggested',
    );
    if (!needsConfirm) continue;

    const key = `${row.instructor_id}::${row.exam_id}`;
    const hit = pendingByExam.get(key) || {
      instructor_id: row.instructor_id,
      exam_id: row.exam_id,
      exam_title: row.exam_title,
      student_count: 0,
    };
    hit.student_count += 1;
    pendingByExam.set(key, hit);
  }

  let sent = 0;
  for (const item of pendingByExam.values()) {
    const { rows: already } = await db.query(
      `SELECT 1 FROM notifications
       WHERE user_id = $1
         AND type = 'open_grading_pending'
         AND meta->>'exam_id' = $2
         AND created_at >= CURRENT_DATE
       LIMIT 1`,
      [item.instructor_id, item.exam_id],
    );
    if (already.length) continue;

    const n = item.student_count;
    const title = 'Açıq sual qiymətləndirməsi';
    const body = `${n} tələbənin cavabı təsdiqinizi gözləyir — «${item.exam_title}». Analytics → Nəticələrə bax.`;
    const meta = JSON.stringify({
      exam_id: item.exam_id,
      pending_count: n,
      kind: 'open_grading_pending',
    });

    await db
      .query(
        `INSERT INTO notifications (user_id, title, body, type, is_read, meta)
         VALUES ($1, $2, $3, 'open_grading_pending', FALSE, $4::jsonb)`,
        [item.instructor_id, title, body, meta],
      )
      .catch((e) => console.error('openGradingInstructorNotify insert', e.message));

    try {
      const to = await userEmail(item.instructor_id);
      if (to) {
        await sendEmail({
          to,
          subject: `Mentorix — ${title}`,
          text: `${body}\n\nMentorix → İmtahanlar → Analytics bölməsindən cavabları təsdiqləyin.`,
        });
      }
    } catch (e) {
      console.error('openGradingInstructorNotify email', e.message);
    }

    sent += 1;
  }

  return { sent, exams: pendingByExam.size };
}

module.exports = { runOpenGradingInstructorNotifications };
