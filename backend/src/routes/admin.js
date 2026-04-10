const router = require('express').Router();
const {
  getInstructors, updateInstructorLimits,
  getDashboardStats, toggleInstructor,
} = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/stats', authenticate, authorize('admin'), getDashboardStats);
router.get('/instructors', authenticate, authorize('admin'), getInstructors);
router.patch('/instructors/:id/limits', authenticate, authorize('admin'), updateInstructorLimits);
router.patch('/instructors/:id/toggle', authenticate, authorize('admin'), toggleInstructor);


router.patch('/instructors/:id/profile', authenticate, authorize("admin"), async (req, res) => {
  try {
    const { full_name, phone, subject } = req.body;
    await require("../utils/db").query(
      "UPDATE users SET full_name = COALESCE($1, full_name), phone = $2 WHERE id = $3",
      [full_name, phone, req.params.id]
    );
    if (subject !== undefined) {
      await require("../utils/db").query(
        "UPDATE instructor_profiles SET subject = $1 WHERE user_id = $2",
        [subject, req.params.id]
      );
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


router.patch('/instructors/:id/profile', authenticate, authorize('admin'), async (req, res) => {
  try {
    const db = require('../utils/db');
    const { full_name, phone, subject } = req.body;
    await db.query('UPDATE users SET full_name=$1, phone=$2 WHERE id=$3', [full_name, phone, req.params.id]);
    if (subject !== undefined) {
      await db.query('UPDATE instructor_profiles SET subject=$1 WHERE user_id=$2', [subject, req.params.id]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
