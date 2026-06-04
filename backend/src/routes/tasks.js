const router = require('express').Router();
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { verify } = require('../utils/jwt');
const { authenticate, authorize } = require('../middleware/auth');
const { enforceStorageLimitAfterUpload } = require('../middleware/storageLimit');
const {
  listInstructorTasks,
  createInstructorTask,
  updateInstructorAssignment,
  deleteInstructorAssignment,
  getMyAssignment,
  saveMyAssignmentDraft,
  submitMyAssignment,
  getInstructorStudentAssignment,
  requestAiReviewSuggestion,
  reviewInstructorAssignment,
  getAssignmentAnalytics,
  listInstructorGroups,
  listParentAssignments,
  listMyTasks,
  markMyTaskDone,
  serveAssignmentFile,
  postTaskAccessFromLink,
} = require('../controllers/taskController');

/** Bearer və ya ?token= — statik /api/uploads Vercel-də 404 ola bilər */
function authenticateAssignmentFile(req, res, next) {
  const headerToken = req.headers.authorization?.split(' ')[1];
  const q = req.query.token;
  const token = headerToken || (typeof q === 'string' && q.trim() ? q.trim() : null);
  if (!token) return res.status(401).json({ success: false, message: 'Token yoxdur' });
  try {
    req.user = verify(token);
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token etibarsızdır' });
  }
}

const ASSIGNMENT_MIME_OK = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
]);

function assignmentFileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const extOk = ['.pdf', '.png', '.jpg', '.jpeg', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv', '.zip'].includes(
    ext,
  );
  if (ASSIGNMENT_MIME_OK.has(file.mimetype) || extOk) return cb(null, true);
  return cb(new Error('Fayl formatı dəstəklənmir (PDF, Word, Excel, PowerPoint, şəkil, ZIP)'));
}

router.get('/', authenticate, authorize('instructor'), listInstructorTasks);
router.get('/analytics', authenticate, authorize('instructor'), getAssignmentAnalytics);
router.get('/groups', authenticate, authorize('instructor'), listInstructorGroups);
router.get('/parent', authenticate, authorize('parent'), listParentAssignments);
router.post('/', authenticate, authorize('instructor'), createInstructorTask);
router.patch('/:id', authenticate, authorize('instructor'), updateInstructorAssignment);
router.delete('/:id', authenticate, authorize('instructor'), deleteInstructorAssignment);
router.post('/:id/access-from-link', authenticate, authorize('student'), postTaskAccessFromLink);

router.get('/assignment-file/:filename', authenticateAssignmentFile, serveAssignmentFile);

router.get('/my', authenticate, authorize('student'), listMyTasks);
router.get('/assignments/:id', authenticate, authorize('student'), getMyAssignment);
router.patch('/assignments/:id/draft', authenticate, authorize('student'), saveMyAssignmentDraft);
router.patch('/assignments/:id/done', authenticate, authorize('student'), markMyTaskDone);
router.patch('/assignments/:id/submit', authenticate, authorize('student'), submitMyAssignment);

// Instructor review of a specific student assignment row
router.get('/instructor/review/:id', authenticate, authorize('instructor'), getInstructorStudentAssignment);
router.post('/instructor/review/:id/ai-suggest', authenticate, authorize('instructor'), requestAiReviewSuggestion);
router.patch('/instructor/review/:id', authenticate, authorize('instructor'), reviewInstructorAssignment);

// Upload attachments for assignments (local storage, unguessable filenames)
const { ensureAssignmentsUploadDir, persistAssignmentFileBlob } = require('../services/assignmentFileStorage');
const uploadsAssignmentsDir = ensureAssignmentsUploadDir();
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsAssignmentsDir),
  filename: (req, file, cb) => {
    let ext = path.extname(file.originalname || '').toLowerCase();
    if (!ext || ext === '.bin') {
      const mt = String(file.mimetype || '').toLowerCase();
      const map = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'application/pdf': '.pdf',
        'text/csv': '.csv',
        'application/vnd.ms-excel': '.xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      };
      ext = map[mt] || '.bin';
    }
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});
const uploadAssignmentFile = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: assignmentFileFilter,
});

router.post(
  '/upload',
  authenticate,
  authorize('student'),
  (req, res, next) => {
    uploadAssignmentFile.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message || 'Fayl qəbul edilmədi' });
      next();
    });
  },
  async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Fayl tələb olunur' });
    try {
      await persistAssignmentFileBlob(req.file);
    } catch (e) {
      console.error('assignment blob persist', e);
      return res.status(500).json({ success: false, message: 'Fayl saxlanılmadı' });
    }
    const rel = `/api/uploads/assignments/${req.file.filename}`;
    res.json({ success: true, url: rel, filename: req.file.originalname });
  },
);

// Instructor question file upload
const uploadInstructorQuestionFile = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: assignmentFileFilter,
});

router.post(
  '/instructor/upload',
  authenticate,
  authorize('instructor'),
  (req, res, next) => {
    uploadInstructorQuestionFile.single('file')(req, res, (err) => {
      if (err) return res.status(400).json({ success: false, message: err.message || 'Fayl qəbul edilmədi' });
      next();
    });
  },
  enforceStorageLimitAfterUpload,
  async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Fayl teleb olunur' });
    try {
      await persistAssignmentFileBlob(req.file);
    } catch (e) {
      console.error('assignment blob persist', e);
      return res.status(500).json({ success: false, message: 'Fayl saxlanılmadı' });
    }
    const rel = `/api/uploads/assignments/${req.file.filename}`;
    res.json({ success: true, url: rel, filename: req.file.originalname });
  },
);

module.exports = router;

