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

/**
 * Avtomatik bal: yalnız QAPALI suallar.
 * — Düzgün → +həmin sualın points-i
 * — Səhv (cavab verilib) → negative_marking (adətən -0.25; 0 = cərimə yox)
 * — Boş → 0 (nə bal, nə cərimə)
 * Faiz = earned / (yalnız qapalı sualların points cəmi) × 100.
 * Açıq / çoxseçimli / uyğunluq: avtomatik hesabda nə cərimə, nə müsbət bal (müəllim/manual üçün).
 */
const calculateScore = (questions, answers) => {
  let earned = 0;
  const closedQs = questions.filter((q) => q.question_type === 'closed');
  const totalPoints = closedQs.reduce((s, q) => s + Number(q.points || 0), 0);
  if (totalPoints <= 0) return 0;

  for (const q of closedQs) {
    const ans = answers[q.id];
    const correct = String(q.correct_answer ?? '').trim();
    const given = ans != null && ans !== '' ? String(ans).trim() : '';
    const pen = closedWrongPenalty(q);
    if (given) {
      if (given === correct) {
        earned += Number(q.points || 0);
      } else {
        earned += pen;
      }
    }
  }

  earned = Math.max(0, earned);
  return Math.round((earned / totalPoints) * 100);
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

// Bildiriş zamanlarını yoxla
const checkNotifications = async () => {
  const now = new Date();
  const { rows: exams } = await db.query(
    `SELECT e.*, u.full_name AS instructor_name
     FROM exams e
     JOIN users u ON u.id = e.instructor_id
     WHERE e.notify_enabled = TRUE
       AND e.status = 'scheduled'
       AND e.start_time > NOW()`
  );

  for (const exam of exams) {
    const start = new Date(exam.start_time);
    const hoursUntil = (start - now) / 3600000;

    if (Math.abs(hoursUntil - exam.notify_before_hours) < 0.1) {
      await notifyStudents(exam);
    }
  }
};

const notifyStudents = async (exam) => {
  const { sendSms } = require('./smsService');
  const { rows: assignments } = await db.query(
    `SELECT ea.student_id, u.phone, u.full_name,
            sp.parent_id,
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
    const targetPhone = s.parent_phone || s.phone;
    if (!targetPhone) continue;

    await sendSms({
      instructorId: exam.instructor_id,
      phone: targetPhone,
      message: `Mentorix: "${exam.title}" imtahani ${startTime} tarixinde bashlayacaq. Hazir olun!`,
    });
  }
};

module.exports = { calculateScore, rankResults, isExamActive, checkNotifications };
