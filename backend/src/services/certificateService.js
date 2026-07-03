const crypto = require('crypto');
const db = require('../utils/db');
const getCurrentPlan = require('./billingGetCurrentPlan');
const { planRank, normalizePlanSlug } = require('../config/plans');
const { generateCertificatePdf } = require('./certificatePdfService');
const { persistCertificateFileBlob } = require('./certificateFileStorage');
const { sendCertificateIssuedEmail } = require('./certificateEmailService');

function generateVerificationToken() {
  return crypto.randomBytes(18).toString('base64url');
}

async function instructorHasCertificateFeature(instructorId, client = db) {
  const sub = await getCurrentPlan(client, instructorId);
  const slug = normalizePlanSlug(sub?.plan);
  return planRank(slug) >= planRank('pro');
}

async function nextCertificateNo(client) {
  const year = new Date().getFullYear();
  const { rows } = await client.query(
    `INSERT INTO certificate_counters (year, last_seq)
     VALUES ($1, 1)
     ON CONFLICT (year) DO UPDATE SET last_seq = certificate_counters.last_seq + 1
     RETURNING last_seq`,
    [year],
  );
  const seq = rows[0]?.last_seq || 1;
  return `MTX-${year}-${String(seq).padStart(6, '0')}`;
}

async function getExamMaxPoints(client, examId) {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(COALESCE(points, 0)::numeric), 0) AS max_pts
     FROM exam_questions WHERE exam_id = $1`,
    [examId],
  );
  return Number(rows[0]?.max_pts || 0);
}

function scoreToPct(score, maxPts) {
  if (!maxPts || maxPts <= 0) return 0;
  return Math.round(Math.min(100, Math.max(0, (Number(score) / maxPts) * 100)) * 100) / 100;
}

function slimCertificateRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    certificate_no: row.certificate_no,
    verification_token: row.verification_token,
    score_pct: row.score_pct != null ? Number(row.score_pct) : null,
    status: row.status,
    issued_at: row.issued_at,
  };
}

async function loadExamCertificateConfig(examId) {
  const { rows } = await db.query(
    `SELECT e.id, e.title, e.subject, e.topic, e.instructor_id,
            COALESCE(e.certificate_enabled, FALSE) AS certificate_enabled,
            COALESCE(e.certificate_pass_pct, 70)::numeric AS certificate_pass_pct,
            e.certificate_template_id
     FROM exams e
     WHERE e.id = $1 AND COALESCE(e.is_deleted, FALSE) = FALSE`,
    [examId],
  );
  return rows[0] || null;
}

async function evaluateCertificateEligibility(examId, score, examRow = null) {
  const exam = examRow || (await loadExamCertificateConfig(examId));
  if (!exam) {
    return {
      certificate_enabled: false,
      pass_pct: null,
      score_pct: null,
      eligible: false,
      reason: 'exam_not_found',
    };
  }
  const maxPts = await getExamMaxPoints(db, examId);
  const scorePct = scoreToPct(score, maxPts);
  const passPct = Number(exam.certificate_pass_pct || 70);
  if (!exam.certificate_enabled) {
    return {
      certificate_enabled: false,
      pass_pct: passPct,
      score_pct: scorePct,
      eligible: false,
      reason: 'disabled',
    };
  }
  const allowed = await instructorHasCertificateFeature(exam.instructor_id);
  if (!allowed) {
    return {
      certificate_enabled: true,
      pass_pct: passPct,
      score_pct: scorePct,
      eligible: false,
      reason: 'instructor_plan',
    };
  }
  if (scorePct < passPct) {
    return {
      certificate_enabled: true,
      pass_pct: passPct,
      score_pct: scorePct,
      eligible: false,
      reason: 'below_pass',
    };
  }
  return {
    certificate_enabled: true,
    pass_pct: passPct,
    score_pct: scorePct,
    eligible: true,
    reason: null,
  };
}

async function getOrIssueCertificateForStudentExam(studentId, examId) {
  const { rows: existing } = await db.query(
    `SELECT id, certificate_no, verification_token, score_pct, status, issued_at
     FROM certificates
     WHERE student_id = $1 AND exam_id = $2 AND status = 'issued'
     ORDER BY issued_at DESC
     LIMIT 1`,
    [studentId, examId],
  );
  if (existing[0]) {
    const { rows: results } = await db.query(
      `SELECT score FROM exam_results
       WHERE exam_id = $1 AND student_id = $2 AND submitted_at IS NOT NULL
       ORDER BY submitted_at DESC LIMIT 1`,
      [examId, studentId],
    );
    const eligibility = results[0]
      ? await evaluateCertificateEligibility(examId, results[0].score)
      : null;
    return {
      certificate: slimCertificateRow(existing[0]),
      eligibility,
    };
  }

  const { rows: results } = await db.query(
    `SELECT id, score FROM exam_results
     WHERE exam_id = $1 AND student_id = $2 AND submitted_at IS NOT NULL
     ORDER BY submitted_at DESC
     LIMIT 1`,
    [examId, studentId],
  );
  const result = results[0];
  if (!result) {
    return { certificate: null, eligibility: { eligible: false, reason: 'not_submitted' } };
  }

  const eligibility = await evaluateCertificateEligibility(examId, result.score);
  if (!eligibility.eligible) {
    return { certificate: null, eligibility };
  }

  const cert = await maybeIssueCertificateAfterExamSubmit({
    examId,
    studentId,
    examResultId: result.id,
    score: result.score,
  });
  return {
    certificate: slimCertificateRow(cert),
    eligibility: cert
      ? eligibility
      : { ...eligibility, eligible: true, reason: 'issue_failed' },
  };
}

async function backfillCertificatesForExam(examId) {
  const exam = await loadExamCertificateConfig(examId);
  if (!exam?.certificate_enabled) return { issued: 0, skipped: 0 };
  if (!(await instructorHasCertificateFeature(exam.instructor_id))) {
    return { issued: 0, skipped: 0, reason: 'instructor_plan' };
  }

  const { rows } = await db.query(
    `SELECT id, student_id, score FROM exam_results
     WHERE exam_id = $1 AND submitted_at IS NOT NULL`,
    [examId],
  );

  let issued = 0;
  let skipped = 0;
  for (const row of rows) {
    const eligibility = await evaluateCertificateEligibility(examId, row.score, exam);
    if (!eligibility.eligible) {
      skipped += 1;
      continue;
    }
    const cert = await maybeIssueCertificateAfterExamSubmit({
      examId,
      studentId: row.student_id,
      examResultId: row.id,
      score: row.score,
    });
    if (cert) issued += 1;
    else skipped += 1;
  }
  return { issued, skipped };
}

async function listPendingCertificatesForStudent(studentId) {
  const { rows } = await db.query(
    `SELECT e.id AS exam_id, e.title, er.score, er.submitted_at,
            COALESCE(e.certificate_enabled, FALSE) AS certificate_enabled,
            COALESCE(e.certificate_pass_pct, 70)::numeric AS certificate_pass_pct
     FROM exam_results er
     JOIN exams e ON e.id = er.exam_id AND COALESCE(e.is_deleted, FALSE) = FALSE
     WHERE er.student_id = $1 AND er.submitted_at IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM certificates c
         WHERE c.exam_id = er.exam_id AND c.student_id = er.student_id AND c.status = 'issued'
       )
     ORDER BY er.submitted_at DESC
     LIMIT 12`,
    [studentId],
  );

  const pending = [];
  for (const row of rows) {
    const eligibility = await evaluateCertificateEligibility(row.exam_id, row.score);
    pending.push({
      exam_id: row.exam_id,
      title: row.title,
      submitted_at: row.submitted_at,
      certificate_enabled: eligibility.certificate_enabled,
      score_pct: eligibility.score_pct,
      pass_pct: eligibility.pass_pct,
      eligible: eligibility.eligible,
      reason: eligibility.reason,
    });
  }
  return pending;
}

async function resolveTemplate(client, instructorId, templateId) {
  if (templateId) {
    const { rows } = await client.query(
      `SELECT * FROM certificate_templates WHERE id = $1 AND instructor_id = $2 LIMIT 1`,
      [templateId, instructorId],
    );
    if (rows[0]) return rows[0];
  }
  const { rows } = await client.query(
    `SELECT * FROM certificate_templates
     WHERE instructor_id = $1
     ORDER BY is_default DESC, updated_at DESC
     LIMIT 1`,
    [instructorId],
  );
  if (rows[0]) return rows[0];
  const { rows: created } = await client.query(
    `INSERT INTO certificate_templates (instructor_id, name, is_default)
     VALUES ($1, 'Default', TRUE)
     RETURNING *`,
    [instructorId],
  );
  return created[0];
}

async function maybeIssueCertificateAfterExamSubmit({ examId, studentId, examResultId, score }) {
  try {
    const { rows: exams } = await db.query(
      `SELECT e.id, e.title, e.subject, e.topic, e.instructor_id,
              COALESCE(e.certificate_enabled, FALSE) AS certificate_enabled,
              COALESCE(e.certificate_pass_pct, 70)::numeric AS certificate_pass_pct,
              e.certificate_template_id
       FROM exams e
       WHERE e.id = $1 AND COALESCE(e.is_deleted, FALSE) = FALSE`,
      [examId],
    );
    const exam = exams[0];
    if (!exam?.certificate_enabled) return null;

    const allowed = await instructorHasCertificateFeature(exam.instructor_id);
    if (!allowed) return null;

    const maxPts = await getExamMaxPoints(db, examId);
    const scorePct = scoreToPct(score, maxPts);
    const passPct = Number(exam.certificate_pass_pct || 70);
    if (scorePct < passPct) return null;

    return issueCertificate({
      examId,
      studentId,
      examResultId,
      scorePct,
      passPct,
      exam,
    });
  } catch (e) {
    console.error('maybeIssueCertificateAfterExamSubmit', e.message);
    return null;
  }
}

async function issueCertificate({ examId, studentId, examResultId, scorePct, passPct, exam }) {
  return db.transaction(async (client) => {
    const { rows: people } = await client.query(
      `SELECT
         (SELECT full_name FROM users WHERE id = $1) AS student_name,
         (SELECT full_name FROM users WHERE id = $2) AS instructor_name,
         (SELECT email FROM users WHERE id = $1) AS student_email`,
      [studentId, exam.instructor_id],
    );
    const studentName = people[0]?.student_name || 'Tələbə';
    const instructorName = people[0]?.instructor_name || 'Müəllim';
    const studentEmail = people[0]?.student_email || null;

    const template = await resolveTemplate(client, exam.instructor_id, exam.certificate_template_id);
    const locale = template.locale === 'en' ? 'en' : 'az';

    const { rows: prev } = await client.query(
      `SELECT id FROM certificates
       WHERE exam_id = $1 AND student_id = $2 AND status = 'issued'
       ORDER BY issued_at DESC LIMIT 1`,
      [examId, studentId],
    );
    const previousId = prev[0]?.id || null;
    if (previousId) {
      await client.query(`UPDATE certificates SET status = 'superseded' WHERE id = $1`, [previousId]);
    }

    const certificateNo = await nextCertificateNo(client);
    const verificationToken = generateVerificationToken();
    const pdfFilename = `${crypto.randomUUID()}.pdf`;
    const issuedAt = new Date().toISOString();
    const courseTitle = exam.title || exam.subject || exam.topic || 'İmtahan';

    const snapshot = {
      certificate_no: certificateNo,
      verification_token: verificationToken,
      student_name: studentName,
      instructor_name: instructorName,
      exam_title: exam.title,
      course_title: courseTitle,
      subject: exam.subject,
      score_pct: scorePct,
      pass_pct: passPct,
      issued_at: issuedAt,
      locale,
      template_key: template.template_key,
      accent_color: template.accent_color,
      logo_url: template.logo_url,
      signature_url: template.signature_url,
    };

    const pdfBuffer = await generateCertificatePdf(snapshot);
    await persistCertificateFileBlob(pdfFilename, pdfBuffer);

    const { rows } = await client.query(
      `INSERT INTO certificates (
         certificate_no, verification_token, student_id, instructor_id,
         exam_id, exam_result_id, template_id, title, subject,
         score_pct, pass_pct, pdf_filename, status, previous_certificate_id,
         snapshot_json, locale, issued_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'issued',$13,$14::jsonb,$15,$16)
       RETURNING *`,
      [
        certificateNo,
        verificationToken,
        studentId,
        exam.instructor_id,
        examId,
        examResultId || null,
        template.id,
        courseTitle,
        exam.subject || null,
        scorePct,
        passPct,
        pdfFilename,
        previousId,
        JSON.stringify(snapshot),
        locale,
        issuedAt,
      ],
    );

    const cert = rows[0];

    setImmediate(() => {
      if (studentEmail) {
        sendCertificateIssuedEmail({
          email: studentEmail,
          studentName,
          courseTitle,
          certificateNo,
          verificationToken,
        }).catch((err) => console.error('sendCertificateIssuedEmail', err.message));
      }
    });

    return cert;
  });
}

async function getPublicVerification(token) {
  const safe = String(token || '').trim();
  if (!safe || safe.length > 80) return null;

  const { rows } = await db.query(
    `SELECT c.id, c.certificate_no, c.verification_token, c.title, c.subject,
            c.score_pct, c.pass_pct, c.status, c.issued_at, c.locale, c.snapshot_json,
            us.full_name AS student_name,
            ui.full_name AS instructor_name,
            sup.id AS superseded_by_id
     FROM certificates c
     JOIN users us ON us.id = c.student_id
     JOIN users ui ON ui.id = c.instructor_id
     LEFT JOIN LATERAL (
       SELECT id FROM certificates n
       WHERE n.previous_certificate_id = c.id AND n.status = 'issued'
       ORDER BY n.issued_at DESC LIMIT 1
     ) sup ON TRUE
     WHERE c.verification_token = $1
     LIMIT 1`,
    [safe],
  );
  if (!rows[0]) return null;
  const row = rows[0];
  return {
    valid: row.status === 'issued',
    status: row.status,
    certificate_no: row.certificate_no,
    student_name: row.student_name,
    instructor_name: row.instructor_name,
    course_title: row.title,
    subject: row.subject,
    score_pct: Number(row.score_pct),
    pass_pct: Number(row.pass_pct),
    issued_at: row.issued_at,
    locale: row.locale,
    superseded: row.status === 'superseded',
    superseded_by_id: row.superseded_by_id || null,
    issued_by: 'Mentorix',
  };
}

async function listStudentCertificates(studentId) {
  const { rows } = await db.query(
    `SELECT id, certificate_no, verification_token, title, subject, score_pct,
            status, issued_at, pdf_filename, locale
     FROM certificates
     WHERE student_id = $1 AND status IN ('issued', 'superseded')
     ORDER BY issued_at DESC`,
    [studentId],
  );
  return rows;
}

async function listInstructorCertificates(instructorId) {
  const { rows } = await db.query(
    `SELECT c.id, c.certificate_no, c.title, c.score_pct, c.status, c.issued_at,
            u.full_name AS student_name
     FROM certificates c
     JOIN users u ON u.id = c.student_id
     WHERE c.instructor_id = $1
     ORDER BY c.issued_at DESC
     LIMIT 500`,
    [instructorId],
  );
  return rows;
}

async function getInstructorCertificateStats(instructorId) {
  const { rows } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'issued')::int AS issued,
       COUNT(*) FILTER (WHERE status = 'issued' AND issued_at >= date_trunc('month', NOW()))::int AS this_month,
       COUNT(*)::int AS all_time
     FROM certificates
     WHERE instructor_id = $1`,
    [instructorId],
  );
  return rows[0] || { issued: 0, this_month: 0, all_time: 0 };
}

async function getAdminCertificateStats() {
  const { rows } = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'issued' AND issued_at >= date_trunc('day', NOW()))::int AS today,
       COUNT(*) FILTER (WHERE status = 'issued' AND issued_at >= date_trunc('month', NOW()))::int AS this_month,
       COUNT(*)::int AS all_time
     FROM certificates`,
  );
  return rows[0] || { today: 0, this_month: 0, all_time: 0 };
}

async function getCertificateForDownload({ certificateId, user }) {
  const { rows } = await db.query(`SELECT * FROM certificates WHERE id = $1 LIMIT 1`, [certificateId]);
  const cert = rows[0];
  if (!cert?.pdf_filename) return null;
  const role = user?.role;
  const uid = user?.id;
  if (role === 'admin') return cert;
  if (role === 'student' && String(cert.student_id) === String(uid)) return cert;
  if (role === 'instructor' && String(cert.instructor_id) === String(uid)) return cert;
  return null;
}

async function listTemplates(instructorId) {
  const { rows } = await db.query(
    `SELECT id, name, template_key, logo_url, signature_url, background_url,
            accent_color, locale, is_default, created_at, updated_at
     FROM certificate_templates
     WHERE instructor_id = $1
     ORDER BY is_default DESC, updated_at DESC`,
    [instructorId],
  );
  return rows;
}

async function upsertTemplate(instructorId, payload) {
  const {
    id,
    name = 'Default',
    template_key = 'classic',
    logo_url = null,
    signature_url = null,
    background_url = null,
    accent_color = '#4f46e5',
    locale = 'az',
    is_default = false,
  } = payload || {};

  if (id) {
    const { rows } = await db.query(
      `UPDATE certificate_templates SET
         name = $3, template_key = $4, logo_url = $5, signature_url = $6,
         background_url = $7, accent_color = $8, locale = $9, is_default = $10,
         updated_at = NOW()
       WHERE id = $1 AND instructor_id = $2
       RETURNING *`,
      [id, instructorId, name, template_key, logo_url, signature_url, background_url, accent_color, locale, !!is_default],
    );
    if (!rows[0]) return null;
    if (is_default) {
      await db.query(
        `UPDATE certificate_templates SET is_default = FALSE WHERE instructor_id = $1 AND id <> $2`,
        [instructorId, id],
      );
    }
    return rows[0];
  }

  const { rows } = await db.query(
    `INSERT INTO certificate_templates (
       instructor_id, name, template_key, logo_url, signature_url, background_url,
       accent_color, locale, is_default
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING *`,
    [instructorId, name, template_key, logo_url, signature_url, background_url, accent_color, locale, !!is_default],
  );
  return rows[0];
}

module.exports = {
  maybeIssueCertificateAfterExamSubmit,
  evaluateCertificateEligibility,
  getOrIssueCertificateForStudentExam,
  backfillCertificatesForExam,
  listPendingCertificatesForStudent,
  slimCertificateRow,
  getPublicVerification,
  listStudentCertificates,
  listInstructorCertificates,
  getInstructorCertificateStats,
  getAdminCertificateStats,
  getCertificateForDownload,
  listTemplates,
  upsertTemplate,
  instructorHasCertificateFeature,
};
