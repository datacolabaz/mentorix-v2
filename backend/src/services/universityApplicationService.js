const db = require('../utils/db');
const { getProgramById } = require('./universityProgramService');

async function createApplication(userId, { program_id, notes, status = 'submitted' }) {
  if (!program_id) {
    const err = new Error('program_id tələb olunur');
    err.status = 400;
    throw err;
  }

  const program = await getProgramById(program_id);
  if (!program) {
    const err = new Error('Proqram tapılmadı');
    err.status = 404;
    throw err;
  }

  const normalizedStatus = status === 'draft' ? 'draft' : 'submitted';
  const appliedAt = normalizedStatus === 'submitted' ? new Date() : null;

  const { rows } = await db.query(
    `
    INSERT INTO university_applications (user_id, program_id, status, applied_at, notes, updated_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    ON CONFLICT (user_id, program_id) DO UPDATE SET
      status = EXCLUDED.status,
      applied_at = CASE
        WHEN EXCLUDED.status = 'submitted' THEN COALESCE(university_applications.applied_at, NOW())
        ELSE university_applications.applied_at
      END,
      notes = COALESCE(EXCLUDED.notes, university_applications.notes),
      updated_at = NOW()
    RETURNING *
    `,
    [userId, program_id, normalizedStatus, appliedAt, notes || null],
  );

  return {
    application: rows[0],
    program,
  };
}

async function listUserApplications(userId) {
  const { rows } = await db.query(
    `
    SELECT
      a.*,
      p.name AS program_name,
      p.degree_level,
      p.apply_link,
      u.name AS university_name,
      u.country AS university_country
    FROM university_applications a
    INNER JOIN programs p ON p.id = a.program_id
    INNER JOIN universities u ON u.id = p.uni_id
    WHERE a.user_id = $1
    ORDER BY a.updated_at DESC
    `,
    [userId],
  );
  return rows;
}

module.exports = {
  createApplication,
  listUserApplications,
};
