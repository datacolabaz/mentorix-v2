/**
 * Admin: search certificates, revoke (reason required) and reinstate. Each change is written to
 * admin_access_audit BEFORE anything changes (fail-closed: no audit row -> 503, nothing happens).
 */
const { recordAdminAccess } = require('../services/adminAccessAudit');
const svc = require('../services/certificateRevocationService');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function send(res, err) {
  const st = err.statusCode || 500;
  return res.status(st).json({ success: false, message: st === 500 ? 'Server xətası' : err.message, code: err.code });
}

async function listCertificatesAdmin(req, res) {
  try {
    const items = await svc.searchCertificatesForAdmin({
      q: req.query?.q,
      status: req.query?.status,
      limit: req.query?.limit,
    });
    res.json({ success: true, items });
  } catch (err) {
    send(res, err);
  }
}

function change(kind) {
  return async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!UUID_RE.test(id)) return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'Yanlış sertifikat ID' });
      const reason = String(req.body?.reason || '').trim();
      if (reason.length < svc.REASON_MIN) {
        return res.status(400).json({ success: false, code: 'REASON_REQUIRED', message: 'Səbəb tələb olunur (ən azı 5 simvol)' });
      }
      const cert = await svc.loadCertificateForAdmin(id);
      if (!cert) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'Sertifikat tapılmadı' });
      if (kind === 'revoke' && cert.status !== 'issued') {
        return res.status(409).json({ success: false, code: 'NOT_REVOCABLE', message: 'Yalnız aktiv (issued) sertifikat ləğv oluna bilər' });
      }
      if (kind === 'reinstate' && cert.status !== 'revoked') {
        return res.status(409).json({ success: false, code: 'NOT_REVOKED', message: 'Sertifikat ləğv olunmayıb' });
      }
      await recordAdminAccess({
        actorUserId: req.user.id,
        action: kind === 'revoke' ? 'certificate.revoke' : 'certificate.reinstate',
        targetUserId: cert.student_id,
        entityType: 'certificate',
        entityId: id,
        reason: reason.slice(0, 500),
        req,
      });
      const out =
        kind === 'revoke'
          ? await svc.revokeCertificate({ certificateId: id, adminId: req.user.id, reason })
          : await svc.reinstateCertificate({ certificateId: id, reason });
      res.json({ success: true, certificate: out });
    } catch (err) {
      send(res, err);
    }
  };
}

module.exports = {
  listCertificatesAdmin,
  revokeCertificateAdmin: change('revoke'),
  reinstateCertificateAdmin: change('reinstate'),
};
