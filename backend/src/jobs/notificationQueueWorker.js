const { fetchDue, markFailedOrRetrying, markSent } = require('../services/notificationQueueService');
const { sendEmail, userEmail } = require('../services/emailService');
const { sendSms } = require('../services/smsService');

async function runNotificationQueueOnce() {
  const due = await fetchDue(60);
  for (const item of due) {
    try {
      if (item.channel === 'email') {
        let to = item.to_addr;
        if (to === '__resolve__') {
          to = item.user_id ? await userEmail(item.user_id) : null;
        }
        if (!to) {
          await markFailedOrRetrying(item.id, 3, 'Missing recipient email');
          continue;
        }
        const r = await sendEmail({ to, subject: item.subject || 'Mentorix', text: item.body });
        if (r?.skipped) {
          // If SMTP not configured, don't retry forever.
          await markFailedOrRetrying(item.id, 3, 'SMTP disabled');
          continue;
        }
        await markSent(item.id);
        continue;
      }
      if (item.channel === 'sms') {
        const r = await sendSms({ instructorId: item.instructor_id || null, phone: item.to_addr, message: item.body });
        if (!r?.success) {
          await markFailedOrRetrying(item.id, Number(item.retry_count || 0) + 1, r?.error || 'SMS failed');
          continue;
        }
        await markSent(item.id);
        continue;
      }
      await markFailedOrRetrying(item.id, Number(item.retry_count || 0) + 1, 'Unknown channel');
    } catch (e) {
      await markFailedOrRetrying(item.id, Number(item.retry_count || 0) + 1, e?.message || 'Queue send error');
    }
  }
  return { processed: due.length };
}

module.exports = { runNotificationQueueOnce };

