/**
 * Qrupun «boşdur» tərifi Tələbələrim siyahısı ilə eyni olmalıdır:
 * aktiv tələbə hesabı + silinməmiş enrollment + görünən status.
 * Gözləmədə (pending_setup) qeydlər qrupu tutur; deaktiv user / imtahan-tapşırıq gözləməsi tutmur.
 */

const OCCUPYING_STATUSES_SQL = `'active', 'pending_setup', 'pending_approval', 'paused'`;

function instructorIdNorm(id) {
  return String(id || '')
    .trim()
    .toLowerCase()
    .replace(/-/g, '');
}

function occupyingWhereSql(groupParam, instructorNormParam) {
  return `
    e.group_id = $${groupParam}::uuid
    AND REPLACE(LOWER(TRIM(e.instructor_id::text)), '-', '') = $${instructorNormParam}
    AND e.deleted_at IS NULL
    AND COALESCE(LOWER(TRIM(e.status)), 'active') IN (${OCCUPYING_STATUSES_SQL})
    AND NOT (
      COALESCE(LOWER(TRIM(e.status)), '') = 'pending_setup'
      AND COALESCE(LOWER(TRIM(e.enrollment_source)), '') IN ('exam', 'task')
    )
    AND u.is_active = TRUE
    AND u.deleted_at IS NULL
  `;
}

function occupancyStatusHint(status) {
  const st = String(status || '').trim().toLowerCase();
  if (st === 'pending_setup') return 'quraşdırma gözləyir';
  if (st === 'pending_approval') return 'təsdiq gözləyir';
  if (st === 'paused') return 'fasilədə';
  return null;
}

function formatOccupyingLabel(row) {
  const name = String(row?.full_name || '').trim() || 'Tələbə';
  const hint = occupancyStatusHint(row?.status);
  return hint ? `${name} — ${hint}` : name;
}

function groupNotEmptyMessage(rows, total) {
  const labels = (Array.isArray(rows) ? rows : []).map(formatOccupyingLabel).filter(Boolean);
  const extra = Math.max(0, Number(total) - labels.length);
  const shown = extra > 0 ? `${labels.join(', ')} +${extra}` : labels.join(', ');
  if (shown) {
    return `Qrupda hələ tələbə var (${shown}) — əvvəlcə tələbələri başqa qrupa köçürün və ya silin`;
  }
  return 'Qrupda hələ tələbə var — əvvəlcə tələbələri başqa qrupa köçürün və ya silin';
}

async function countOccupyingGroupEnrollments(conn, groupId, instructorId) {
  if (!groupId) return 0;
  const { rows } = await conn.query(
    `SELECT COUNT(*)::int AS n
     FROM enrollments e
     JOIN users u ON u.id = e.student_id
     WHERE ${occupyingWhereSql(1, 2)}`,
    [groupId, instructorIdNorm(instructorId)],
  );
  return Number(rows[0]?.n) || 0;
}

async function listOccupyingGroupEnrollments(conn, groupId, instructorId, limit = 8) {
  if (!groupId) return [];
  const cap = Math.min(20, Math.max(1, Number(limit) || 8));
  const { rows } = await conn.query(
    `SELECT u.full_name, e.status, COALESCE(e.enrollment_source, 'manual') AS enrollment_source
     FROM enrollments e
     JOIN users u ON u.id = e.student_id
     WHERE ${occupyingWhereSql(1, 2)}
     ORDER BY u.full_name ASC NULLS LAST
     LIMIT $3`,
    [groupId, instructorIdNorm(instructorId), cap],
  );
  return rows;
}

module.exports = {
  countOccupyingGroupEnrollments,
  listOccupyingGroupEnrollments,
  groupNotEmptyMessage,
  occupancyStatusHint,
};
