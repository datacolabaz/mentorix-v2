/**
 * Admin-only certificate revoke / reinstate. The controller writes admin_access_audit (with the
 * reason) before calling these. The public verify page shows "revoked" + date, never the reason.
 * While a revoked certificate exists for a student+exam, no new certificate is issued for that pair.
 */
const db = require('../utils/db');

const REASON_MIN = 5;
const REASON_MAX = 1000;

function err(statusCode, code, message) {
  return Object.assign(new Error(message), { statusCode, code });
}

function cleanReason(reason) {
  const r = String(reason || '').trim();
  if (r.length < REASON_MIN) throw err(400, 'REASON_REQUIRED', 'Səbəb tələb olunur (ən azı 5 simvol)');
  return r.slice(0, REASON_MAX);
}

async function searchCertificatesForAdmin({ q = '', status = '', limit = 50 } = {}) {
  const term = String(q || '').trim().slice(0, 120);
  const st = ['issued', 'superseded', 'revoked'].includes(status) ? status : '';
  const lim = Math.min(100, Math.max(1, Number(limit) || 50));
  const { rows } = await db.query(
    `SELECT c.id, c.certificate_no, c.title, c.status, c.issued_at, c.revoked_at, c.score_pct,
            us.full_name AS student_name, us.email AS student_email,
            ui.full_name AS instructor_name
     FROM certificates c
     JOIN users us ON us.id = c.student_id
     JOIN users ui ON ui.id = c.instructor_id
     WHERE ($1 = '' OR c.certificate_no ILIKE '%' || $1 || '%' OR us.full_name ILIKE '%' || $1 || '%'
            OR us.email ILIKE '%' || $1 || '%' OR c.title ILIKE '%' || $1 || '%')
       AND ($2 = '' OR c.status = $2)
     ORDER BY c.issued_at DESC
     LIMIT $3`,
    [term, st, lim],
  );
  return rows;
}

async function loadCertificateForAdmin(id) {
  const { rows } = await db.query(
    `SELECT id, student_id, exam_id, status, certificate_no FROM certificates WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows[0] || null;
}

async function revokeCertificate({ certificateId, adminId, reason }) {
  const why = cleanReason(reason);
  const { rows } = await db.query(
    `UPDATE certificates
     SET status = 'revoked', revoked_at = NOW(), revoked_by = $2, revoke_reason = $3
     WHERE id = $1 AND status = 'issued'
     RETURNING id, status, revoked_at`,
    [certificateId, adminId, why],
  );
  if (!rows[0]) {
    const cur = await loadCertificateForAdmin(certificateId);
    if (!cur) throw err(404, 'NOT_FOUND', 'Sertifikat tapılmadı');
    throw err(409, 'NOT_REVOCABLE', 'Yalnız aktiv (issued) sertifikat ləğv oluna bilər');
  }
  const { notifyCertificateStatusChanged } = require('./certificateService');
  await notifyCertificateStatusChanged(certificateId, 'revoked', {
    dedupeSuffix: new Date(rows[0].revoked_at).getTime() || Date.now(),
  }).catch(() => null);
  return rows[0];
}

async function reinstateCertificate({ certificateId, reason }) {
  cleanReason(reason);
  const row = await db.transaction(async (client) => {
    const { rows: cur } = await client.query(
      `SELECT id, student_id, exam_id, status FROM certificates WHERE id = $1 FOR UPDATE`,
      [certificateId],
    );
    if (!cur[0]) throw err(404, 'NOT_FOUND', 'Sertifikat tapılmadı');
    if (cur[0].status !== 'revoked') throw err(409, 'NOT_REVOKED', 'Sertifikat ləğv olunmayıb');
    const { rows: other } = await client.query(
      `SELECT 1 FROM certificates
       WHERE student_id = $1 AND exam_id = $2 AND status = 'issued' AND id <> $3
       LIMIT 1`,
      [cur[0].student_id, cur[0].exam_id, certificateId],
    );
    if (other[0]) throw err(409, 'NEWER_CERTIFICATE_EXISTS', 'Bu imtahan üçün artıq aktiv sertifikat var');
    const { rows } = await client.query(
      `UPDATE certificates
       SET status = 'issued', revoked_at = NULL, revoked_by = NULL, revoke_reason = NULL
       WHERE id = $1
       RETURNING id, status`,
      [certificateId],
    );
    return rows[0];
  });
  const { createNotificationSafe } = require('./notificationService');
  const { rows } = await db.query(`SELECT student_id, instructor_id, title FROM certificates WHERE id = $1`, [certificateId]);
  if (rows[0]) {
    await createNotificationSafe({
      recipientId: rows[0].student_id,
      category: 'assessment',
      eventType: 'certificate_reinstated',
      params: { courseTitle: rows[0].title || '' },
      meta: { certificate_id: certificateId, href: '/student/certificates' },
      relatedEntityType: 'certificate',
      relatedEntityId: certificateId,
      providerWorkspaceId: rows[0].instructor_id,
      dedupeKey: `certificate_reinstated:${certificateId}:${Date.now()}`,
      email: true,
    }).catch(() => null);
  }
  return row;
}

/** True when an admin revoked a certificate for this student+exam (blocks automatic re-issue). */
async function hasRevokedCertificate(conn, { studentId, examId }) {
  const { rows } = await conn.query(
    `SELECT 1 FROM certificates WHERE student_id = $1 AND exam_id = $2 AND status = 'revoked' LIMIT 1`,
    [studentId, examId],
  );
  return Boolean(rows[0]);
}

module.exports = {
  REASON_MIN,
  searchCertificatesForAdmin,
  loadCertificateForAdmin,
  revokeCertificate,
  reinstateCertificate,
  hasRevokedCertificate,
};
