require('dotenv').config();

const cors = require('cors');
const cron = require('node-cron');
const express = require('express');
const fs = require('fs');
const path = require('path');

const errorHandler = require('./middleware/errorHandler');
const { processExamNotificationJobs } = require('./services/examService');
const { recomputeAllInstructorsUsage } = require('./services/resourceUsageService');
const { extendMonthlyAttendanceSlots } = require('./jobs/monthlyAttendanceSlots');

const uploadsExamsDir = path.join(__dirname, '../uploads/exams');
const uploadsAssignmentsDir = path.join(__dirname, '../uploads/assignments');
fs.mkdirSync(uploadsExamsDir, { recursive: true });
fs.mkdirSync(uploadsAssignmentsDir, { recursive: true });

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

app.use('/api/uploads/exams', express.static(uploadsExamsDir));
app.use('/api/uploads/assignments', express.static(uploadsAssignmentsDir));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/exams', require('./routes/exams'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/teacher-schedules', require('./routes/teacherSchedules'));
app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/instructor', require('./routes/instructor'));
app.use('/api/tasks', require('./routes/tasks'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Edupanel API running on port', PORT);
  processExamNotificationJobs().catch((e) => console.error('exam notification jobs startup', e.message));
  recomputeAllInstructorsUsage().catch((e) => console.error('usage sync startup', e.message));
  setTimeout(() => {
    extendMonthlyAttendanceSlots().catch((e) => console.error('monthly attendance slots startup', e.message));
  }, 15000);
});

cron.schedule('* * * * *', () => {
  processExamNotificationJobs().catch((e) => console.error('exam notification cron', e.message));
});

cron.schedule('*/10 * * * *', () => {
  recomputeAllInstructorsUsage().catch((e) => console.error('usage sync cron', e.message));
});

cron.schedule('25 */6 * * *', () => {
  extendMonthlyAttendanceSlots().catch((e) => console.error('monthly attendance slots cron', e.message));
});

module.exports = app;
