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
const { runBillingNotifications } = require('./jobs/billingNotifications');
const { runPackReminders } = require('./jobs/packReminders');

const uploadsExamsDir = path.join(__dirname, '../uploads/exams');
const uploadsAssignmentsDir = path.join(__dirname, '../uploads/assignments');
fs.mkdirSync(uploadsExamsDir, { recursive: true });
fs.mkdirSync(uploadsAssignmentsDir, { recursive: true });

const app = express();

// CORS: allow browser clients (Vercel custom domains, etc).
// We reflect the Origin header (no credentials) to avoid "Failed to fetch" loops.
app.use(
  cors({
    origin: true,
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  })
);
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
app.use('/api/sms-logs', require('./routes/smsLogs'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/meta', (req, res) =>
  res.json({
    status: 'ok',
    git_sha: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || null,
    build_id: process.env.RAILWAY_DEPLOYMENT_ID || process.env.RENDER_INSTANCE_ID || process.env.HEROKU_RELEASE_VERSION || null,
    node: process.version,
    now: new Date().toISOString(),
  })
);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Mentorix API running on port', PORT);
  processExamNotificationJobs().catch((e) => console.error('exam notification jobs startup', e.message));
  recomputeAllInstructorsUsage().catch((e) => console.error('usage sync startup', e.message));
  setTimeout(() => {
    extendMonthlyAttendanceSlots().catch((e) => console.error('monthly attendance slots startup', e.message));
  }, 15000);

  // Kick off billing notifications on startup (non-blocking)
  setTimeout(() => {
    runBillingNotifications().catch((e) => console.error('billing notifications startup', e.message));
  }, 30000);

  // Pack (8/12) "next lesson is last lesson" reminders (non-blocking)
  setTimeout(() => {
    runPackReminders().catch((e) => console.error('pack reminders startup', e.message));
  }, 45000);
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

// Billing notifications: hourly check for "2 days left" and "last lesson"
cron.schedule('15 * * * *', () => {
  runBillingNotifications().catch((e) => console.error('billing notifications cron', e.message));
});

// Pack reminders fallback: every 30 minutes
cron.schedule('*/30 * * * *', () => {
  runPackReminders().catch((e) => console.error('pack reminders cron', e.message));
});

module.exports = app;
