const db = require('../utils/db');
const { upsertUniversity, upsertProgram } = require('./universityProgramIngestService');

async function getContributorDisplayName(userId) {
  const { rows } = await db.query(
    `SELECT COALESCE(full_name, email) AS display_name FROM users WHERE id = $1`,
    [userId],
  );
  return rows[0]?.display_name || 'Mentor';
}

async function submitMentorProgram(userId, body = {}) {
  const {
    university_name,
    country,
    city,
    program_name,
    degree_level,
    field,
    language,
    tuition_fee,
    scholarship_available,
    duration_years,
    deadline_dates,
    requirements,
    apply_link,
    mentor_notes,
  } = body;

  if (!university_name?.trim() || !country?.trim() || !program_name?.trim()) {
    const err = new Error('Universitet adı, ölkə və proqram adı tələb olunur');
    err.status = 400;
    throw err;
  }

  const university = await upsertUniversity({
    name: university_name.trim(),
    country: country.trim(),
    city: city?.trim() || null,
  });

  const mentor_display_name = await getContributorDisplayName(userId);
  const program = await upsertProgram({
    uni_id: university.id,
    payload: {
      name: program_name.trim(),
      degree_level,
      field,
      language,
      tuition_fee,
      tuition_fee_eur: tuition_fee,
      scholarship_available,
      duration_years,
      deadline_dates: Array.isArray(deadline_dates) ? deadline_dates : [],
      requirements: requirements || {},
      apply_link,
    },
    source_type: 'mentor',
    review_status: 'pending',
    contributor_user_id: userId,
    mentor_display_name,
    ai_raw_json: { mentor_notes: mentor_notes || null },
  });

  return { university, program, mentor_display_name };
}

async function listMentorSubmissions(userId) {
  const { rows } = await db.query(
    `
    SELECT p.*, u.name AS uni_name, u.country AS uni_country
    FROM programs p
    INNER JOIN universities u ON u.id = p.uni_id
    WHERE p.contributor_user_id = $1 AND p.source_type = 'mentor'
    ORDER BY p.updated_at DESC
    `,
    [userId],
  );
  return rows;
}

async function listPendingPrograms() {
  const { rows } = await db.query(
    `
    SELECT p.*, u.name AS uni_name, u.country AS uni_country, u.city AS uni_city
    FROM programs p
    INNER JOIN universities u ON u.id = p.uni_id
    WHERE p.review_status = 'pending'
    ORDER BY p.updated_at DESC
    LIMIT 200
    `,
  );
  return rows;
}

async function reviewProgram(programId, { status, adminNotes }) {
  const next = status === 'approved' ? 'approved' : 'rejected';
  const { rows } = await db.query(
    `
    UPDATE programs SET
      review_status = $2,
      is_active = $3,
      ai_raw_json = COALESCE(ai_raw_json, '{}'::jsonb) || $4::jsonb,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      programId,
      next,
      next === 'approved',
      JSON.stringify({ admin_review_notes: adminNotes || null, reviewed_at: new Date().toISOString() }),
    ],
  );
  if (!rows.length) {
    const err = new Error('Proqram tapılmadı');
    err.status = 404;
    throw err;
  }
  return rows[0];
}

module.exports = {
  submitMentorProgram,
  listMentorSubmissions,
  listPendingPrograms,
  reviewProgram,
  getContributorDisplayName,
};
