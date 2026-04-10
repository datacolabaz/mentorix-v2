const router = require('express').Router();
const { listStudents, getStudent, deleteStudent } = require('../controllers/studentController');
const { authenticate, authorize } = require('../middleware/auth');
const db = require('../utils/db');

router.get('/', authenticate, authorize('admin', 'instructor'), listStudents);
router.get('/:id', authenticate, getStudent);
router.delete('/enrollment/:enrollmentId', authenticate, authorize('admin', 'instructor'), deleteS