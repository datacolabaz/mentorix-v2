const db = require('../utils/db');
const { maybeIssueCertificateAfterExamSubmit } = require('../services/certificateService');

let started = false;

async function processQueueOnce() {
  const { rows } = await db.query(
    `SELECT q.id AS queue_id, q.exam_result_id,
            er.exam_id, er.student_id, er.score
     FROM certificate_issue_queue q
     JOIN exam_results er ON er.id = q.exam_result_id
     WHERE q.processed_at IS NULL
     ORDER BY q.created_at ASC
     LIMIT 20`,
  );
  for (const row of rows) {
    try {
      await maybeIssueCertificateAfterExamSubmit({
        examId: row.exam_id,
        studentId: row.student_id,
        examResultId: row.exam_result_id,
        score: row.score,
      });
    } catch (e) {
      console.error('certificateIssueWorker', row.queue_id, e.message);
    }
    await db.query(`UPDATE certificate_issue_queue SET processed_at = NOW() WHERE id = $1`, [row.queue_id]);
  }
}

function ensureStarted() {
  if (started) return;
  started = true;
  setInterval(() => {
    processQueueOnce().catch((e) => console.error('certificateIssueWorker', e.message));
  }, 20_000);
  setImmediate(() => processQueueOnce().catch(() => {}));
}

module.exports = { ensureStarted, processQueueOnce };
