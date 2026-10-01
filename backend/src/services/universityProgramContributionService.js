const db = require('../utils/db');
const { upsertUniversity, upsertProgram } = require('./universityProgramIngestService');

async function getContributorDisplayName(userId) {
  const { rows } = await db.query(
    `SELECT COALESCE(full_name, email) AS display_name FROM users WHERE id = $1`,
    [userId],
  );
  return rows[0]?.display_name || 'Təlimçi';
}

/**
 * Program row as returned to clients. The DB column is still `mentor_display_name`
 * (legacy name, migration 158); clients only ever see `contributor_display_name`.
 */
function toClientProgramRow(row) {
  if (!row || typeof row !== 'object') return row;
  const { mentor_display_name: displayName, ...rest } = row;
  const raw = rest.ai_raw_json;
  let aiRaw = raw;
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'mentor_notes' in raw) {
    const { mentor_notes: notes, ...others } = raw;
    aiRaw = { contributor_notes: notes ?? null, ...others };
  }
  return {
    ...rest,
    source_type: rest.source_type === 'mentor' ? 'instructor' : rest.source_type,
    portal_source: rest.portal_source === 'mentor' ? 'instructor' : rest.portal_source,
    contributor_display_name: displayName ?? rest.contributor_display_name ?? null,
    ai_raw_json: aiRaw,
  };
}

async function submitInstructorProgram(userId, body = {}) {
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
  } = body;
  // mentor_notes: field name sent by clients built before the trainer wording change.
  const contributorNotes = body.contributor_notes ?? body.mentor_notes ?? null;

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

  const contributor_display_name = await getContributorDisplayName(userId);
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
    source_type: 'instructor',
    review_status: 'pending',
    contributor_user_id: userId,
    contributor_display_name,
    ai_raw_json: { contributor_notes: contributorNotes || null },
  });

  return { university, program: toClientProgramRow(program), contributor_display_name };
}

async function listInstructorSubmissions(userId) {
  const { rows } = await db.query(
    `
    SELECT p.*, u.name AS uni_name, u.country AS uni_country
    FROM programs p
    INNER JOIN universities u ON u.id = p.uni_id
    WHERE p.contributor_user_id = $1 AND p.source_type = 'instructor'
    ORDER BY p.updated_at DESC
    `,
    [userId],
  );
  return rows.map(toClientProgramRow);
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
  return rows.map(toClientProgramRow);
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
  return toClientProgramRow(rows[0]);
}

module.exports = {
  submitInstructorProgram,
  listInstructorSubmissions,
  listPendingPrograms,
  reviewProgram,
  getContributorDisplayName,
  toClientProgramRow,
};
