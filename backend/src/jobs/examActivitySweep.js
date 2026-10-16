const { sweepExpiredAttempts, releaseDueResults } = require('../services/assessmentAttemptService');

let running = false;
let bankAttempts;

/**
 * Hər dəqiqə: vaxtı bitmiş açıq imtahan cəhdlərini yekunlaşdırır (cavab varsa avtomatik təqdim)
 * və vaxtı çatmış nəticələri «açıqlanıb» kimi qeyd edir. Heç bir bildiriş göndərmir.
 * Bir neçə replika eyni anda işləsə də təhlükəsizdir: hər cəhd FOR UPDATE + şərtli UPDATE ilə bir dəfə yekunlaşır.
 */
async function runExamActivitySweep() {
  if (running) return null;
  running = true;
  try {
    bankAttempts ||= require('../services/bankExamAttemptService').createBankExamAttemptService();
    const bankExpired = await bankAttempts.sweep();
    const expired = await sweepExpiredAttempts();
    const released = await releaseDueResults();
    if (expired.checked || bankExpired.checked || released.released) {
      console.log('[exam-activity-sweep]', JSON.stringify({ expired, bankExpired, released }));
    }
    return { expired, bankExpired, released };
  } finally {
    running = false;
  }
}

module.exports = { runExamActivitySweep };
