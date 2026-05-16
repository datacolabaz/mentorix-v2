const {
  listCoursesForInstructor,
  getCourseDetail,
  createCourse,
  assignStudentsToCourse,
  listAssignableStudents,
} = require('../services/coursesCatalogService');

const list = async (req, res) => {
  try {
    const courses = await listCoursesForInstructor(req.user.id);
    res.json({ success: true, courses });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

const getOne = async (req, res) => {
  try {
    const course = await getCourseDetail(req.params.id, req.user.id);
    if (!course) return res.status(404).json({ success: false, message: 'Kurs tapılmadı' });
    res.json({ success: true, course });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

const create = async (req, res) => {
  try {
    const course = await createCourse(req.user.id, req.body);
    res.status(201).json({ success: true, course });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

const assignStudents = async (req, res) => {
  try {
    const ids = req.body?.student_ids;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ success: false, message: 'student_ids massivi tələb olunur' });
    }
    await assignStudentsToCourse(req.params.id, req.user.id, ids);
    const course = await getCourseDetail(req.params.id, req.user.id);
    res.json({ success: true, course });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

const assignableStudents = async (req, res) => {
  try {
    const students = await listAssignableStudents(req.user.id);
    res.json({ success: true, students });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
};

module.exports = { list, getOne, create, assignStudents, assignableStudents };
