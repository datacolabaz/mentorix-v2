#!/usr/bin/env node
/**
 * Manual QA for catalog waitlist notifications.
 * Usage:
 *   node backend/scripts/test-waitlist-notify.js subscribe test@example.com data-analytics
 *   node backend/scripts/test-waitlist-notify.js notify <exam-uuid>
 *   node backend/scripts/test-waitlist-notify.js stats
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { subscribeWaitlist, getAdminWaitlistStats, notifyWaitlistForVerifiedExam } = require('../src/services/catalogWaitlistService');

async function main() {
  const [cmd, arg1, arg2] = process.argv.slice(2);

  if (cmd === 'subscribe') {
    const result = await subscribeWaitlist({ email: arg1, categorySlug: arg2 });
    console.log('Subscribed:', result);
  } else if (cmd === 'notify') {
    const result = await notifyWaitlistForVerifiedExam(arg1);
    console.log('Notify result:', result);
  } else if (cmd === 'stats') {
    const rows = await getAdminWaitlistStats();
    console.table(rows);
  } else {
    console.log('Commands: subscribe <email> <category-slug> | notify <exam-id> | stats');
    process.exit(1);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
