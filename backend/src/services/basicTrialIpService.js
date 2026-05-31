const { clientIp } = require('../utils/clientIp');

function normalizeIp(ip) {
  const s = String(ip || '').trim();
  if (!s) return '';
  if (s.startsWith('::ffff:')) return s.slice(7);
  return s.slice(0, 120);
}

/**
 * One 14-day SADƏ trial per IP. Returns granted=false when IP already used by another account.
 */
async function grantBasicTrialForInstructor(dbConn, userId, ipRaw) {
  const ip = normalizeIp(ipRaw);
  if (!ip) return { granted: true, reason: null };

  const { rows: inserted } = await dbConn.query(
    `INSERT INTO basic_trial_ip_claims (ip, user_id)
     VALUES ($1, $2)
     ON CONFLICT (ip) DO NOTHING
     RETURNING ip`,
    [ip, userId]
  );
  if (inserted[0]) return { granted: true, reason: null };

  const { rows: existing } = await dbConn.query(
    `SELECT user_id FROM basic_trial_ip_claims WHERE ip = $1 LIMIT 1`,
    [ip]
  );
  if (existing[0]?.user_id === userId) return { granted: true, reason: null };

  await dbConn.query(
    `INSERT INTO basic_trial_ip_denials (user_id, ip, reason)
     VALUES ($1, $2, 'ip_already_claimed')
     ON CONFLICT (user_id) DO NOTHING`,
    [userId, ip]
  );
  return { granted: false, reason: 'ip_already_claimed' };
}

async function hasBasicTrialIpDenial(dbConn, userId) {
  const { rows } = await dbConn.query(
    `SELECT 1 FROM basic_trial_ip_denials WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  return Boolean(rows[0]);
}

/** Legacy users without a denial row still receive the 14-day trial. */
async function isBasicTrialGranted(dbConn, userId) {
  return !(await hasBasicTrialIpDenial(dbConn, userId));
}

module.exports = {
  clientIp,
  normalizeIp,
  grantBasicTrialForInstructor,
  hasBasicTrialIpDenial,
  isBasicTrialGranted,
};
