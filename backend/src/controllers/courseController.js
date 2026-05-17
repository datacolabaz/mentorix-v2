const path = require('path');
const fs = require('fs');
const multer = require('multer');
const {
  getOrgDashboardStats,
  ensureOrgCourseForOwner,
  getOrgSettings,
  updateOrgSettings,
  updateOrgLogo,
  listLeads,
  createLead,
  updateLead,
  listOrgTeachers,
  addOrgTeacher,
  LEAD_STATUSES,
} = require('../services/courseOrgService');

const uploadsCourseLog