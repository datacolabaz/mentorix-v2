const db = require('../utils/db');
const { normalizeExamStartTime } = require('../utils/examTime');
const {
  calculateScore,
  buildExamResultBreakdown,
  rankResults,
  syncExamReminderJob,
  notifyParentExamResultAfterSubmit,
} = require('../services/examService');

// Imtahan yarat
const createExam = async (req, res) => {
  try {
    const {
      title,
      subject,
      topic,
      pdf_url,
      exam_files,
      duration_minutes,
      start_time,
      notify_enabled,
      notify_before_hours,
      notify_students,
      show_results,
      questions,
      student_ids,
    } = req.body;

    const startNorm = normalizeExamStartTime(start_time);
    const notifyOn = notify_students === true || notify_students === 'true' || notify_enabled === true;
    const notifyHours =
      notify_before_hours != null && notify_before_hours !== ''
        ? Number(notify_before_hours)
        : 1;

    const result = await db.transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO exams (instructor_id, title, subject, topic, pdf_url, exam_files, duration_minutes, start_time,
          notify_enabled, notify_students, notify_before_hours, show_results, status)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11,$12,'scheduled') RETURNING *`,
        [
          req.user.id,
          title,
          subject || null,
          topic || null,
          pdf_url || null,
          JSON.stringify(Array.isArray(exam_files) ? exam_files : []),
          duration_minutes,
          startNorm,
          notifyOn,
          notifyOn,
          notifyHours,
          show_results !== false,
        ]
      );

      const exam = rows[0];

      if (questions?.length) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const neg =
            q.negative_marking != null && q.negative_marking !== ''
              ? Number(q.negative_marking)
              : q.question_type === 'closed'
                ? -0.25
                : 0;
          const qText = (q.question_text && String(q.question_text).trim()) || `Sual ${i + 1}`;
          const correctAns =
            q.question_type === 'matching'
              ? String(q.correct_answer || q.template_hint || '').trim() || null
              : q.correct_answer != null && q.correct_answer !== ''
                ? q.correct_answer
                : null;
          const templateHint =
            q.template_hint != null && String(q.template_hint).trim() !== ''
              ? String(q.template_hint).trim()
              : null;
          await client.query(
            `INSERT INTO exam_questions (exam_id, question_text, question_type, options, correct_answer, points, order_num, negative_marking, template_hint)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
            [
              exam.id,
              qText,
              q.question_type,
              JSON.stringify(q.options || null),
              correctAns,
              q.points,
              i + 1,
              neg,
              templateHint,
            ]
          );
        }
      }

      if (student_ids?.length) {
        for (const sid of student_ids) {
          await client.query(
            'INSERT INTO exam_assignments (exam_id, student_id) VALUES ($1,$2)',
            [exam.id, sid]
          );
        }
      }

      return exam;
    });

    res.status(201).json({ success: true, exam: result });
    setImmediate(() => {
      syncExamReminderJob(result.id).catch((e) => console.error('syncExamReminderJob', e.message));
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Imtahanları listele
const listExams = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { rows } = await db.query(
      `SELECT e.*, u.full_name AS instructor_name,
        COUNT(ea.id) AS student_count
       FROM exams e
       JOIN users u ON u.id = e.instructor_id
       LEFT JOIN exam_assignments ea ON ea.exam_id = e.id
       WHERE ($1 OR e.instructor_id = $2)
       GROUP BY e.id, u.full_name
       ORDER BY e.start_time DESC`,
      [isAdmin, req.user.id]
    );
    res.json({ success: true, exams: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Müəllim paneli: hər tələbə üçün bu müəllimin imtahanlarında orta bal (təqdim olunmuş nəticələr) */
const instructorStudentExamProgress = async (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    const { rows } = await db.query(
      `SELECT er.student_id,
              u.full_name,
              ROUND(AVG(er.score))::int AS exam_avg_score,
              COUNT(er.id)::int AS exams_taken
       FROM exam_results er
       JOIN exams e ON e.id = er.exam_id
       JOIN users u ON u.id = er.student_id
       WHERE er.submitted_at IS NOT NULL
         AND ($1::boolean OR e.instructor_id = $2::uuid)
       GROUP BY er.student_id, u.full_name
       ORDER BY u.full_name`,
      [isAdmin, req.user.id]
    );
    res.json({ success: true, stats: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Telebe ucun imtahanlar
const studentExams = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT e.*, er.score, er.submitted_at,
        eq_count.question_count
       FROM exam_assignments ea
       JOIN exams e ON e.id = ea.exam_id
       LEFT JOIN exam_results er ON er.exam_id = e.id AND er.student_id = $1
       LEFT JOIN (
         SELECT exam_id, COUNT(*) AS question_count FROM exam_questions GROUP BY exam_id
       ) eq_count ON eq_count.exam_id = e.id
       WHERE ea.student_id = $1
       ORDER BY e.start_time DESC`,
      [req.user.