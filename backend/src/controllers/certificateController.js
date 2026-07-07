const {
  getPublicVerification,
  listStudentCertificates,
  listInstructorCertificates,
  getInstructorCertificateStats,
  getAdminCertificateStats,
  getCertificateForDownload,
  listTemplates,
  upsertTemplate,
  instructorHasCertificateFeature,
  getOrIssueCertificateForStudentExam,
  listPendingCertificatesForStudent,
  resendCertificateEmailToStudent,
} = require('../services/certificateService');
const { readCertificateFileBuffer } = require('../services/certificateFileStorage');

const verifyHits = new Map();
const VERIFY_WINDOW_MS = 60_000;
const VERIFY_MAX = 60;

function rateLimitVerify(req, res, next) {
  const ip = String(req.headers['x-forwarded-for'] || req.ip || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const bucket = verifyHits.get(ip) || { count: 0, reset: now + VERIFY_WINDOW_MS };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + VERIFY_WINDOW_MS;
  }
  bucket.count += 1;
  verifyHits.set(ip, bucket);
  if (bucket.count > VERIFY_MAX) {
    return res.status(429).json({ success: false, message: 'Çox sorğu. Bir az gözləyin.' });
  }
  next();
}

const getPublicCertificateVerify = async (req, res) => {
  try {
    const data = await getPublicVerification(req.params.token);
    if (!data) return res.status(404).json({ success: false, message: 'Sertifikat tapılmadı' });
    res.json({ success: true, certificate: data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const listMyCertificates = async (req, res) => {
  try {
    const rows = await listStudentCertificates(req.user.id);
    res.json({ success: true, certificates: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const listMyPendingCertificates = async (req, res) => {
  try {
    const pending = await listPendingCertificatesForStudent(req.user.id);
    res.json({ success: true, pending });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const claimMyCertificate = async (req, res) => {
  try {
    const examId = String(req.params.examId || '').trim();
    if (!examId) {
      return res.status(400).json({ success: false, message: 'İmtahan identifikatoru lazımdır' });
    }
    const outcome = await getOrIssueCertificateForStudentExam(req.user.id, examId);
    const reason = outcome.eligibility?.reason || null;
    const messages = {
      disabled:
        'Bu imtahanda sertifikat aktiv deyil. Müəllim imtahanı redaktə edib «Keçənlərə sertifikat ver» seçimini aktiv etməlidir.',
      instructor_plan:
        'Müəllimin cari planı sertifikat vermir (Pro plan lazımdır). Müəllimlə əlaqə saxlayın.',
      below_pass: `Keçid balı ${Math.round(Number(outcome.eligibility?.pass_pct || 0))}% — sizin nəticə ${Math.round(Number(outcome.eligibility?.score_pct || 0))}%.`,
      grading_pending:
        'Açıq sualların qiymətləndirilməsi gözlənilir — müəllim təsdiqlədikdən sonra sertifikat yaradıla bilər.',
      issue_failed: 'Sertifikat yaradılarkən texniki xəta baş verdi. Bir az sonra yenidən cəhd edin.',
      not_submitted: 'İmtahan hələ təqdim olunmayıb.',
    };
    if (outcome.certificate) {
      return res.json({
        success: true,
        certificate: outcome.certificate,
        eligibility: outcome.eligibility,
      });
    }
    return res.json({
      success: false,
      certificate: null,
      eligibility: outcome.eligibility,
      message: messages[reason] || 'Sertifikat mövcud deyil',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const listInstructorCerts = async (req, res) => {
  try {
    const [certificates, stats, enabled] = await Promise.all([
      listInstructorCertificates(req.user.id),
      getInstructorCertificateStats(req.user.id),
      instructorHasCertificateFeature(req.user.id),
    ]);
    res.json({ success: true, certificates, stats, feature_enabled: enabled });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getAdminStats = async (req, res) => {
  try {
    const stats = await getAdminCertificateStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const downloadCertificate = async (req, res) => {
  try {
    const cert = await getCertificateForDownload({ certificateId: req.params.id, user: req.user });
    if (!cert) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    const file = await readCertificateFileBuffer(cert.pdf_filename);
    if (!file?.buffer) return res.status(404).json({ success: false, message: 'PDF tapılmadı' });
    const name = `${cert.certificate_no || 'certificate'}.pdf`;
    res.setHeader('Content-Type', file.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`);
    res.send(file.buffer);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const emailMyCertificate = async (req, res) => {
  try {
    const result = await resendCertificateEmailToStudent(req.params.id, req.user.id);
    if (result?.ok) {
      return res.json({ success: true, message: 'Sertifikat email ünvanınıza göndərildi.' });
    }
    if (result?.skipped && result?.reason === 'no_email') {
      return res.status(400).json({
        success: false,
        message: 'Hesabınızda email ünvanı yoxdur — əvvəlcə Gmail ilə qeydiyyatdan keçin və ya email əlavə edin.',
      });
    }
    if (result?.error === 'not_found') {
      return res.status(404).json({ success: false, message: 'Sertifikat tapılmadı' });
    }
    return res.status(502).json({
      success: false,
      message: result?.error || result?.reason || 'Email göndərilmədi',
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getTemplates = async (req, res) => {
  try {
    const enabled = await instructorHasCertificateFeature(req.user.id);
    const templates = await listTemplates(req.user.id);
    res.json({ success: true, templates, feature_enabled: enabled });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const saveTemplate = async (req, res) => {
  try {
    const enabled = await instructorHasCertificateFeature(req.user.id);
    if (!enabled) {
      return res.status(403).json({ success: false, message: 'Sertifikat funksiyası Pro planında mövcuddur' });
    }
    const payload = { ...(req.body || {}), id: req.params.id || req.body?.id };
    const row = await upsertTemplate(req.user.id, payload);
    if (!row) return res.status(404).json({ success: false, message: 'Şablon tapılmadı' });
    res.json({ success: true, template: row });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const getCertificateFeature = async (req, res) => {
  try {
    const enabled = await instructorHasCertificateFeature(req.user.id);
    res.json({ success: true, enabled });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  rateLimitVerify,
  getPublicCertificateVerify,
  listMyCertificates,
  listMyPendingCertificates,
  claimMyCertificate,
  listInstructorCerts,
  getAdminStats,
  downloadCertificate,
  emailMyCertificate,
  getTemplates,
  saveTemplate,
  getCertificateFeature,
};
