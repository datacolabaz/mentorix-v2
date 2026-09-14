const {
  applyAsPartner,
  getPartnerByUserId,
  getPartnerDashboard,
  updatePartnerPayoutProfile,
  createExtraLink,
  markPartnerNotificationRead,
} = require('../services/partner/partnerService');
const { requestPayout } = require('../services/partner/partnerPayoutService');
const { getCheckoutDiscountForUser } = require('../services/partner/partnerCommissionService');
const { isPartnerProgramEnabled } = require('../config/partnerProgram');
const db = require('../utils/db');

async function requirePartner(req, res) {
  const partner = await getPartnerByUserId(req.user.id);
  if (!partner) {
    res.status(404).json({ success: false, message: 'Partner profili tapılmadı', code: 'NOT_PARTNER' });
    return null;
  }
  return partner;
}

async function getProgramStatus(req, res) {
  try {
    res.json({
      success: true,
      enabled: isPartnerProgramEnabled(),
      partner: req.user?.id ? await getPartnerByUserId(req.user.id) : null,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function apply(req, res) {
  try {
    const out = await applyAsPartner({
      userId: req.user.id,
      displayName: req.body?.display_name || req.user.full_name,
      phone: req.body?.phone || req.user.phone,
      note: req.body?.note,
      city: req.body?.city,
    });
    res.status(out.created ? 201 : 200).json({ success: true, ...out });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message, code: err.code });
  }
}

async function me(req, res) {
  try {
    const partner = await getPartnerByUserId(req.user.id);
    if (!partner) return res.status(404).json({ success: false, message: 'Partner deyilsiniz', code: 'NOT_PARTNER' });
    // Strip sensitive payout fields from list responses for others — own profile OK for editing
    res.json({
      success: true,
      partner: {
        id: partner.id,
        status: partner.status,
        display_name: partner.display_name,
        phone: partner.phone,
        city: partner.city,
        payout_iban: partner.payout_iban,
        payout_bank_name: partner.payout_bank_name,
        payout_account_holder: partner.payout_account_holder,
        campaign_slug: partner.campaign_slug,
        campaign_title: partner.campaign_title,
        commission_pct: partner.commission_pct,
        commission_duration_months: partner.commission_duration_months,
        user_discount_pct: partner.user_discount_pct,
        discount_duration_months: partner.discount_duration_months,
        attribution_window_days: partner.attribution_window_days,
        minimum_payout_cents: partner.minimum_payout_cents,
        trial_days: partner.trial_days,
        created_at: partner.created_at,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function dashboard(req, res) {
  try {
    const partner = await requirePartner(req, res);
    if (!partner) return;
    if (partner.status !== 'approved') {
      return res.json({
        success: true,
        pending: true,
        partner: { id: partner.id, status: partner.status },
        message: 'Müraciətiniz baxılır',
      });
    }
    const data = await getPartnerDashboard(partner.id, { period: req.query?.period });
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

async function updateProfile(req, res) {
  try {
    const partner = await requirePartner(req, res);
    if (!partner) return;
    const updated = await updatePartnerPayoutProfile(partner.id, req.user.id, req.body || {});
    res.json({ success: true, partner: updated });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

async function createLink(req, res) {
  try {
    const partner = await requirePartner(req, res);
    if (!partner) return;
    if (partner.status !== 'approved') {
      return res.status(403).json({ success: false, message: 'Partner təsdiqlənməyib' });
    }
    const link = await createExtraLink(partner.id, {
      label: req.body?.label,
      code: req.body?.code,
    });
    res.status(201).json({ success: true, link });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

async function payoutRequest(req, res) {
  try {
    const partner = await requirePartner(req, res);
    if (!partner) return;
    const payout = await requestPayout(partner.id, req.user.id);
    res.status(201).json({ success: true, payout });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message, code: err.code });
  }
}

async function markNotificationRead(req, res) {
  try {
    const partner = await requirePartner(req, res);
    if (!partner) return;
    const ok = await markPartnerNotificationRead(req.user.id, req.params.id);
    if (!ok) return res.status(404).json({ success: false, message: 'Bildiriş tapılmadı' });
    res.json({ success: true });
  } catch (err) {
    res.status(err.statusCode || 500).json({ success: false, message: err.message });
  }
}

/** For upgrade UI — current user referral offer (no receipts/bank). */
async function myOffer(req, res) {
  try {
    const offer = await getCheckoutDiscountForUser(db, req.user.id);
    res.json({ success: true, offer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getProgramStatus,
  apply,
  me,
  dashboard,
  updateProfile,
  createLink,
  payoutRequest,
  markNotificationRead,
  myOffer,
};
