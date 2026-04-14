const db = require('../utils/db');

const normType = (t) => String(t ?? '').trim().toLowerCase();

function inferQuestionType(q) {
  const t = normType(q?.question_type);
  if (['closed', 'multiple', 'matching', 'open'].includes(t)) return t;
  // Legacy / inconsistent DB rows: infer from options shape
  const opts = q?.options;
  if (Array.isArray(opts) && opts.some((r) => r && typeof r === 'object' && ('left' in r || 'right' in r))) {
    return 'matching';
  }
  return t || 'open';
}

/** Yalnız qapalı: səhv cavaba tətbiq olunan mənfi (default -0.25) */
function autoWrongPenalty(q) {
  if (inferQuestionType(q) !== 'closed') return 0;
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

function parseAzNumber(str) {
  const s = String(str ?? '').trim();
  if (!s) return null;
  const normalized = s.replace(',', '.').replace(/\s+/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function openAutoKey(q) {
  if (inferQuestionType(q) !== 'open') return null;
  const hint = q.template_hint != null ? String(q.template_hint).trim() : '';
  const hn = parseAzNumber(hint);
  return hn == null ? null : hn;
}

/**
 * Uyğunluq cavabı üçün strict müqayisə:
 * - whitespace nəzərə alınmır
 * - böyük/kiçik hərf nəzərə alınmır
 * - qalan bütün simvollar simvol-simvol müqayisə olunur (order-sensitive)
 */
function normMatchStrict(str) {
  return String(str ?? '').trim().toLowerCase().replace(/\s+/g, '');
}

function deriveMatchingKeyFromOptions(options) {
  if (!Array.isArray(options)) return '';
  let key = '';
  for (let i = 0; i < options.length; i++) {
    const row = options[i];
    if (!row || typeof row !== 'object') continue;
    const L = String(row.left ?? '').trim();
    const R = String(row.right ?? '').trim();
    const num = (L.match(/\d+/) || [])[0] || String(i + 1);
    const letters = R.replace(/[^a-z]/gi, '').toLowerCase();
    for (const ch of letters) {
      if (/[a-z]/.test(ch)) key += num + ch;
    }
  }
  return key;
}

function gradeMatching(given, correct, optionsForFallback) {
  const g = normMatchStrict(given);
  const fallback = !String(correct ?? '').trim() ? deriveMatchingKeyFromOptions(optionsForFallback) : '';
  const c = normMatchStrict(String(correct ?? '').trim() ? correct : fallback);
  if (!g) return { status: 'pending', isCorrect: null };
  if (!c) return { status: 'pending', isCorrect: null };
  const ok = g === c;
  return { status: ok ? 'correct' : 'incorrect', isCorrect: ok };
}

/**
 * Submit-time auto-grading snapshot (DB üçün).
 * Hazırda ən kritik hissə: matching suallar dərhal correct/incorrect olsun.
 */
function buildAutoGradingMap(questions, answers) {
  const out = {};
  for (const q of questions || []) {
    if (!q?.id) continue;
    const type = inferQuestionType(q);
    const id = q.id;
    const raw = answers?.[id];
    const given = raw == null || raw === '' ? '' : String(raw);

    if (type === 'matching') {
      const correct = String(q.correct_answer ?? '');
      const g = gradeMatching(given, correct, q.options);
      const pts = Number(q.points || 0);
      out[id] = {
        type: 'matching',
        status: g.status,
        earned_points: g.status === 'correct' ? pts : 0,
      };
    }
  }
  return out;
}

/**
 * Avtomatik bal: qapalı (mənfi bal ola bilər), çoxseçimli, uyğunluq (mənfi bal ola bilər).
 * Açıq sual: `template_hint` rəqəmdirsə avtomatik yoxlanır (məs. "4.8"); yoxsa manual qalır.
 * Qeyd: score artıq FAİZ deyil — xam baldır (points).
 * Cərimə yalnız qapalı suallara tətbiq olunur:
 * wrongPenalty = negative_marking (məs. -0.25) × points.
 */
const calculateScore = (questions, answers) => {
  let earned = 0;
  const scored = (questions || []).filter((q) =>
    ['closed', 'multiple', 'matching', 'open'].includes(inferQuestionType(q))
  );

  for (const q of scored) {
    const type = inferQuestionType(q);
    const given =
      answers[q.id] != null && answers[q.id] !== '' ? String(answers[q.id]).trim() : '';
    if (!given) continue;

    if (type === 'closed') {
      const correct = String(q.correct_answer ?? '').trim();
      const pen = autoWrongPenalty(q);
      const pts = Number(q.points || 0);
      if (given === correct) earned += pts;
      else earned += pen * pts;
    } else if (type === 'multiple') {
      if (normDigits(given) === normDigits(q.correct_answer)) earned += Number(q.points || 0);
    } else if (type === 'matching') {
      const keyStored = String(q.correct_answer ?? '').trim();
      const g = gradeMatching(given, keyStored, q.options);
      if (g.status === 'correct') earned += Number(q.points || 0);
    } else if (type === 'open') {
      const key = openAutoKey(q);
      if (key == null) continue;
      const gn = parseAzNumber(given);
      if (gn == null) continue;
      const ok = Math.abs(gn - key) < 1e-9;
      if (ok) earned += Number(q.points || 0);
    }
  }

  earned = Math.max(0, earned);
  return Math.round(earned * 100) / 100;
};

/**
 * Tələbə UI: təqdimetmədən sonra hər sual üçün şablon vs yazılan cavab.
 */
const buildExamResultBreakdown = (questions, answers) => {
  const order = [...questions].sort((a, b) => (a.order_num || 0) - (b.order_num || 0));
  return order.map((q, idx) => {
    const raw = answers[q.id];
    const given = raw == null || raw === '' ? '' : String(raw).trim();
    const type = inferQuestionType(q);
    let correctDisplay = '';
    let isCorrect = null;

    if (type === 'closed') {
      correctDisplay = ''; // tələbəyə düzgün cavabı göstərmirik
      if (!given) isCorrect = null;
      else isCorrect = given === String(q.correct_answer ?? '').trim();
    } else if (type === 'multiple') {
      const hint = String(q.template_hint || '').trim();
      correctDisplay = hint ? `Nümunə: ${hint}` : 'Nümunə: 13';
      if (!given) isCorrect = null;
      else isCorrect = normDigits(given) === normDigits(q.correct_answer);
    } else if (type === 'matching') {
      const hint = String(q.template_hint || '').trim();
      correctDisplay = hint ? `Nümunə: ${hint}` : 'Nümunə: 1a2b3c';
      if (!given) isCorrect = null;
      else isCorrect = gradeMatching(given, q.correct_answer, q.options).isCorrect;
    } else if (type === 'open') {
      const hint = String(q.template_hint || '').trim();
      correctDisplay = hint ? `Nümunə / gözlənti: ${hint}` : 'Müəllim qiymətləndirir';
      const key = openAutoKey(q);
      if (!given) isCorrect = null;
      else if (key == null) isCorrect = null;
      else {
        const gn = parseAzNumber(given);
        isCorrect = gn == null ? false : Math.abs(gn - key) < 1e-9;
      }
    }

    let statusLabel = 'Manual qiymətləndirmə';
    if (type === 'open') {
      if (!given) statusLabel = 'Cavabsız';
      else if (isCorrect === true) statusLabel = 'Düzgün';
      else if (isCorrect === false) statusLabel = openAutoKey(q) == null ? 'Manual qiymətləndirmə' : 'Səhv';
      else statusLabel = 'Manual qiymətləndirmə';
    }
    else if (!given) statusLabel = 'Cavabsız';
    else if (isCorrect === true) statusLabel = type === 'matching' ? 'Doğru' : 'Düzgün';
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
    `SELECT e.title, e.show_results, e.notify_students, e.notify_enabled, e.instructor_id, u.full_name AS student_name,
            COALESCE(NULLIF(TRIM(sp.parent_phone), ''), pu.phone, u.phone) AS notify_phone
     FROM exams e
     JOIN exam_assignments ea ON ea.exam_id = e.id AND ea.student_id = $2
     JOIN users u ON u.id = $2
     LEFT JOIN student_profiles sp ON sp.user_id = u.id
     LEFT JOIN users pu ON pu.id = sp.parent_id
     WHERE e.id = $1`,
    [examId, studentId]
  );
  if (!row?.notify_students || !row?.notify_enabled) return;
  if (!row?.notify_phone) return;

  const clean = String(row.notify_phone).replace(/\D/g, '');
  if (clean.length < 9) return;

  const name = row.student_name || 'Tələbə';
  const pts = Math.round(Number(score) * 100) / 100;
  const safePts = Number.isFinite(pts) ? pts : 0;
  const title = String(row.title || 'İmtahan').trim();
  const msg = `Mentorix: Salam, ${name}! "${title}" imtahanında ${safePts} bal toplayıb.`;

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
  buildAutoGradingMap,
  rankResults,
  isExamActive,
  processExamNotificationJobs,
  syncExamReminderJob,
  notifyParentExamResultAfterSubmit,
};
