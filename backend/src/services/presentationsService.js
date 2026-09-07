const db = require('../utils/db');
const { assertMaterialsUploadAllowed, getMaterialsQuota } = require('./courseMaterialsService');

const ALLOWED_TOOLS = new Set(['pen', 'highlighter', 'eraser']);

function mapPresentationRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    file_url: row.file_url,
    file_size: Number(row.file_size) || 0,
    original_filename: row.original_filename || null,
    slide_count: Number(row.slide_count) || 0,
    settings: row.settings && typeof row.settings === 'object' && !Array.isArray(row.settings) ? row.settings : {},
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function countPdfPages(buffer) {
  if (!buffer || !buffer.length) return 0;
  try {
    const { PDFDocument } = require('pdf-lib');
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    return doc.getPageCount() || 0;
  } catch {
    try {
      const pdfParse = require('pdf-parse');
      const data = await pdfParse(buffer);
      return Number(data?.numpages) || 0;
    } catch {
      return 0;
    }
  }
}

async function listPresentations(instructorId) {
  const { rows } = await db.query(
    `SELECT id, title, file_url, file_size, original_filename, slide_count, settings, created_at, updated_at
     FROM presentations
     WHERE instructor_id = $1
     ORDER BY updated_at DESC, created_at DESC`,
    [instructorId],
  );
  return rows.map(mapPresentationRow);
}

async function getPresentationForInstructor(instructorId, presentationId) {
  const { rows } = await db.query(
    `SELECT * FROM presentations WHERE id = $1 AND instructor_id = $2 LIMIT 1`,
    [presentationId, instructorId],
  );
  return rows[0] || null;
}

async function createPresentation({
  instructorId,
  title,
  fileUrl,
  storageFilename,
  fileSize,
  originalFilename,
  slideCount,
}) {
  const { rows } = await db.query(
    `INSERT INTO presentations (
       instructor_id, title, storage_filename, file_url, file_size, original_filename, slide_count
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      instructorId,
      title,
      storageFilename,
      fileUrl,
      fileSize,
      originalFilename,
      Number.isFinite(slideCount) ? Math.max(0, Math.round(slideCount)) : 0,
    ],
  );
  return rows[0];
}

async function updatePresentation(instructorId, presentationId, patch) {
  const current = await getPresentationForInstructor(instructorId, presentationId);
  if (!current) return null;

  const title = patch.title != null ? String(patch.title).trim().slice(0, 200) : current.title;
  const slideCount =
    patch.slide_count != null && Number.isFinite(Number(patch.slide_count))
      ? Math.max(0, Math.round(Number(patch.slide_count)))
      : current.slide_count;

  if (!title) {
    const err = new Error('Ad boş ola bilməz');
    err.status = 400;
    throw err;
  }

  const { rows } = await db.query(
    `UPDATE presentations
     SET title = $3, slide_count = $4, updated_at = NOW()
     WHERE id = $1 AND instructor_id = $2
     RETURNING *`,
    [presentationId, instructorId, title, slideCount],
  );
  return rows[0] || null;
}

async function deletePresentation(instructorId, presentationId) {
  const { rows } = await db.query(
    `DELETE FROM presentations WHERE id = $1 AND instructor_id = $2 RETURNING *`,
    [presentationId, instructorId],
  );
  return rows[0] || null;
}

function sanitizePoint(raw) {
  const x = Number(raw?.x);
  const y = Number(raw?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const p = Number(raw?.p);
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
    p: Number.isFinite(p) ? Math.min(1, Math.max(0, p)) : 0.5,
  };
}

function sanitizeStroke(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const tool = ALLOWED_TOOLS.has(raw.tool) ? raw.tool : 'pen';
  const points = Array.isArray(raw.points) ? raw.points.map(sanitizePoint).filter(Boolean).slice(0, 4000) : [];
  if (points.length < 1) return null;
  const width = Number(raw.width);
  const opacity = Number(raw.opacity);
  const color = typeof raw.color === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw.color)
    ? raw.color
    : tool === 'highlighter'
      ? '#facc15'
      : '#111827';
  return {
    id: String(raw.id || '').slice(0, 64) || `s_${Date.now()}`,
    tool,
    color,
    width: Number.isFinite(width) ? Math.min(48, Math.max(0.5, width)) : tool === 'highlighter' ? 18 : 2.5,
    opacity: Number.isFinite(opacity) ? Math.min(1, Math.max(0.05, opacity)) : tool === 'highlighter' ? 0.35 : 1,
    points,
  };
}

function sanitizeStrokes(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeStroke).filter(Boolean).slice(0, 2000);
}

async function listAnnotations(presentationId) {
  const { rows } = await db.query(
    `SELECT slide_index, strokes FROM presentation_annotations WHERE presentation_id = $1`,
    [presentationId],
  );
  const map = {};
  for (const row of rows) {
    map[String(row.slide_index)] = sanitizeStrokes(row.strokes);
  }
  return map;
}

async function upsertAnnotations(instructorId, presentationId, slideIndex, strokes) {
  const current = await getPresentationForInstructor(instructorId, presentationId);
  if (!current) return null;
  const idx = Math.max(0, Math.round(Number(slideIndex) || 0));
  const clean = sanitizeStrokes(strokes);
  await db.query(
    `INSERT INTO presentation_annotations (presentation_id, slide_index, strokes, updated_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (presentation_id, slide_index) DO UPDATE SET
       strokes = EXCLUDED.strokes,
       updated_at = NOW()`,
    [presentationId, idx, JSON.stringify(clean)],
  );
  await db.query(`UPDATE presentations SET updated_at = NOW() WHERE id = $1`, [presentationId]);
  return { slide_index: idx, strokes: clean };
}

module.exports = {
  mapPresentationRow,
  countPdfPages,
  listPresentations,
  getPresentationForInstructor,
  createPresentation,
  updatePresentation,
  deletePresentation,
  listAnnotations,
  upsertAnnotations,
  assertMaterialsUploadAllowed,
  getMaterialsQuota,
};
