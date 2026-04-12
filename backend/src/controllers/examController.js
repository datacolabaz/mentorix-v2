const db = require('../utils/db');
const { normalizeExamStartTime } = require('../utils/examTime');

/** JWT / DB UUID format fərqi olanda exam_assignments uyğunlaşması */
const normStudentHex = (id) =>
  id == null ? '' : String(id).trim().toLowerCase().replace(/-/g, '');
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
    const sidHex = normStudentHex(req.user.id);
    if (!sidHex) {
      return res.status(400).json({ success: false, message: 'İstifadəçi identifikatoru yoxdur' });
    }
    /** Təyinat + nəticə: yalnız exam_assignments istifadə etsək, nəticəsi olan amma təyinatı
     *  silinmiş/köhnə DB-də olmayan tələbələr üçün siyahı boş qalır; müəllim statistikası isə
     *  exam_results-dan görünür. */
    const { rows } = await db.query(
      `WITH my_exam_ids AS (
         SELECT DISTINCT ea.exam_id AS exam_id
         FROM exam_assignments ea
         WHERE REPLACE(LOWER(TRIM(ea.student_id::text)), '-', '') = $1
         UNION
         SELECT DISTINCT er.exam_id AS exam_id
         FROM exam_results er
         WHERE REPLACE(LOWER(TRIM(er.student_id::text)), '-', '') = $1
       )
       SELECT e.*, er.score, er.submitted_at,
         eq_count.question_count
       FROM my_exam_ids mei
       JOIN exams e ON e.id = mei.exam_id
       LEFT JOIN LATERAL (
         SELECT score, submitted_at FROM exam_results er0
         WHERE er0.exam_id = e.id
           AND REPLACE(LOWER(TRIM(er0.student_id::text)), '-', '') = $1
         ORDER BY er0.submitted_at DESC NULLS LAST
         LIMIT 1
       ) er ON TRUE
       LEFT JOIN (
         SELECT exam_id, COUNT(*) AS question_count FROM exam_questions GROUP BY exam_id
       ) eq_count ON eq_count.exam_id = e.id
       ORDER BY e.start_time DESC NULLS LAST`,
      [sidHex]
    );
    res.json({ success: true, exams: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/** Tələbə: təqdim etdikdən sonra öz nəticəsinə və sual üzrə xülasəyə baxış */
const getStudentExamReview = async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }
    const examId = req.params.id;
    const sidHex = normStudentHex(req.user.id);
    if (!sidHex) {
      return res.status(400).json({ success: false, message: 'İstifadəçi identifikatoru yoxdur' });
    }

    const { rows: resultRows } = await db.query(
      `SELECT score, answers, submitted_at FROM exam_results
       WHERE exam_id = $1
         AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2`,
      [examId, sidHex]
    );
    const result = resultRows[0];
    if (result?.submitted_at) {
      /* təqdim olunub — review (təyinatsız köhnə nəticələr də daxil) */
    } else {
      const { rows: assignRows } = await db.query(
        `SELECT 1 FROM exam_assignments
         WHERE exam_id = $1
           AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2`,
        [examId, sidHex]
      );
      if (!assignRows.length) {
        return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
      }
      return res.status(404).json({ success: false, message: 'Hələ təqdim olunmayıb' });
    }

    const { rows: [exam] } = await db.query('SELECT * FROM exams WHERE id = $1', [examId]);
    if (!exam) return res.status(404).json({ success: false, message: 'Tapılmadı' });

    const { rows: questions } = await db.query(
      'SELECT * FROM exam_questions WHERE exam_id = $1 ORDER BY order_num',
      [examId]
    );

    let answers = result.answers;
    if (typeof answers === 'string') {
      try {
        answers = JSON.parse(answers);
      } catch {
        answers = {};
      }
    }
    if (!answers || typeof answers !== 'object') answers = {};

    const breakdown = buildExamResultBreakdown(questions, answers);

    res.json({
      success: true,
      exam,
      score: result.score,
      submitted_at: result.submitted_at,
      breakdown,
    });
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

    if (req.user.role === 'student') {
      const sidHex = normStudentHex(req.user.id);
      if (!sidHex) {
        return res.status(400).json({ success: false, message: 'İstifadəçi identifikatoru yoxdur' });
      }
      const { rows: assigned } = await db.query(
        `SELECT 1 FROM exam_assignments WHERE exam_id = $1
         AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2`,
        [id, sidHex]
      );
      if (!assigned.length) {
        return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
      }
    } else if (req.user.role === 'instructor') {
      if (normStudentHex(exam.instructor_id) !== normStudentHex(req.user.id)) {
        return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
      }
    } else if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const now = new Date();
    const start = exam.start_time ? new Date(exam.start_time) : null;
    if (!start || Number.isNaN(start.getTime())) {
      return res.status(400).json({ success: false, message: 'İmtahan vaxtı təyin olunmayıb' });
    }
    const dur = Number(exam.duration_minutes) || 0;
    const end = new Date(start.getTime() + dur * 60000);

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

    const sidHex = normStudentHex(student_id);
    if (!sidHex) {
      return res.status(400).json({ success: false, message: 'İstifadəçi identifikatoru yoxdur' });
    }

    const { rows: assignSubmit } = await db.query(
      `SELECT 1 FROM exam_assignments WHERE exam_id = $1
       AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2`,
      [exam_id, sidHex]
    );
    if (!assignSubmit.length) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }

    const already = await db.query(
      `SELECT id FROM exam_results WHERE exam_id=$1
       AND REPLACE(LOWER(TRIM(student_id::text)), '-', '') = $2`,
      [exam_id, sidHex]
    );
    if (already.rows[0])
      return res.status(400).json({ success: false, message: 'Artıq təqdim edilib' });

    const { rows: questions } = await db.query(
      'SELECT * FROM exam_questions WHERE exam_id=$1',
      [exam_id]
    );

    const score = calculateScore(questions, answers);
    const breakdown = buildExamResultBreakdown(questions, answers);
    const now = new Date();
    const duration = Math.floor((now - new Date(started_at)) / 1000);

    await db.query(
      `INSERT INTO exam_results (exam_id, student_id, score, answers, started_at, submitted_at, duration_seconds)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [exam_id, student_id, score, JSON.stringify(answers), started_at, now, duration]
    );

    setImmediate(() => {
      notifyParentExamResultAfterSubmit(exam_id, student_id, score).catch((e) =>
        console.error('notifyParentExamResultAfterSubmit', e.message)
      );
    });

    res.json({ success: true, score, breakdown });
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

module.exports = {
  createExam,
  listExams,
  instructorStudentExamProgress,
  studentExams,
  getStudentExamReview,
  getExamQuestions,
  submitExam,
  getResults,
};
