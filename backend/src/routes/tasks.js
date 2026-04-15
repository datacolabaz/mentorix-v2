const router = require('express').Router();
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth');
const { enforceStorageLimitAfterUpload } = require('../middleware/storageLimit');
const {
  listInstructorTasks,
  createInstructorTask,
  deleteInstructorAssignment,
  getMyAssignment,
  saveMyAssignmentDraft,
  submitMyAssignment,
  getInstructorStudentAssignment,
  listMyTasks,
  markMyTaskDone,
} = require('../controllers/taskController');

router.get('/', authenticate, authorize('instructor'), listInstructorTasks);
router.post('/', authenticate, authorize('instructor'), createInstructorTask);
router.delete('/:id', authenticate, authorize('instructor'), deleteInstructorAssignment);

router.get('/my', authenticate, authorize('student'), listMyTasks);
router.get('/assignments/:id', authenticate, authorize('student'), getMyAssignment);
router.patch('/assignments/:id/draft', authenticate, authorize('student'), saveMyAssignmentDraft);
router.patch('/assignments/:id/done', authenticate, authorize('student'), markMyTaskDone);
router.patch('/assignments/:id/submit', authenticate, authorize('student'), submitMyAssignment);

// Instructor review of a specific student assignment row
router.get('/instructor/review/:id', authenticate, authorize('instructor'), getInstructorStudentAssignment);

// Upload attachments for assignments (local storage, unguessable filenames)
const uploadsAssignmentsDir = path.join(__dirname, '../../uploads/assignments');
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsAssignmentsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.bin';
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});
const uploadAssignmentFile = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = [
      'application/pdf',
      'image/png',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ].includes(file.mimetype);
    if (!ok) return cb(new Error('Yalnız PDF, PNG, CSV, XLS və ya XLSX faylı qəbul edilir'));
    cb(null, true);
  },
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
  (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Fayl tələb olunur' });
    const rel = `/api/uploads/assignments/${req.file.filename}`;
    res.json({ success: true, url: rel, filename: req.file.originalname });
  }
);

// Instructor question file upload
const uploadInstructorQuestionFile = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = [
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'text/csv',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ].includes(file.mimetype);
    if (!ok) return cb(new Error('Yalnız PDF, şəkil, CSV, Word və ya Excel faylı qəbul edilir'));
    cb(null, true);
  },
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
  (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'Fayl tələb olunur' });
    const rel = `/api/uploads/assignments/${req.file.filena