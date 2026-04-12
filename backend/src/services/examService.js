const db = require('../utils/db');

function closedWrongPenalty(q) {
  if (q.question_type !== 'closed') return 0;
  const n = q.negative_marking;
  if (n === null || n === undefined || n === '') return -0.25;
  const v = Number(n);
  if (Number.isNaN(v)) return -0.25;
  if (v === 0) return 0;
  return v;
}

/** Çoxseçimli: yalnız rəqəmlər, ardıcıllıqdan asılı olmayaraq (23 = 32) */
function normDigits(str) {
  return String(str ?? '')
    .replace(/\D/g, '')
    .split('')
    .filter(Boolean)
    .sort()
    .join('');
}

function normMatchStr(str) {
  return String(str ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

/**
 * Avtomatik bal: qapalı (mənfi bal ola bilər), çoxseçimli, uyğunluq.
 * Açıq: avtomatik bala daxil deyil.
 * Faiz = earned / (bu tiplərin points cəmi) × 100.
 */
const calculateScore = (questions, answers) => {
  let earned = 0;
  const scored = questions.filter((q) =>
    ['closed', 'multiple', 'matching'].includes(q.question_type)
  );
  const totalPoints = scored.reduce((s, q) => s + Number(q.points || 0), 0);
  if (totalPoints <= 0) return 0;

  for (const q of scored) {
    const given =
      answers[q.id] != null && answers[q.id] !== '' ? String(answers[q.id]).trim() : '';
    if (!given) continue;

    if (q.question_type === 'closed') {
      const correct = String(q.correct_answer ?? '').trim();
      const pen = closedWrongPenalty(q);
      if (given === correct) earned += Number(q.points || 0);
      else earned += pen;
    } else if (q.question_type === 'multiple') {
      if (normDigits(given) === normDigits(q.correct_answer)) earned += Number(q.points || 0);
    } else if (q.question_type === 'matching') {
      if (normMatchStr(given) === normMatchStr(q.correct_answer))
        earned += Number(q.points || 0);
    }
  }

  earned = Math.max(0, earned);
  return Math.round((earned / totalPoints) * 100);
};

/**
 * Tələbə UI: təqdimetmədən sonra hər sual üçün şablon vs yazılan cavab.
 */
const buildExamResultBreakdown = (questions, answers) => {
  const order = [...questions].sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
  return order.map((q, idx) => {
    const raw = answers[q.id];
    const given = raw == null || raw === '' ? '' : String(raw).trim();
    const type = q.question_type;
    let correctDisplay = '';
    let isCorrect = null;

    if (type === 'closed') {
      correctDisplay = String(q.correct_answer ?? '').trim() || '—';
      if (!given) isCorrect = null;
      else isCorrect = given === String(q.correct_answer ?? '').trim();
    } else if (type === 'multiple') {
      correctDisplay = String(q.correct_answer ?? '').trim() || '—';
      if (!given) isCorrect = null;
      else isCorrect = normDigits(given) === normDigits(q.correct_answer);
    } else if (type === 'matching') {
      correctDisplay = String(q.correct_answer ?? '').trim() || '—';
      if (!given) isCorrect = null;
      else isCorrect = normMatchStr(given) === normMatchStr(q.correct_answer);
    } else if (type === 'open') {
      const hint = String(q.template_hint || '').trim();
      correctDisplay = hint ? `Nümunə / gözlənti: ${hint}` : 'Müəllim qiymətləndirir';
      isCorrect = null;
    }

    let statusLabel = 'Manual qiymətləndirmə';
    if (type === 'open') statusLabel = 'Manual qiymətləndirmə';
    else if (!given) statusLabel = 'Cavabsız';
    else if (isCorrect === true) statusLabel = 'Düzgün';
    else if (isCorrect === false) statusLabel = 'Səhv';

    return {
      order: idx + 1,
      question_id: q.id,
      question_type: type,
      question_text: q.question_text || `Sual ${idx + 1}`,
      student_answer: given || '—',
      correct_display: correctDisplay,
      is_correct: isCorrect,
      status_label: statusLabel,
    };
  });
};

// Neticeleri sirala
const rankResults = async (examId) => {
  const { rows } = await db.query(
    `SELECT er.*, u.full_name
     FROM exam_results er
     JOIN users u ON u.id = er.student_id
     WHERE er.exam_id = $1
     ORDER BY er.score DESC, er.duration_seconds ASC`,
    [examId]
  );
  return rows;
};

// Imtahan aktiv mi yoxla
const isExamActive = (exam) => {
  const now = new Date();
  const start = new Date(exam.start_time);
  const end = new Date(start.getTime() + exam.duration_minutes * 60000);
  return now >= start && now <= end;
};

const REMINDER_MINUTES_BEFORE = 5;

/** İmtahan başlamasına ~5 dəq qalmış: əvvəlcə tələbə nömrəsi, yoxdursa valideyn. */
const sendExamStartReminderForExam = async (exam) => {
  const { sendSms } = require('./smsService');
  const { rows: assignments } = await db.query(
    `SELECT ea.student_id, u.phone, u.full_name,
            COALESCE(NULLIF(TRIM(sp.parent_phone), ''), pu.phone) AS parent_phone
     FROM exam_assignments ea
     JOIN users u ON u.id = ea.student_id
     LEFT JOIN student_profiles sp ON sp.user_id = ea.student_id
     LEFT JOIN users pu ON pu.id = sp.parent_id
     WHERE ea.exam_id = $1`,
    [exam.id]
  );

  const startTime = new Date(exam.start_time).toLocaleString('az-AZ');

  for (const s of assignments) {
    const st = s.phone && String(s.phone).replace(/\D/g, '').length >= 9 ? s.phone : '';
    const par = s.parent_phone && String(s.parent_phone).replace(/\D/g, '').length >= 9 ? s.parent_phone : '';
    const targetPhone = st || par;
    if (!targetPhone) continue;

    const r = await sendSms({
      instructorId: exam.instructor_id,
      phone: targetPhone,
      message: `Mentorix: "${exam.title}" imtahani ${startTime} tarixinde bashlayacaq (~${REMINDER_MINUTES_BEFORE} deq qalib). Hazir olun!`,
    });
    if (!r?.success) console.error('exam reminder SMS failed', targetPhone, r?.error);
  }
};

/**
 * Cron: vaxti catmis exam_reminder job-larini emal edir.
 */
const processExamNotificationJobs = async () => {
  const { rows } = await db.query(
    `SELECT nj.id AS job_id, e.id AS exam_id, e.instructor_id, e.title, e.start_time,
            e.notify_students, e.notify_enabled, e.status
     FROM notification_jobs nj
     INNER JOIN exams e ON e.id = nj.exam_id
     WHERE nj.processed_at IS NULL
       AND nj.job_type = 'exam_reminder'
       AND nj.run_at <= NOW()
     ORDER BY nj.run_at
     LIMIT 40`
  );

  for (const row of rows) {
    const skip =
      row.notify_students !== true ||
      row.notify_enabled !== true ||
      row.status !== 'scheduled';
    if (skip) {
      await db.query('UPDATE notification_jobs SET processed_at = NOW() WHERE id = $1', [row.job_id]);
      continue;
    }
    const exam = {
      id: row.exam_id,
      instructor_id: row.instructor_id,
      title: row.title,
      start_time: row.start_time,
    };
    try {
      await sendExamStartReminderForExam(exam);
    } catch (err) {
      console.error('exam reminder SMS', row.job_id, err.message);
    }
    await db.query('UPDATE notification_jobs SET processed_at = NOW() WHERE id = $1', [row.job_id]);
  }
};

/**
 * Yeni / yenilənmiş imtahan üçün tək exam_reminder job-u (başlamadan 5 dəq əvvəl).
 * İmtahan <5 dəq sonraya planlanıbsa, dərhal SMS (cron gözləmədən).
 */
const syncExamReminderJob = async (examId) => {
  await db.query(
    `DELETE FROM notification_jobs
     WHERE exam_id = $1 AND job_type = 'exam_reminder' AND processed_at IS NULL`,
    [examId]
  );

  const { rows: [exam] } = await db.query('SELECT * FROM exams WHERE id = $1', [examId]);
  if (!exam) return;

  const notifyOn =
    exam.notify_students === true &&
    exam.notify_enabled === true &&
    exam.status === 'scheduled';
  if (!notifyOn) return;

  const startMs = new Date(exam.start_time).getTime();
  const now = Date.now();
  if (Number.isNaN(startMs) || startMs <= now) return;

  const runAtMs = startMs - REMINDER_MINUTES_BEFORE * 60 * 1000;
  if (runAtMs > now) {
    await db.query(
      `INSERT INTO notification_jobs (exam_id, job_type, run_at) VALUES ($1, 'exam_reminder', $2)`,
      [examId, new Date(runAtMs)]
    );
  } else {
    await sendExamStartReminderForExam(exam);
  }
};

/** Tələbə təqdimetdikdən sonra valideynə (əvvəlcə profil valideyn nömrəsi, sonra valideyn user, sonra tələbə). */
const notifyParentExamResultAfterSubmit = async (examId, studentId, score) => {
  const { sendSms } = require('./smsService');
  const { rows: [row] } = await db.query(
    `SELECT e.title, e.show_results, e.instructor_id, u.full_name AS student_name,
            COALESCE(NULLIF(TRIM(sp.parent_phone), ''), pu.phone, u.phone) AS notify_phone
     FROM exams e
     JOIN exam_assignments ea ON ea.exam_id = e.id AND ea.student_id = $2
     JOIN users u ON u.id = $2
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     LEFT JOIN users pu ON pu.id = sp.parent_id
     WHERE e.id = $1`,
    [examId, studentId]
  );
  if (!row?.notify_phone) return;

  const clean = String(row.notify_phone).replace(/\D/g, '');
  if (clean.length < 9) return;

  const name = row.student_name || 'Tələbə';
  const pct = Math.round(Number(score));
  const safePct = Number.isFinite(pct) ? pct : 0;
  const title = String(row.title || 'İmtahan').trim();
  const msg = `Mentorix: Salam, ${name}! "${title}" imtahanında ${safePct}% toplayıb.`;

  const r = await sendSms({
    instructorId: row.instructor_id,
    phone: row.notify_phone,
    message: msg,
  });
  if (!r?.success) console.error('exam result SMS failed', r?.error);
};

module.exports = {
  calculateScore,
  buildExamResultBreakdown,
  rankResults,
  isExamActive,
  processExamNotificationJobs,
  syncExamReminderJob,
  notifyParentExamResultAfterSubmit,
};
