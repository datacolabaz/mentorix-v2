const express = require('express');
const { authenticate } = require('../middleware/auth');
const {
  getPrograms,
  getProgram,
  getProgramMeta,
  postWizardProfile,
} = require('../controllers/universityProgramsController');

const router = express.Router();

router.get('/meta', getProgramMeta);
router.get('/', getPrograms);
router.post('/wizard', authenticate, postWizardProfile);
router.get('/:id', getProgram);

module.exports = router;
