const db = require('../../utils/db');
const { isPartnerProgramEnabled, PARTNER_DEFAULTS } = require('../../config/partnerProgram');
const {
  generateCode,
  getDefaultCampaign,
  logPartnerAudit,
  normalizeRefCode,
} = require('./partnerAttributionService');

async function getPartnerByUserId(userId, client = db) {
  const { rows } = await client.query(
    `SELECT p.*,
            pr.display_name, pr.phone, pr.payout_iban, pr.payout_bank_name,
            pr.payout_account_holder, pr.city,
            c.slug AS campaign_slug, c.title AS campaign_title,
            c.commission_pct, c.commission_duration_months,
            c.user_discount_pct, c.discount_duration_months,
            c.attribution_window_days, c.minimum_payout_cents, c.trial_days
     FROM partners p
     LEFT JOIN partner_profiles pr ON pr.partner_id = p.id
     LEFT JOIN partner_campaigns c ON c.id = p.default_campaign_id
     WHERE p.user_id = $1
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function ensurePrimaryLink(partnerId, campaignId, client = db) {
  const { rows: existing } = await client.query(
    `SELECT l.id, c.code
     FROM partner_referral_links l
     JOIN partner_referral_codes c ON c.link_id = l.id AND c.is_primary = TRUE
     WHERE l.partner_id = $1 AND l.is_active = TRUE
     ORDER BY l.created_at ASC
     LIMIT 1`,
    [partnerId]
  );
  if (existing[0]) return existing[0];

  let code = generateCode('mx');
  for (let i = 0; i < 5; i += 1) {
    const { rows: clash } = await client.query(
      `SELECT 1 FROM partner_referral_codes WHERE lower(code) = $1 LIMIT 1`,
      [code.toLowerCase()]
    );
    if (!clash[0]) break;
    code = generateCode('mx');
  }

  const { rows: linkRows } = await client.query(
    `INSERT INTO partner_referral_links (partner_id, campaign_id, label, is_active)
     VALUES ($1, $2, 'Default', TRUE)
     RETURNING id`,
    [partnerId, campaignId || null]
  );
  const linkId = linkRows[0].id;
  await client.query(
    `INSERT INTO partner_referral_codes (link_id, partner_id, code, is_primary)
     VALUES ($1, $2, $3, TRUE)`,
    [linkId, partnerId, code]
  );
  return { id: linkId, code };
}

async function applyAsPartner({ userId, displayName, phone, note, city }) {
  if (!isPartnerProgramEnabled()) {
    const err = new Error('Partner proqramı hazırda aktiv deyil');
    err.statusCode = 403;
    err.code = 'PARTNER_DISABLED';
    throw err;
  }

  const existing = await getPartnerByUserId(userId);
  if (existing) {
    return { partner: existing, created: false };
  }

  const campaign = await getDefaultCampaign();

  return db.transaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO partners (user_id, status, default_campaign_id, apply_note)
       VALUES ($1, 'pending', $2, $3)
       RETURNING *`,
      [userId, campaign?.id || null, note ? String(note).slice(0, 1000) : null]
    );
    const partner = rows[0];
    await client.query(
      `INSERT INTO partner_profiles (partner_id, display_name, phone, city)
       VALUES ($1, $2, $3, $4)`,
      [
        partner.id,
        displayName ? String(displayName).slice(0, 120) : null,
        phone ? String(phone).slice(0, 40) : null,
        city ? String(city).slice(0, 80) : null,
      ]
    );
    await logPartnerAudit(
      {
        actorUserId: userId,
        partnerId: partner.id,
        action: 'partner_applied',
        entityType: 'partner',
        entityId: partner.id,
      },
      client
    );
    const full = await getPartnerByUserId(userId, client);
    return { partner: full, created: true };
  });
}

async function adminSetPartnerStatus({ partnerId, status, adminUserId, adminNote }) {
  const allowed = new Set(['pending', 'approved', 'rejected', 'suspended']);
  if (!allowed.has(status)) {
    const err = new Error('Yanlış status');
    err.statusCode = 400;
    throw err;
  }

  return db.transaction(async (client) => {
    const { rows: cur } = await client.query(`SELECT * FROM partners WHERE id = $1 FOR UPDATE`, [partnerId]);
    if (!cur[0]) {
      const err = new Error('Partner tapılmadı');
      err.statusCode = 404;
      throw err;
    }

    const { rows } = await client.query(
      `UPDATE partners
       SET status = $2,
           admin_note = COALESCE($3, admin_note),
           approved_at = CASE WHEN $2 = 'approved' THEN COALESCE(approved_at, NOW()) ELSE approved_at END,
           approved_by = CASE WHEN $2 = 'approved' THEN COALESCE(approved_by, $4) ELSE approved_by END,
           suspended_at = CASE WHEN $2 = 'suspended' THEN NOW() ELSE suspended_at END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [partnerId, status, adminNote || null, adminUserId || null]
    );

    if (status === 'approved') {
      const campaignId = rows[0].default_campaign_id || (await getDefaultCampaign(client))?.id;
      await ensurePrimaryLink(partnerId, campaignId, client);
    }

    await logPartnerAudit(
      {
        actorUserId: adminUserId,
        partnerId,
        action: `partner_status_${status}`,
        entityType: 'partner',
        entityId: partnerId,
        context: { from: cur[0].status, to: status, note: adminNote || null },
      },
      client
    );

    return rows[0];
  });
}

async function listPartnersAdmin({ status, limit = 50, offset = 0 } = {}) {
  const params = [];
  let where = 'TRUE';
  if (status) {
    params.push(status);
    where = `p.status = $${params.length}`;
  }
  params.push(Math.min(100, Math.max(1, Number(limit) || 50)));
  params.push(Math.max(0, Number(offset) || 0));

  const { rows } = await db.query(
    `SELECT p.*,
            u.full_name, u.email,
            pr.display_name, pr.phone, pr.city,
            c.title AS campaign_title,
            (SELECT COUNT(*)::int FROM partner_attributions a WHERE a.partner_id = p.id AND a.self_referral_blocked = FALSE) AS attributions_count,
            (SELECT COALESCE(SUM(commission_cents),0)::int FROM partner_commissions pc WHERE pc.partner_id = p.id AND pc.status IN ('approved','pending')) AS commission_pending_cents
     FROM partners p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN partner_profiles pr ON pr.partner_id = p.id
     LEFT JOIN partner_campaigns c ON c.id = p.default_campaign_id
     WHERE ${where}
     ORDER BY p.created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params
  );
  return rows;
}

async function getPartnerDashboard(partnerId) {
  const { rows: partnerRows } = await db.query(
    `SELECT p.*, pr.display_name, pr.phone, pr.city,
            c.slug AS campaign_slug, c.title AS campaign_title, c.commission_pct, c.commission_duration_months,
            c.user_discount_pct, c.discount_duration_months, c.attribution_window_days,
            c.minimum_payout_cents, c.trial_days
     FROM partners p
     LEFT JOIN partner_profiles pr ON pr.partner_id = p.id
     LEFT JOIN partner_campaigns c ON c.id = p.default_campaign_id
     WHERE p.id = $1`,
    [partnerId]
  );
  const partner = partnerRows[0];
  if (!partner) return null;

  const { rows: links } = await db.query(
    `SELECT l.id, l.label, l.is_active, l.created_at, c.code
     FROM partner_referral_links l
     JOIN partner_referral_codes c ON c.link_id = l.id AND c.is_primary = TRUE
     WHERE l.partner_id = $1
     ORDER BY l.created_at ASC`,
    [partnerId]
  );

  const { rows: stats } = await db.query(
    `SELECT
       (SELECT COUNT(*)::int FROM partner_referral_clicks WHERE partner_id = $1) AS clicks,
       (SELECT COUNT(*)::int FROM partner_attributions WHERE partner_id = $1 AND self_referral_blocked = FALSE) AS attributions,
       (SELECT COALESCE(SUM(commission_cents),0)::int FROM partner_commissions WHERE partner_id = $1 AND status = 'approved') AS approved_cents,
       (SELECT COALESCE(SUM(commission_cents),0)::int FROM partner_commissions WHERE partner_id = $1 AND status = 'paid') AS paid_cents,
       (SELECT COALESCE(SUM(commission_cents),0)::int FROM partner_commissions WHERE partner_id = $1 AND status = 'pending') AS pending_cents`,
    [partnerId]
  );

  const { rows: commissions } = await db.query(
    `SELECT id, period_index, plan, net_amount_cents, commission_pct, commission_cents, status, created_at
     FROM partner_commissions
     WHERE partner_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [partnerId]
  );

  const { rows: payouts } = await db.query(
    `SELECT id, amount_cents, status, created_at, paid_at
     FROM partner_payouts
     WHERE partner_id = $1
     ORDER BY created_at DESC
     LIMIT 20`,
    [partnerId]
  );

  // Never expose bank/receipt details of customers
  return {
    partner: {
      id: partner.id,
      status: partner.status,
      display_name: partner.display_name,
      campaign_slug: partner.campaign_slug,
      campaign_title: partner.campaign_title,
      commission_pct: partner.commission_pct,
      commission_duration_months: partner.commission_duration_months,
      user_discount_pct: partner.user_discount_pct,
      discount_duration_months: partner.discount_duration_months,
      attribution_window_days: partner.attribution_window_days,
      minimum_payout_cents: partner.minimum_payout_cents ?? PARTNER_DEFAULTS.minimum_payout_cents,
      trial_days: partner.trial_days,
      created_at: partner.created_at,
    },
    links: links.map((l) => ({
      id: l.id,
      label: l.label,
      code: l.code,
      is_active: l.is_active,
      path: `/r/${l.code}`,
    })),
    stats: stats[0] || {},
    commissions,
    payouts,
  };
}

async function updatePartnerPayoutProfile(partnerId, userId, body) {
  const partner = await getPartnerByUserId(userId);
  if (!partner || partner.id !== partnerId) {
    const err = new Error('İcazə yoxdur');
    err.statusCode = 403;
    throw err;
  }
  await db.query(
    `INSERT INTO partner_profiles (partner_id, display_name, phone, payout_iban, payout_bank_name, payout_account_holder, city, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,NOW())
     ON CONFLICT (partner_id) DO UPDATE SET
       display_name = COALESCE($2, partner_profiles.display_name),
       phone = COALESCE($3, partner_profiles.phone),
       payout_iban = COALESCE($4, partner_profiles.payout_iban),
       payout_bank_name = COALESCE($5, partner_profiles.payout_bank_name),
       payout_account_holder = COALESCE($6, partner_profiles.payout_account_holder),
       city = COALESCE($7, partner_profiles.city),
       updated_at = NOW()`,
    [
      partnerId,
      body.display_name != null ? String(body.display_name).slice(0, 120) : null,
      body.phone != null ? String(body.phone).slice(0, 40) : null,
      body.payout_iban != null ? String(body.payout_iban).replace(/\s/g, '').slice(0, 34) : null,
      body.payout_bank_name != null ? String(body.payout_bank_name).slice(0, 80) : null,
      body.payout_account_holder != null ? String(body.payout_account_holder).slice(0, 120) : null,
      body.city != null ? String(body.city).slice(0, 80) : null,
    ]
  );
  return getPartnerByUserId(userId);
}

async function createExtraLink(partnerId, { label, code: codeRaw } = {}) {
  let code = normalizeRefCode(codeRaw) || generateCode('mx');
  if (code.length < 4) {
    const err = new Error('Kod ən azı 4 simvol olmalıdır');
    err.statusCode = 400;
    throw err;
  }
  const campaign = await getDefaultCampaign();
  return db.transaction(async (client) => {
    const { rows: clash } = await client.query(
      `SELECT 1 FROM partner_referral_codes WHERE lower(code) = $1 LIMIT 1`,
      [code]
    );
    if (clash[0]) {
      const err = new Error('Bu kod artıq mövcuddur');
      err.statusCode = 409;
      throw err;
    }
    const { rows: linkRows } = await client.query(
      `INSERT INTO partner_referral_links (partner_id, campaign_id, label, is_active)
       VALUES ($1, $2, $3, TRUE) RETURNING id`,
      [partnerId, campaign?.id || null, label ? String(label).slice(0, 80) : null]
    );
    await client.query(
      `INSERT INTO partner_referral_codes (link_id, partner_id, code, is_primary)
       VALUES ($1, $2, $3, TRUE)`,
      [linkRows[0].id, partnerId, code]
    );
    return { id: linkRows[0].id, code, path: `/r/${code}` };
  });
}

module.exports = {
  getPartnerByUserId,
  ensurePrimaryLink,
  applyAsPartner,
  adminSetPartnerStatus,
  listPartnersAdmin,
  getPartnerDashboard,
  updatePartnerPayoutProfile,
  createExtraLink,
};
