const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  listInstructorTasks,
  createInstructorTask,
  deleteInstructorAssignment,
  listMyTasks,
  markMyTaskDone,
} = require('../controllers/taskController');

router.get('/', authenticate, authorize('instructor'), listInstructorTasks);
router.post('/', authenticate, authorize('instructor'), createInstructorTask);
router.delete('/:id', authenticate, authorize('instructor'), deleteInstructorAssignment);

router.get('/my', authenticate, authorize('student'), listMyTasks);
router.patch('/assignments/:id/done', authenticate, authorize('student'), markMyTaskDone);

module.exports = router;

