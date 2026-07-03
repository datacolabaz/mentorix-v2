const db = require('../utils/db');
const { LEVEL_RANK } = require('../lib/skillLevels');

/**
 * Sertifikat veriləndə istifadəçinin kateqoriya üzrə səviyyə profilini yenilə.
 */
async function upsertUserSkillProgressFromCertificate(client, { userId, examId }) {
  if (!userId || !examId) return;

  const { rows } = await client.query(
    `SELECT e.category_id, e.level, ec.parent_id
     FROM exams e
     LEFT JOIN exam_categories ec ON ec.id = e.category_id
     WHERE e.id = $1`,
    [examId],
  );
  const exam = rows[0];
  if (!exam?.category_id) return;

  const categoryIds = [exam.category_id];
  if (exam.parent_id) categoryIds.push(exam.parent_id);

  const newRank = LEVEL_RANK[exam.level] || 1;

  for (const categoryId of categoryIds) {
    const { rows: existing } = await client.query(
      `SELECT current_level FROM user_skill_progress WHERE user_id = $1 AND category_id = $2`,
      [userId, categoryId],
    );
    const prevRank = LEVEL_RANK[existing[0]?.current_level] || 0;
    if (newRank <= prevRank && existing[0]) continue;

    await client.query(
      `INSERT INTO user_skill_progress (user_id, category_id, current_level, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, category_id) DO UPDATE SET
         current_level = CASE
           WHEN EXCLUDED.current_level = 'professional' THEN 'professional'
           WHEN user_skill_progress.current_level = 'professional' THEN 'professional'
           WHEN EXCLUDED.current_level = 'advanced' THEN 'advanced'
           WHEN user_skill_progress.current_level = 'advanced' THEN 'advanced'
           WHEN EXCLUDED.current_level = 'intermediate' THEN 'intermediate'
           WHEN user_skill_progress.current_level = 'intermediate' THEN 'intermediate'
           ELSE EXCLUDED.current_level
         END,
         updated_at = NOW()`,
      [userId, categoryId, exam.level || 'beginner'],
    );
  }
}

module.exports = { upsertUserSkillProgressFromCertificate };
