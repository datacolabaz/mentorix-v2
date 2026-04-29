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

function parseAllowedOrigins() {
  const raw = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URLS,
    // common prod domains (safe allowlist defaults)
    'https://mentorix.io',
    'https://www.mentorix.io',
  ]
    .filter(Boolean)
    .join(',');
  const items = raw
    .split(',')
    .map((s) => String(s).trim())
    .filter(Boolean);
  // De-dup
  return [...new Set(items)];
}

const allowedOrigins = parseAllowedOrigins();

app.use(
  cors({
    origin(origin, cb) {
      // allow non-browser requests (no Origin header)
      if (!origin) return cb(null, true);
      if (allowedOrigins.includes('*')) return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
