/**
 * Kimin hansı tələbə fəaliyyətinə baxa biləcəyi (DB-dən asılı deyil).
 * - Müəllim: yalnız öz provider workspace-i (instructor_id = özü). ?instructor_id= nəzərə alınmır.
 * - Admin: yalnız oxumaq; hədəf müəllim (?instructor_id=) + səbəb (reason) tələb olunur, audit yazılır.
 * - Tələbə, valideyn, partnyor, org və rolsuz istifadəçi: müəllim analitikasına heç vaxt.
 * Tələbə öz hadisəsini yalnız ayrıca tələbə endpoint-ləri ilə göndərir; başqasının məlumatını almır.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ADMIN_REASON_MIN = 5;
const ADMIN_REASON_MAX = 500;

function deny(status, message, code, details = null) {
  return { ok: false, status, message, code, details };
}

function normalizeReason(raw) {
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim();
  return s.length > ADMIN_REASON_MAX ? s.slice(0, ADMIN_REASON_MAX) : s;
}

/**
 * @param {{ id: string, role: string|null }} user
 * @param {{ instructorId?: string, reason?: string, write?: boolean }} input
 * @returns {{ ok: true, ownerId: string, admin: null | { targetInstructorId: string, reason: string } }
 *   | { ok: false, status: number, message: string, code: string }}
 */
function resolveActivityScope(user, { instructorId = null, reason = null, write = false } = {}) {
  const role = user?.role || null;
  if (!user?.id) return deny(401, 'Giriş tələb olunur', 'AUTH_REQUIRED');
  if (role === 'instructor') return { ok: true, ownerId: String(user.id), admin: null };
  if (role !== 'admin') return deny(403, 'İcazə yoxdur', 'ACTIVITY_FORBIDDEN');
  if (write) return deny(403, 'Admin tələbə fəaliyyətini yalnız oxuya bilər', 'ADMIN_READ_ONLY');
  const target = String(instructorId || '').trim();
  if (!UUID_RE.test(target)) {
    return deny(400, 'Müəllim seçilməyib: admin baxışı üçün instructor_id lazımdır', 'ADMIN_TARGET_REQUIRED');
  }
  const why = normalizeReason(reason);
  if (why.length < ADMIN_REASON_MIN) {
    return deny(
      400,
      `Bu müəllimin tələbə fəaliyyətinə baxmaq üçün səbəb yazın (ən azı ${ADMIN_REASON_MIN} simvol). Səbəb audit jurnalına yazılır.`,
      'ADMIN_REASON_REQUIRED',
      { reason_min_length: ADMIN_REASON_MIN },
    );
  }
  return { ok: true, ownerId: target, admin: { targetInstructorId: target, reason: why } };
}

module.exports = {
  UUID_RE,
  ADMIN_REASON_MIN,
  ADMIN_REASON_MAX,
  normalizeReason,
  resolveActivityScope,
};
