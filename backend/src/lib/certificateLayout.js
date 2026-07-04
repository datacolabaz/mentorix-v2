/** Certificate layout — PDF generator (Node). Frontend uses @shared/certificateLayout.mjs. */

const COLORS = {
  primary: '#00E676',
  bgDark: '#13112e',
  bgDeep: '#0b0b0b',
  bgGradientFrom: '#1a1740',
  textWhite: '#F5F5FA',
  textMuted: '#9CA3AF',
  textDim: '#6B7280',
};

function getCertificateLabels(locale) {
  if (locale === 'ru') {
    return {
      brand: 'Mentorix',
      certLabel: 'MENTORIX CERTIFICATE',
      issued: 'Сертификат выдаётся',
      completed: 'успешно завершил(а)',
      instructor: 'Преподаватель',
      score: 'Балл',
      date: 'Дата',
      certId: 'ID сертификата',
      verify: 'Проверяется по QR-коду',
      disclaimer: 'Это не официальная государственная аккредитация.',
    };
  }
  if (locale === 'en') {
    return {
      brand: 'Mentorix',
      certLabel: 'MENTORIX CERTIFICATE',
      issued: 'Certificate of Achievement',
      completed: 'has successfully completed',
      instructor: 'Instructor',
      score: 'Score',
      date: 'Date',
      certId: 'Certificate ID',
      verify: 'Verified via QR code',
      disclaimer: 'This is not an official government accreditation.',
    };
  }
  return {
    brand: 'Mentorix',
    certLabel: 'MENTORIX CERTIFICATE',
    issued: 'Sertifikat verilir',
    completed: 'uğurla tamamlamışdır',
    instructor: 'Müəllim',
    score: 'Bal',
    date: 'Tarix',
    certId: 'Sertifikat ID',
    verify: 'QR kodu ilə doğrulanır',
    disclaimer: 'Bu rəsmi dövlət akkreditasiyası deyil.',
  };
}

function formatCertificateDate(iso, locale = 'az') {
  const loc = locale === 'ru' ? 'ru-RU' : locale === 'en' ? 'en-GB' : 'az-AZ';
  try {
    return new Date(iso).toLocaleDateString(loc, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return String(iso || '').slice(0, 10);
  }
}

function buildCertificateViewModel(input = {}, locale = 'az') {
  const lang = locale === 'ru' ? 'ru' : locale === 'en' ? 'en' : 'az';
  const L = getCertificateLabels(lang);
  const scorePct = Number(input.scorePct ?? input.score_pct ?? 0);
  const issuedAt = input.issuedAt || input.issued_at || new Date().toISOString();

  return {
    locale: lang,
    labels: L,
    certLabel: L.certLabel,
    issuedLabel: String(L.issued).toUpperCase(),
    studentName: String(input.studentName || input.student_name || '—'),
    courseTitle: String(input.courseTitle || input.course_title || input.examTitle || input.exam_title || '—'),
    completedLabel: L.completed,
    scoreLabel: String(L.score).toUpperCase(),
    scorePct: `${scorePct.toFixed(0)}%`,
    dateLabel: String(L.date).toUpperCase(),
    dateFormatted: formatCertificateDate(issuedAt, lang),
    instructorLine: `${L.instructor}: ${String(input.instructorName || input.instructor_name || '—')}`,
    verifyLabel: L.verify,
    disclaimer: L.disclaimer,
    certIdLine: `${L.certId}: ${String(input.certificateNo || input.certificate_no || '—')}`,
    accentColor: input.accentColor || input.accent_color || COLORS.primary,
    verificationToken: input.verificationToken || input.verification_token || null,
  };
}

const SAMPLE_CERTIFICATE = {
  studentName: 'Aylin Məmmədova',
  courseTitle: 'Data Analytics Professional Certification',
  instructorName: 'Mentorix Rəsmi',
  scorePct: 87,
  issuedAt: '2026-07-04T00:00:00.000Z',
  certificateNo: 'MTX-2026-000001',
  accentColor: COLORS.primary,
};

module.exports = {
  COLORS,
  getCertificateLabels,
  formatCertificateDate,
  buildCertificateViewModel,
  SAMPLE_CERTIFICATE,
};
