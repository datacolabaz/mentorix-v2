const db = require('../utils/db');

// Imtahan neticelerini hesabla
const calculateScore = (questions, answers) => {
  let score = 0;
  let wrongClosed = 0;
  let totalPoints = questions.reduce((s, q) => s + q.points, 0);

  for (const q of questions) {
    const ans = answers[q.id];
    if (q.question_type === 'closed') {
      if (ans === q.correct_answer) {
        score += q.points;
      } else if (ans) {
        wrongClosed++;
      }
    } else {
      // Aciq sual - muellim qiymetlendirir, hazirda 0
    }
  }

  // Her 4 sehv 1 dogrunun balini aparir
  const penalty = Math.floor(wrongClosed / 4) * (totalPoints / questions.filter(q => q.question_type === 'closed').length || 1);
  score = Math.max(0, score - penalty);

  return Math.round((score / totalPoints) * 100);
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
            sp.parent_id, pu.phone AS parent_phone
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
