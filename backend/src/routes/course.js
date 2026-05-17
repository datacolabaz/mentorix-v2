const router = require('express').Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getDashboardStats,
  listTeachers,
  postTeacher,
  getLeads,
  postLead,
  patchLead,
  getSettings,
  patchSettings,
  postLogo,
} = require('../controllers/courseController')