const db = require('../utils/db');
const {
  listPartnersAdmin,
  adminSetPartnerStatus,
  getPartnerDashboard,
} = require('../services/partner/partnerService');
const {
  listPayoutsAdmin,
  listCommissionsAdmin,
  adminReviewPayout,
} = require('../services/partner/partnerPayoutService');
const { adminReassignAttribution } = require('../services/partner/partnerAttributionService');
const { PARTNER_DEFAULTS } = require('../config/partnerProgram');

async function listPartners(req, res) {
  try {
    const rows = await listPartnersAdmin({
      status: req.query.status || null,
      limit: req.query.limit,
      offset: req.query.offset,
    });
    res.json({ success: true, partners: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function setStatus(req, res) {
  try {
    const partner = await adminSetPartnerStatus({
      partnerId: req.params.id,
      status: String(req.body?.status || '').trim(),
      adminUserId: req.user.id,
      adminNote: req.body?.admin_note,
    });
    res.json({ success: true, partner });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

async function getPartner(req, res) {
  try {
    const data = await getPartnerDashboard(req.params.id);
    if (!data) return res.status(404).json({ success: false, message: 'Tapılmadı' });
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function listCampaigns(req, res) {
  try {
    const { rows } = await db.query(
      `SELECT * FROM partner_campaigns ORDER BY is_default DESC, created_at ASC`
    );
    res.json({ success: true, campaigns: rows, defaults: PARTNER_DEFAULTS });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function upsertCampaign(req, res) {
  try {
    const b = req.body || {};
    if (b.id) {
      const { rows } = await db.query(
        `UPDATE partner_campaigns SET
           title = COALESCE($2, title),
           description = COALESCE($3, description),
           is_active = COALESCE($4, is_active),
           trial_days = COALESCE($5, trial_days),
           user_discount_pct = COALESCE($6, user_discount_pct),
           discount_duration_months = COALESCE($7, discount_duration_months),
           commission_pct = COALESCE($8, commission_pct),
           commission_duration_months = COALESCE($9, commission_duration_months),
           attribution_window_days = COALESCE($10, attribution_window_days),
           minimum_payout_cents = COALESCE($11, minimum_payout_cents),
           updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [
          b.id,
          b.title,
          b.description,
          b.is_active,
          b.trial_days,
          b.user_discount_pct,
          b.discount_duration_months,
          b.commission_pct,
          b.commission_duration_months,
          b.attribution_window_days,
          b.minimum_payout_cents,
        ]
      );
      return res.json({ success: true, campaign: rows[0] });
    }
    const slug = String(b.slug || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .slice(0, 64);
    if (!slug || !b.title) {
      return res.status(400).json({ success: false, message: 'slug və title tələb olunur' });
    }
    const { rows } = await db.query(
      `INSERT INTO partner_campaigns (
         slug, title, description, is_active, is_default,
         trial_days, user_discount_pct, discount_duration_months,
         commission_pct, commission_duration_months,
         attribution_window_days, minimum_payout_cents
       ) VALUES ($1,$2,$3,COALESCE($4,TRUE),FALSE,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        slug,
        b.title,
        b.description || null,
        b.is_active,
        b.trial_days ?? PARTNER_DEFAULTS.trial_days,
        b.user_discount_pct ?? PARTNER_DEFAULTS.user_discount_pct,
        b.discount_duration_months ?? PARTNER_DEFAULTS.discount_duration_months,
        b.commission_pct ?? PARTNER_DEFAULTS.commission_pct,
        b.commission_duration_months ?? PARTNER_DEFAULTS.commission_duration_months,
        b.attribution_window_days ?? PARTNER_DEFAULTS.attribution_window_days,
        b.minimum_payout_cents ?? PARTNER_DEFAULTS.minimum_payout_cents,
      ]
    );
    res.status(201).json({ success: true, campaign: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function listCommissions(req, res) {
  try {
    const rows = await listCommissionsAdmin({
      partnerId: req.query.partner_id || null,
      limit: req.query.limit,
    });
    res.json({ success: true, commissions: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function listPayouts(req, res) {
  try {
    const rows = await listPayoutsAdmin({ status: req.query.status || null, limit: req.query.limit });
    res.json({ success: true, payouts: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function reviewPayout(req, res) {
  try {
    const payout = await adminReviewPayout({
      payoutId: req.params.id,
      status: String(req.body?.status || '').trim(),
      adminUserId: req.user.id,
      adminNote: req.body?.admin_note,
    });
    res.json({ success: true, payout });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

async function reassignAttribution(req, res) {
  try {
    const attribution = await adminReassignAttribution({
      invitedUserId: req.body?.invited_user_id,
      partnerId: req.body?.partner_id,
      campaignId: req.body?.campaign_id || null,
      actorUserId: req.user.id,
      note: req.body?.note,
    });
    res.json({ success: true, attribution });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

module.exports = {
  listPartners,
  setStatus,
  getPartner,
  listCampaigns,
  upsertCampaign,
  listCommissions,
  listPayouts,
  reviewPayout,
  reassignAttribution,
};
