const crypto = require('crypto');
const db = require('../../utils/db');
const { isPartnerProgramEnabled, PARTNER_DEFAULTS } = require('../../config/partnerProgram');
const { resolveReferrerSource } = require('../../utils/referrerSource');

async function logPartnerAudit({ actorUserId = null, partnerId = null, action, entityType = null, entityId = null, context = null }, client = db) {
  try {
    await client.query(
      `INSERT INTO partner_audit_events (actor_user_id, partner_id, action, entity_type, entity_id, context)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        actorUserId,
        partnerId,
        String(action || 'unknown'),
        entityType,
        entityId,
        context != null ? JSON.stringify(context) : null,
      ]
    );
  } catch {
    // never break main flow
  }
}

function hashIp(ip) {
  const s = String(ip || '').trim();
  if (!s) return null;
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 32);
}

function normalizeRefCode(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);
}

function generateCode(prefix = 'mx') {
  const rand = crypto.randomBytes(4).toString('hex');
  return `${prefix}${rand}`.slice(0, 16);
}

async function getDefaultCampaign(client = db) {
  const { rows } = await client.query(
    `SELECT * FROM partner_campaigns
     WHERE is_active = TRUE AND is_default = TRUE
     ORDER BY created_at ASC
     LIMIT 1`
  );
  if (rows[0]) return rows[0];
  const { rows: any } = await client.query(
    `SELECT * FROM partner_campaigns WHERE is_active = TRUE ORDER BY created_at ASC LIMIT 1`
  );
  return any[0] || null;
}

async function resolveCodeRow(codeRaw, client = db) {
  const code = normalizeRefCode(codeRaw);
  if (!code || code.length < 4) return null;
  const { rows } = await client.query(
    `SELECT
       c.id AS code_id,
       c.code,
       c.link_id,
       c.partner_id,
       l.campaign_id AS link_campaign_id,
       l.is_active AS link_active,
       p.status AS partner_status,
       p.user_id AS partner_user_id,
       camp.id AS campaign_id,
       camp.attribution_window_days,
       camp.trial_days,
       camp.user_discount_pct,
       camp.discount_duration_months,
       camp.commission_pct,
       camp.commission_duration_months,
       camp.minimum_payout_cents,
       camp.is_active AS campaign_active
     FROM partner_referral_codes c
     JOIN partner_referral_links l ON l.id = c.link_id
     JOIN partners p ON p.id = c.partner_id
     LEFT JOIN partner_campaigns camp ON camp.id = COALESCE(l.campaign_id, p.default_campaign_id)
     WHERE lower(c.code) = $1
     LIMIT 1`,
    [code]
  );
  const row = rows[0];
  if (!row) return null;
  if (row.partner_status !== 'approved') return null;
  if (!row.link_active) return null;
  return row;
}

async function recordClick({
  codeRaw,
  sessionKey,
  ip,
  userAgent,
  landingPath,
  utmSource = null,
  utmMedium = null,
  referrerUrl = null,
  refererHeader = null,
}) {
  if (!isPartnerProgramEnabled()) return null;
  const resolved = await resolveCodeRow(codeRaw);
  if (!resolved) return null;

  let campaignId = resolved.campaign_id;
  if (!campaignId) {
    const def = await getDefaultCampaign();
    campaignId = def?.id || null;
  }

  const utm = utmSource != null ? String(utmSource).trim().slice(0, 128) : null;
  const refUrl = referrerUrl != null ? String(referrerUrl).trim().slice(0, 1024) : null;
  const referrerSource = resolveReferrerSource({
    utm_source: utm,
    utm_medium: utmMedium,
    referrer_url: refUrl,
    referer_header: refererHeader,
  });

  const { rows } = await db.query(
    `INSERT INTO partner_referral_clicks (
       link_id, code_id, partner_id, campaign_id, session_key, ip_hash, user_agent, landing_path,
       referrer_source, utm_source, referrer_url
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id, partner_id, link_id, code_id, campaign_id, referrer_source, created_at`,
    [
      resolved.link_id,
      resolved.code_id,
      resolved.partner_id,
      campaignId,
      sessionKey ? String(sessionKey).slice(0, 128) : null,
      hashIp(ip),
      userAgent ? String(userAgent).slice(0, 512) : null,
      landingPath ? String(landingPath).slice(0, 512) : null,
      referrerSource,
      utm || null,
      refUrl || null,
    ]
  );
  return {
    click: rows[0],
    code: resolved.code,
    partner_id: resolved.partner_id,
    attribution_window_days:
      Number(resolved.attribution_window_days) || PARTNER_DEFAULTS.attribution_window_days,
  };
}

/**
 * Persist attribution at registration.
 * Rule: last eligible referral before registration wins for NEW users.
 * Once attributed, do NOT silently overwrite (ADMIN_MANUAL only).
 */
async function attributeUserOnRegister({
  userId,
  refCode,
  sessionKey,
  actorUserId = null,
  source = 'register_body',
}) {
  if (!isPartnerProgramEnabled() || !userId) return { attributed: false, reason: 'disabled_or_no_user' };

  const { rows: existing } = await db.query(
    `SELECT id, partner_id, locked, self_referral_blocked
     FROM partner_attributions WHERE invited_user_id = $1 LIMIT 1`,
    [userId]
  );
  if (existing[0]) {
    return { attributed: false, reason: 'already_attributed', attribution: existing[0] };
  }

  let resolved = null;
  let clickId = null;

  if (refCode) {
    resolved = await resolveCodeRow(refCode);
  }

  // Last eligible click by session (within window) if no explicit code
  if (!resolved && sessionKey) {
    const { rows: clicks } = await db.query(
      `SELECT cl.id AS click_id, cl.link_id, cl.code_id, cl.partner_id, cl.campaign_id,
              p.status AS partner_status, p.user_id AS partner_user_id,
              camp.attribution_window_days, camp.is_active AS campaign_active
       FROM partner_referral_clicks cl
       JOIN partners p ON p.id = cl.partner_id
       LEFT JOIN partner_campaigns camp ON camp.id = cl.campaign_id
       WHERE cl.session_key = $1
         AND p.status = 'approved'
         AND cl.created_at > NOW() - make_interval(days => COALESCE(camp.attribution_window_days, $2))
       ORDER BY cl.created_at DESC
       LIMIT 1`,
      [String(sessionKey).slice(0, 128), PARTNER_DEFAULTS.attribution_window_days]
    );
    if (clicks[0]) {
      clickId = clicks[0].click_id;
      resolved = {
        link_id: clicks[0].link_id,
        code_id: clicks[0].code_id,
        partner_id: clicks[0].partner_id,
        campaign_id: clicks[0].campaign_id,
        partner_user_id: clicks[0].partner_user_id,
        attribution_window_days: clicks[0].attribution_window_days,
      };
    }
  }

  if (!resolved) return { attributed: false, reason: 'no_referral' };

  const selfReferral = String(resolved.partner_user_id) === String(userId);
  let campaignId = resolved.campaign_id;
  let windowDays = Number(resolved.attribution_window_days) || PARTNER_DEFAULTS.attribution_window_days;
  if (!campaignId) {
    const def = await getDefaultCampaign();
    campaignId = def?.id || null;
    if (def?.attribution_window_days) windowDays = Number(def.attribution_window_days);
  }

  const { rows: ins } = await db.query(
    `INSERT INTO partner_attributions (
       invited_user_id, partner_id, link_id, code_id, campaign_id, click_id,
       source, window_expires_at, locked, self_referral_blocked
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7,
       NOW() + ($8 || ' days')::interval,
       TRUE, $9
     )
     RETURNING *`,
    [
      userId,
      resolved.partner_id,
      resolved.link_id || null,
      resolved.code_id || null,
      campaignId,
      clickId,
      source,
      String(windowDays),
      selfReferral,
    ]
  );

  const attribution = ins[0];
  if (selfReferral) {
    await logPartnerAudit({
      actorUserId,
      partnerId: resolved.partner_id,
      action: 'self_referral_blocked',
      entityType: 'partner_attribution',
      entityId: attribution.id,
      context: { invited_user_id: userId },
    });
    return { attributed: false, reason: 'self_referral', attribution };
  }

  await logPartnerAudit({
    actorUserId,
    partnerId: resolved.partner_id,
    action: 'attribution_created',
    entityType: 'partner_attribution',
    entityId: attribution.id,
    context: { invited_user_id: userId, source },
  });

  return { attributed: true, attribution };
}

/**
 * Admin-only reassignment (audited). Silent overwrite is forbidden elsewhere.
 */
async function adminReassignAttribution({ invitedUserId, partnerId, campaignId, actorUserId, note }) {
  const { rows: partnerRows } = await db.query(
    `SELECT id, status FROM partners WHERE id = $1 LIMIT 1`,
    [partnerId]
  );
  if (!partnerRows[0] || partnerRows[0].status !== 'approved') {
    const err = new Error('Partner tapılmadı və ya təsdiqlənməyib');
    err.statusCode = 400;
    throw err;
  }

  let campId = campaignId;
  let windowDays = PARTNER_DEFAULTS.attribution_window_days;
  if (campId) {
    const { rows: c } = await db.query(`SELECT id, attribution_window_days FROM partner_campaigns WHERE id = $1`, [
      campId,
    ]);
    if (c[0]) windowDays = Number(c[0].attribution_window_days) || windowDays;
  } else {
    const def = await getDefaultCampaign();
    campId = def?.id || null;
    if (def?.attribution_window_days) windowDays = Number(def.attribution_window_days);
  }

  const { rows: prev } = await db.query(
    `SELECT * FROM partner_attributions WHERE invited_user_id = $1 LIMIT 1`,
    [invitedUserId]
  );

  let attribution;
  if (prev[0]) {
    const { rows } = await db.query(
      `UPDATE partner_attributions
       SET partner_id = $2,
           campaign_id = $3,
           source = 'admin_manual',
           attributed_at = NOW(),
           window_expires_at = NOW() + ($4 || ' days')::interval,
           locked = TRUE,
           self_referral_blocked = FALSE,
           updated_at = NOW()
       WHERE invited_user_id = $1
       RETURNING *`,
      [invitedUserId, partnerId, campId, String(windowDays)]
    );
    attribution = rows[0];
  } else {
    const { rows } = await db.query(
      `INSERT INTO partner_attributions (
         invited_user_id, partner_id, campaign_id, source, window_expires_at, locked
       ) VALUES ($1, $2, $3, 'admin_manual', NOW() + ($4 || ' days')::interval, TRUE)
       RETURNING *`,
      [invitedUserId, partnerId, campId, String(windowDays)]
    );
    attribution = rows[0];
  }

  await logPartnerAudit({
    actorUserId,
    partnerId,
    action: 'ADMIN_MANUAL_attribution',
    entityType: 'partner_attribution',
    entityId: attribution.id,
    context: {
      invited_user_id: invitedUserId,
      previous_partner_id: prev[0]?.partner_id || null,
      note: note || null,
    },
  });

  return attribution;
}

async function getActiveAttributionForUser(userId, client = db) {
  if (!userId) return null;
  const { rows } = await client.query(
    `SELECT a.*,
            c.user_discount_pct, c.discount_duration_months,
            c.commission_pct, c.commission_duration_months,
            c.trial_days, c.minimum_payout_cents, c.slug AS campaign_slug, c.title AS campaign_title,
            p.status AS partner_status, p.user_id AS partner_user_id
     FROM partner_attributions a
     JOIN partners p ON p.id = a.partner_id
     LEFT JOIN partner_campaigns c ON c.id = a.campaign_id
     WHERE a.invited_user_id = $1
       AND a.self_referral_blocked = FALSE
       AND a.window_expires_at > NOW()
       AND p.status = 'approved'
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

module.exports = {
  logPartnerAudit,
  hashIp,
  normalizeRefCode,
  generateCode,
  getDefaultCampaign,
  resolveCodeRow,
  recordClick,
  attributeUserOnRegister,
  adminReassignAttribution,
  getActiveAttributionForUser,
};
