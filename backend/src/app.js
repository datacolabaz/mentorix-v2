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
const { expireAbandonedBillingPayments, markPastDueSubscriptions } = require('./jobs/billingPaymentsReaper');
const { runNotificationQueueOnce } = require('./jobs/notificationQueueWorker');
const { runAssignmentNotifications } = require('./jobs/assignmentNotifications');
const { reconcileStorageUsage } = require('./jobs/storageUsageReconciler');
const { runOrphanFilesReaper } = require('./jobs/orphanFilesReaper');
const { runUniversityProgramScraper } = require('./jobs/universityProgramScraper');
const { ensureStarted: ensureCertificateIssueWorker } = require('./jobs/certificateIssueWorker');
const { ensureCertificateFontsReady } = require('./services/certificatePdfFonts');

const { ensureAssignmentsUploadDir } = require('./services/assignmentFileStorage');
const { ensureCertificatesUploadDir } = require('./services/certificateFileStorage');
const { CHAT_UPLOAD_DIR } = require('./services/chatAttachmentStorage');
const uploadsExamsDir = path.join(__dirname, '../uploads/exams');
ensureAssignmentsUploadDir();
ensureCertificatesUploadDir();
const uploadsCourseLogosDir = path.join(__dirname, '../uploads/course-logos');
const { servePublicInstructorAvatar } = require('./controllers/instructorAvatarController');
const uploadsInstructorAvatarsDir = path.join(__dirname, '../uploads/instructor-avatars');
fs.mkdirSync(uploadsExamsDir, { recursive: true });
fs.mkdirSync(uploadsCourseLogosDir, { recursive: true });
fs.mkdirSync(uploadsInstructorAvatarsDir, { recursive: true });
fs.mkdirSync(CHAT_UPLOAD_DIR, { recursive: true });

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

// Upload faylları yalnız autentifikasiyalı route-lar vasitəsilə verilir:
// - exams: GET /api/exams/material-file/:filename
// - assignments: GET /api/tasks/assignment-file/:filename
// - materials: GET /api/materials/file/:filename
// - chat: GET /api/chat/attachments/:filename
// - course logos: GET /api/course/logo/:filename
app.get('/api/uploads/instructor-avatars/:filename', servePublicInstructorAvatar);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/students', require('./routes/students'));
app.use('/api/instructor/students', require('./routes/instructorStudents'));
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
app.use('/api/trial', require('./routes/trial'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/public', require('./routes/public'));
app.use('/api/course', require('./routes/course'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/materials', require('./routes/materials'));
app.use('/api/programs', require('./routes/programs'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/live', require('./routes/live'));
app.use('/api/certificates', require('./routes/certificates'));

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
  ensureCertificateFontsReady().catch((e) => console.error('[certificates] font setup', e.message));
  ensureCertificateIssueWorker();
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

// Assignment reminders (24h) and overdue: hourly
cron.schedule('20 * * * *', () => {
  runAssignmentNotifications().catch((e) => console.error('assignment notifications cron', e.message));
});

// Pack reminders fallback: every 30 minutes
cron.schedule('*/30 * * * *', () => {
  runPackReminders().catch((e) => console.error('pack reminders cron', e.message));
});

// Billing payments cleanup + subscription past_due: every 15 minutes
cron.schedule('*/15 * * * *', () => {
  expireAbandonedBillingPayments().catch((e) => console.error('billing payments reaper cron', e.message));
  markPastDueSubscriptions().catch((e) => console.error('subscription past_due cron', e.message));
});

// Notification queue retry worker: every minute
cron.schedule('* * * * *', () => {
  runNotificationQueueOnce().catch((e) => console.error('notification queue cron', e.message));
});

// Storage usage reconciliation: every 6 hours
cron.schedule('0 */6 * * *', () => {
  reconcileStorageUsage().catch((e) => console.error('storage usage reconcile cron', e.message));
});

// Orphan files cleanup: daily at 03:30
cron.schedule('30 3 * * *', () => {
  runOrphanFilesReaper().catch((e) => console.error('orphan files reaper cron', e.message));
});

// University program AI scraper: weekly Sunday 04:00
cron.schedule('0 4 * * 0', () => {
  runUniversityProgramScraper().catch((e) => console.error('university program scraper cron', e.message));
});

module.exports = app;
