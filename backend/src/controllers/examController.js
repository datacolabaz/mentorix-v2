const db = require('../utils/db');
const { calculateScore, rankResults } = require('../services/examService');

// Imtahan yarat
const createExam = async (req, res) => {
  try {
    const {
      title, pdf_url, duration_minutes, start_time,
      notify_enabled, notify_before_hours, show_results,
      questions, student_ids,
    } = req.body;

    const result = await db.transaction(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO exams (instructor_id, title, pdf_url, duration_minutes, start_time,
          notify_enabled, notify_before_hours, show_results, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'scheduled') RETURNING *`,
        [req.user.id, title, pdf_url, duration_minutes, start_time,
          notify_enabled, notify_before_hours, show_results]
      );

      const exam = rows[0];

      if (questions?.length) {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          await client.query(
            `INSERT INTO exam_questions (exam_id, question_text, question_type, options, correct_answer, points, order_num)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [exam.id, q.question_text, q.question_type, JSON.stringify(q.options || null),
              q.correct_answer, q.points, i + 1]
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
      [req.user.id]
    );
    res.json({ success: true, exams: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Imtahan suallarini al
const getExamQuestions = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows: [exam] } = await db.query('SELECT * FROM exams WHERE id = $1', [id]);
    if (!exam) return res.status(404).json({ success: false, message: 'Tapılmadı' });

    const now = new Date();
    const start = new Date(exam.start_time);
    const end = new Date(start.getTime() + exam.duration_minutes * 60000);

    if (now < start)
      return res.status(400).json({ success: false, message: 'İmtahan hələ başlamayıb' });
    if (now > end)
      return res.status(400).json({ success: false, message: 'İmtahan bitmişdir' });

    const { rows: questions } = await db.query(
      'SELECT * FROM exam_questions WHERE exam_id = $1 ORDER BY order_num',
      [id]
    );

    // Closed suallar ucun correct_answer-i gizlet
    const safe = questions.map(({ correct_answer, ...rest }) => rest);

    res.json({ success: true, exam, questions: safe });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Imtahan cavablarini gondor
const submitExam = async (req, res) => {
  try {
    const { exam_id, answers, started_at } = req.body;
    const student_id = req.user.id;

    const already = await db.query(
      'SELECT id FROM exam_results WHERE exam_id=$1 AND student_id=$2',
      [exam_id, student_id]
    );
    if (already.rows[0])
      return res.status(400).json({ success: false, message: 'Artıq təqdim edilib' });

    const { rows: questions } = await db.query(
      'SELECT * FROM exam_questions WHERE exam_id=$1',
      [exam_id]
    );

    const score = calculateScore(questions, answers);
    const now = new Date();
    const duration = Math.floor((now - new Date(started_at)) / 1000);

    await db.query(
      `INSERT INTO exam_results (exam_id, student_id, score, answers, started_at, submitted_at, duration_seconds)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [exam_id, student_id, score, JSON.stringify(answers), started_at, now, duration]
    );

    res.json({ success: true, score });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Neticeleri al (sirali)
const getResults = async (req, res) => {
  try {
    const rows = await rankResults(req.params.id);
    res.json({ success: true, results: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { createExam, listExams, studentExams, getExamQuestions, submitExam, getResults };
