const db = require('../utils/db');

/**
 * Adminin həssas məlumata (tələbə fəaliyyəti) girişinin audit yazısı.
 * Fail-closed: audit yazılmadısa giriş verilmir (spec: «audit log required»).
 * Cədvəl admin_access_audit audit planında 222 nömrəli miqrasiyaya (phase D/E) aiddir;
 * layihə: backend/scripts/sql/proposed/222_admin_access_audit.sql. Cədvəl yoxdursa 503 qaytarılır.
 */

class AdminAuditUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 503;
    this.code = 'ADMIN_AUDIT_UNAVAILABLE';
  }
}

function clientIp(req) {
  const fwd = String(req?.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return (fwd || req?.ip || req?.socket?.remoteAddress || '').slice(0, 64) || null;
}

async function recordAdminAccess({ actorUserId, action, targetUserId = null, entityType = null, entityId = null, reason, req = null }) {
  try {
    await db.query(
      `INSERT INTO admin_access_audit (actor_user_id, action, target_user_id, entity_type, entity_id, reason, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        actorUserId,
        String(action).slice(0, 100),
        targetUserId,
        entityType,
        entityId,
        reason,
        clientIp(req),
        String(req?.headers?.['user-agent'] || '').slice(0, 300) || null,
      ],
    );
  } catch (err) {
    const missing = err && err.code === '42P01';
    console.error('[admin-audit] write failed', missing ? 'admin_access_audit table missing' : err.message);
    throw new AdminAuditUnavailableError(
      missing
        ? 'Admin audit jurnalı hələ qurulmayıb — giriş bağlıdır'
        : 'Admin audit yazılmadı — giriş bağlıdır',
    );
  }
}

module.exports = { recordAdminAccess, AdminAuditUnavailableError };
