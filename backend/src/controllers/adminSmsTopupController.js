/**
 * Admin: retired SMS top-ups awaiting a manual decision ("Refund" / "Convert to credit").
 * Each decision requires a reason and is written to admin_access_audit BEFORE anything changes
 * (fail-closed: no audit row -> 503, nothing happens).
 */
const db = require('../utils/db');
const { recordAdminAccess } = require('../services/adminAccessAudit');
const { listSmsTopupsForDecision, decideSmsTopup } = require('../services/billingCreditService');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function send(res, err) {
  return res.status(err.statusCode || 500).json({ success: false, message: err.message, code: err.code });
}

async function listSmsTopups(_req, res) {
  try {
    const items = await listSmsTopupsForDecision();
    res.json({ success: true, items });
  } catch (err) {
    send(res, err);
  }
}

function decide(decision) {
  return async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!UUID_RE.test(id)) return res.status(400).json({ success: false, code: 'INVALID_ID', message: 'Yanlış ödəniş ID' });
      const reason = String(req.body?.reason || '').trim();
      if (reason.length < 5) {
        return res.status(400).json({ success: false, code: 'REASON_REQUIRED', message: 'Səbəb tələb olunur (ən azı 5 simvol)' });
      }
      const { rows } = await db.query(
        `SELECT user_id FROM billing_payments WHERE id = $1 AND product_type = 'sms'`,
        [id],
      );
      if (!rows[0]) return res.status(404).json({ success: false, code: 'NOT_FOUND', message: 'SMS ödənişi tapılmadı' });
      await recordAdminAccess({
        actorUserId: req.user.id,
        action: decision === 'refund' ? 'billing.sms_topup.refund' : 'billing.sms_topup.convert_credit',
        targetUserId: rows[0].user_id,
        entityType: 'billing_payment',
        entityId: id,
        reason: reason.slice(0, 500),
        req,
      });
      const out = await decideSmsTopup({ paymentId: id, decision, adminId: req.user.id, reason });
      res.json({ success: true, ...out });
    } catch (err) {
      send(res, err);
    }
  };
}

module.exports = {
  listSmsTopups,
  refundSmsTopup: decide('refund'),
  convertSmsTopupToCredit: decide('credit'),
};
