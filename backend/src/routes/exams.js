const router = require('express').Router();
const {
  createExam, listExams, studentExams,
  getExamQuestions, submitExam, getResults,
} = require('../controllers/examController');
const { authenticate, authorize } = require('../middleware/auth');

router.post('/', authenticate, authorize('instructor', 'admin'), createExam);
router.get('/', authenticate, authorize('instructor', 'admin'), listExams);
router.get('/my', authenticate, authorize('student'), studentExams);
router.get('/:id/questions', authenticate, getExamQuestions);
router.post('/submit', authenticate, authorize('student'), submitExam);
router.get('/:id/results', authenticate, getResults);

module.exports = router;
