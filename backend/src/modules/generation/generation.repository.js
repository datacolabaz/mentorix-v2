const db = require('../../utils/db');

/** @typedef {'pending' | 'success' | 'failed'} GenerationRequestStatus */

/**
 * @typedef {Object} GenerationRequestRow
 * @property {string} id
 * @property {string} teacher_id
 * @property {import('./generation.types').GenerationInput | Record<string, unknown> | null} request_payload
 * @property {GenerationRequestStatus} status
 * @property {string | null} model_used
 * @property {{ prompt?: number, completion?: number, total?: number } | null} token_usage
 * @property {number | null} latency_ms
 * @property {string | null} error_message
 * @property {string} created_at
 */

/**
 * @typedef {Object} GenerationDraftRow
 * @property {string} id
 * @property {string} request_id
 * @property {string} teacher_id
 * @property {string | null} group_id
 * @property {import('./generation.types').GeneratedQuestion[] | Record<string, unknown>[]} questions
 * @property {import('./generation.types').DraftStatus} status
 * @property {string | null} published_assignment_id
 * @property {string} created_at
 * @property {string} updated_at
 */

/**
 * @typedef {Object} CreateGenerationRequestData
 * @property {string} teacherId
 * @property {import('./generation.types').GenerationInput | Record<string, unknown>} requestPayload
 * @property {GenerationRequestStatus=} status
 */

/**
 * @typedef {Object} UpdateGenerationRequestExtra
 * @property {string=} modelUsed
 * @property {{ prompt?: number, completion?: number, total?: number }=} tokenUsage
 * @property {number=} latencyMs
 * @property {string=} errorMessage
 */

/**
 * @typedef {Object} CreateGenerationDraftData
 * @property {string} requestId
 * @property {string} teacherId
 * @property {string | null=} groupId
 * @property {import('./generation.types').GeneratedQuestion[] | Record<string, unknown>[]} questions
 * @property {import('./generation.types').DraftStatus=} status
 */

/**
 * @typedef {Object} UpdateGenerationDraftData
 * @property {import('./generation.types').GeneratedQuestion[] | Record<string, unknown>[]=} questions
 * @property {string | null=} groupId
 * @property {import('./generation.types').DraftStatus=} status
 * @property {string | null=} publishedAssignmentId
 */

/**
 * @param {GenerationRequestRow | undefined | null} row
 * @returns {GenerationRequestRow | null}
 */
function mapGenerationRequestRow(row) {
  if (!row) return null;
  return row;
}

/**
 * @param {GenerationDraftRow | undefined | null} row
 * @returns {GenerationDraftRow | null}
 */
function mapGenerationDraftRow(row) {
  if (!row) return null;
  return row;
}

/**
 * @param {string} id
 * @param {typeof db} [client]
 * @returns {Promise<GenerationRequestRow | null>}
 */
async function getGenerationRequestById(id, client = db) {
  const { rows } = await client.query(
    `SELECT *
     FROM generation_requests
     WHERE id = $1::uuid
     LIMIT 1`,
    [id],
  );
  return mapGenerationRequestRow(rows[0]);
}

/**
 * @param {CreateGenerationRequestData} data
 * @param {typeof db} [client]
 * @returns {Promise<GenerationRequestRow>}
 */
async function createGenerationRequest(data, client = db) {
  const { rows } = await client.query(
    `INSERT INTO generation_requests (teacher_id, request_payload, status)
     VALUES ($1::uuid, $2::jsonb, $3)
     RETURNING *`,
    [data.teacherId, JSON.stringify(data.requestPayload ?? {}), data.status || 'pending'],
  );
  const row = mapGenerationRequestRow(rows[0]);
  if (!row) throw new Error('generation_requests insert failed');
  return row;
}

/**
 * @param {string} id
 * @param {GenerationRequestStatus} status
 * @param {UpdateGenerationRequestExtra} [extra]
 * @param {typeof db} [client]
 * @returns {Promise<GenerationRequestRow | null>}
 */
async function updateGenerationRequestStatus(id, status, extra = {}, client = db) {
  const { rows } = await client.query(
    `UPDATE generation_requests
     SET status = $2,
         model_used = COALESCE($3, model_used),
         token_usage = COALESCE($4::jsonb, token_usage),
         latency_ms = COALESCE($5, latency_ms),
         error_message = COALESCE($6, error_message)
     WHERE id = $1::uuid
     RETURNING *`,
    [
      id,
      status,
      extra.modelUsed ?? null,
      extra.tokenUsage != null ? JSON.stringify(extra.tokenUsage) : null,
      extra.latencyMs ?? null,
      extra.errorMessage ?? null,
    ],
  );
  return mapGenerationRequestRow(rows[0]);
}

/**
 * @param {CreateGenerationDraftData} data
 * @param {typeof db} [client]
 * @returns {Promise<GenerationDraftRow>}
 */
async function createDraft(data, client = db) {
  const { rows } = await client.query(
    `INSERT INTO generation_drafts (request_id, teacher_id, group_id, questions, status)
     VALUES ($1::uuid, $2::uuid, $3::uuid, $4::jsonb, $5)
     RETURNING *`,
    [
      data.requestId,
      data.teacherId,
      data.groupId ?? null,
      JSON.stringify(data.questions ?? []),
      data.status || 'draft',
    ],
  );
  const row = mapGenerationDraftRow(rows[0]);
  if (!row) throw new Error('generation_drafts insert failed');
  return row;
}

/**
 * @param {string} id
 * @param {typeof db} [client]
 * @returns {Promise<GenerationDraftRow | null>}
 */
async function getDraftById(id, client = db) {
  const { rows } = await client.query(
    `SELECT *
     FROM generation_drafts
     WHERE id = $1::uuid
     LIMIT 1`,
    [id],
  );
  return mapGenerationDraftRow(rows[0]);
}

/**
 * @param {string} id
 * @param {UpdateGenerationDraftData} updates
 * @param {typeof db} [client]
 * @returns {Promise<GenerationDraftRow | null>}
 */
async function updateDraft(id, updates, client = db) {
  const fields = [];
  const params = [id];
  let idx = 2;

  if (updates.questions !== undefined) {
    fields.push(`questions = $${idx++}::jsonb`);
    params.push(JSON.stringify(updates.questions));
  }
  if (updates.groupId !== undefined) {
    fields.push(`group_id = $${idx++}::uuid`);
    params.push(updates.groupId);
  }
  if (updates.status !== undefined) {
    fields.push(`status = $${idx++}`);
    params.push(updates.status);
  }
  if (updates.publishedAssignmentId !== undefined) {
    fields.push(`published_assignment_id = $${idx++}::uuid`);
    params.push(updates.publishedAssignmentId);
  }

  if (fields.length === 0) {
    return getDraftById(id, client);
  }

  const { rows } = await client.query(
    `UPDATE generation_drafts
     SET ${fields.join(', ')}
     WHERE id = $1::uuid
     RETURNING *`,
    params,
  );
  return mapGenerationDraftRow(rows[0]);
}

/**
 * @param {string} teacherId
 * @param {import('./generation.types').DraftStatus | null | undefined} [status]
 * @param {typeof db} [client]
 * @returns {Promise<GenerationDraftRow[]>}
 */
async function listDraftsByTeacher(teacherId, status, client = db) {
  const { rows } = await client.query(
    `SELECT *
     FROM generation_drafts
     WHERE teacher_id = $1::uuid
       AND ($2::text IS NULL OR status = $2)
     ORDER BY updated_at DESC`,
    [teacherId, status ?? null],
  );
  return rows.map((row) => mapGenerationDraftRow(row)).filter(Boolean);
}

/**
 * @param {string} id
 * @param {import('./generation.types').DraftStatus} status
 * @param {typeof db} [client]
 * @returns {Promise<GenerationDraftRow | null>}
 */
async function updateDraftStatus(id, status, client = db) {
  return updateDraft(id, { status }, client);
}

module.exports = {
  createGenerationRequest,
  getGenerationRequestById,
  updateGenerationRequestStatus,
  createDraft,
  getDraftById,
  updateDraft,
  listDraftsByTeacher,
  updateDraftStatus,
  mapGenerationRequestRow,
  mapGenerationDraftRow,
};
