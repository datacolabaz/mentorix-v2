const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
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
} = require('../controllers/certificateController');

router.get('/verify/:token', rateLimitVerify, getPublicCertificateVerify);

router.get('/my', authenticate, authorize('student'), listMyCertificates);
router.get('/my/pending', authenticate, authorize('student'), listMyPendingCertificates);
router.post('/my/claim/:examId', authenticate, authorize('student'), claimMyCertificate);
router.get('/my/:id/download', authenticate, authorize('student'), downloadCertificate);
router.post('/my/:id/email', authenticate, authorize('student'), emailMyCertificate);

router.get('/instructor', authenticate, authorize('instructor'), listInstructorCerts);
router.get('/instructor/feature', authenticate, authorize('instructor'), getCertificateFeature);
router.get('/instructor/templates', authenticate, authorize('instructor'), getTemplates);
router.post('/instructor/templates', authenticate, authorize('instructor'), saveTemplate);
router.patch('/instructor/templates/:id', authenticate, authorize('instructor'), saveTemplate);
router.get('/instructor/:id/download', authenticate, authorize('instructor'), downloadCertificate);

router.get('/admin/stats', authenticate, authorize('admin'), getAdminStats);

module.exports = router;
