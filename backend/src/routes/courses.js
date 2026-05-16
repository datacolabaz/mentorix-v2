const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  list,
  getOne,
  create,
  assignStudents,
  assignableStudents,
} = require('../controllers/coursesCatalogController');

router.use(authenticate, authorize('instructor', 'admin'));

router.get('/', list);
router.get('/assignable-students', assignableStudents);
router.post('/', create);
router.get('/:id', getOne);
router.post('/:id/students', assignStudents);

module.exports = router;
