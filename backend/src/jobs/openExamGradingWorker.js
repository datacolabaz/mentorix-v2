const db = require('../utils/db');
const { processOpenGradingForResult } = require('../services/openExamGradingService');

let started = false;

async function processQueueOnce() {
  const { rows } = await db.query(
    `SELECT id, exam_result_id
     FROM exam_open_grading_queue
     WHERE processed_at IS NULL
     ORDER BY created_at ASC
     LIMIT 10`,
  );

  for (const row of rows) {
    try {
      await processOpenGradingForResult(row.exam_result_id);
      await db.query(
        `UPDATE exam_open_grading_queue
         SET processed_at = NOW(), status = 'done', last_error = NULL
         WHERE id = $1`,
        [row.id],
      );
    } catch (e) {
      console.error('openExamGradingWorker', row.id, e.message);
      await db.query(
        `UPDATE exam_open_grading_queue
         SET processed_at = NOW(), status = 'error', last_error = $2
         WHERE id = $1`,
        [row.id, String(e.message || 'error').slice(0, 500)],
      );
    }
  }
}

function ensureStarted() {
  if (started) return;
  started = true;
  setInterval(() => {
    processQueueOnce().catch((e) => console.error('openExamGradingWorker', e.message));
  }, 15_000);
  setImmediate(() => processQueueOnce().catch(() => {}));
}

module.exports = { ensureStarted, processQueueOnce };
