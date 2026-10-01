const db = require('../../utils/db');
const { PARTNER_DEFAULTS } = require('../../config/partnerProgram');
const { logPartnerAudit } = require('./partnerAttributionService');

async function requestPayout(partnerId, userId) {
  const { rows: partnerRows } = await db.query(
    `SELECT p.*, c.minimum_payout_cents
     FROM partners p
     LEFT JOIN partner_campaigns c ON c.id = p.default_campaign_id
     WHERE p.id = $1 AND p.user_id = $2
     LIMIT 1`,
    [partnerId, userId]
  );
  const partner = partnerRows[0];
  if (!partner || partner.status !== 'approved') {
    const err = new Error('Partner aktiv deyil');
    err.statusCode = 403;
    throw err;
  }

  const minCents = Number(partner.minimum_payout_cents) || PARTNER_DEFAULTS.minimum_payout_cents;

  const payout = await db.transaction(async (client) => {
    const { rows: available } = await client.query(
      `SELECT id, commission_cents
       FROM partner_commissions
       WHERE partner_id = $1 AND status = 'approved'
       ORDER BY created_at ASC
       FOR UPDATE`,
      [partnerId]
    );
    const total = available.reduce((s, r) => s + (Number(r.commission_cents) || 0), 0);
    if (total < minCents) {
      const err = new Error(`Minimum ödəniş ${minCents / 100} AZN-dir. Balans: ${(total / 100).toFixed(2)} AZN`);
      err.statusCode = 400;
      err.code = 'BELOW_MINIMUM_PAYOUT';
      throw err;
    }

    const { rows: payoutRows } = await client.query(
      `INSERT INTO partner_payouts (partner_id, amount_cents, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
      [partnerId, total]
    );
    const payout = payoutRows[0];

    for (const c of available) {
      await client.query(
        `INSERT INTO partner_payout_items (payout_id, commission_id, amount_cents)
         VALUES ($1, $2, $3)`,
        [payout.id, c.id, c.commission_cents]
      );
      await client.query(
        `UPDATE partner_commissions SET status = 'pending', updated_at = NOW() WHERE id = $1`,
        [c.id]
      );
    }

    await logPartnerAudit(
      {
        actorUserId: userId,
        partnerId,
        action: 'payout_requested',
        entityType: 'partner_payout',
        entityId: payout.id,
        context: { amount_cents: total, items: available.length },
      },
      client
    );

    return payout;
  });

  const { deferNotification } = require('../notificationService');
  deferNotification('partner_payout_requested', () => notifyAdminsPayoutRequested(payout, partnerId));
  return payout;
}

function formatAznAmount(cents) {
  return (Math.round(Number(cents) || 0) / 100).toFixed(2);
}

const PAYOUT_STATUS_EVENTS = Object.freeze({
  approved: 'partner_payout_approved',
  paid: 'partner_payout_paid',
  rejected: 'partner_payout_rejected',
});

/** Partnyora ödəniş sorğusunun yeni statusu (status həqiqətən dəyişəndə). */
async function notifyPartnerPayoutStatus(payout, status) {
  const eventType = PAYOUT_STATUS_EVENTS[status];
  if (!eventType || !payout?.partner_id) return null;
  const { rows } = await db.query(`SELECT user_id FROM partners WHERE id = $1 LIMIT 1`, [payout.partner_id]);
  const userId = rows[0]?.user_id;
  if (!userId) return null;
  const amount = formatAznAmount(payout.amount_cents);
  const { createNotificationSafe } = require('../notificationService');
  return createNotificationSafe({
    recipientId: userId,
    category: 'partner',
    eventType,
    priority: status === 'rejected' ? 'HIGH' : 'NORMAL',
    params: { amount },
    meta: { kind: eventType, payout_id: payout.id, amount_cents: Number(payout.amount_cents) || 0, amount },
    relatedEntityType: 'partner_payout',
    relatedEntityId: payout.id,
    dedupeKey: `${eventType}:${payout.id}`,
    email: true,
  });
}

/** Bütün aktiv adminlərə: yeni ödəniş sorğusu yoxlama gözləyir. */
async function notifyAdminsPayoutRequested(payout, partnerId) {
  const { rows } = await db.query(
    `SELECT COALESCE(NULLIF(TRIM(pr.display_name), ''), NULLIF(TRIM(u.full_name), ''), 'Partnyor') AS name
     FROM partners p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN partner_profiles pr ON pr.partner_id = p.id
     WHERE p.id = $1
     LIMIT 1`,
    [partnerId],
  );
  const { notifyAdmins } = require('../notificationService');
  return notifyAdmins({
    category: 'partner',
    eventType: 'partner_payout_requested',
    priority: 'HIGH',
    params: { partnerName: rows[0]?.name || 'Partnyor', amount: formatAznAmount(payout.amount_cents) },
    meta: { payout_id: payout.id, partner_id: partnerId, href: '/admin/partners' },
    relatedEntityType: 'partner_payout',
    relatedEntityId: payout.id,
    dedupeKey: `partner_payout_requested:${payout.id}`,
    email: true,
  });
}

async function adminReviewPayout({ payoutId, status, adminUserId, adminNote }) {
  if (!['approved', 'paid', 'rejected'].includes(status)) {
    const err = new Error('Yanlış payout status');
    err.statusCode = 400;
    throw err;
  }

  let previousStatus = null;
  const updated = await db.transaction(async (client) => {
    const { rows } = await client.query(`SELECT * FROM partner_payouts WHERE id = $1 FOR UPDATE`, [payoutId]);
    const payout = rows[0];
    if (!payout) {
      const err = new Error('Payout tapılmadı');
      err.statusCode = 404;
      throw err;
    }
    previousStatus = payout.status;

    await client.query(
      `UPDATE partner_payouts
       SET status = $2,
           admin_note = COALESCE($3, admin_note),
           reviewed_by = $4,
           reviewed_at = NOW(),
           paid_at = CASE WHEN $2 = 'paid' THEN NOW() ELSE paid_at END,
           updated_at = NOW()
       WHERE id = $1`,
      [payoutId, status, adminNote || null, adminUserId || null]
    );

    if (status === 'paid') {
      await client.query(
        `UPDATE partner_commissions pc
         SET status = 'paid', updated_at = NOW()
         FROM partner_payout_items i
         WHERE i.payout_id = $1 AND i.commission_id = pc.id`,
        [payoutId]
      );
    } else if (status === 'rejected') {
      await client.query(
        `UPDATE partner_commissions pc
         SET status = 'approved', updated_at = NOW()
         FROM partner_payout_items i
         WHERE i.payout_id = $1 AND i.commission_id = pc.id AND pc.status = 'pending'`,
        [payoutId]
      );
    }

    await logPartnerAudit(
      {
        actorUserId: adminUserId,
        partnerId: payout.partner_id,
        action: `payout_${status}`,
        entityType: 'partner_payout',
        entityId: payoutId,
        context: { note: adminNote || null },
      },
      client
    );

    const { rows: out } = await client.query(`SELECT * FROM partner_payouts WHERE id = $1`, [payoutId]);
    return out[0];
  });

  if (updated && previousStatus !== status) {
    await notifyPartnerPayoutStatus(updated, status);
  }

  return updated;
}

async function listPayoutsAdmin({ status, limit = 50 } = {}) {
  const params = [];
  let where = 'TRUE';
  if (status) {
    params.push(status);
    where = `po.status = $${params.length}`;
  }
  params.push(Math.min(100, Math.max(1, Number(limit) || 50)));
  const { rows } = await db.query(
    `SELECT po.*, u.full_name, u.email, pr.display_name
     FROM partner_payouts po
     JOIN partners p ON p.id = po.partner_id
     JOIN users u ON u.id = p.user_id
     LEFT JOIN partner_profiles pr ON pr.partner_id = p.id
     WHERE ${where}
     ORDER BY po.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows;
}

async function listCommissionsAdmin({ partnerId, limit = 50 } = {}) {
  const params = [];
  let where = 'TRUE';
  if (partnerId) {
    params.push(partnerId);
    where = `pc.partner_id = $${params.length}`;
  }
  params.push(Math.min(200, Math.max(1, Number(limit) || 50)));
  const { rows } = await db.query(
    `SELECT pc.*, u.email AS invited_email
     FROM partner_commissions pc
     JOIN users u ON u.id = pc.invited_user_id
     WHERE ${where}
     ORDER BY pc.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows;
}

module.exports = {
  requestPayout,
  adminReviewPayout,
  notifyPartnerPayoutStatus,
  notifyAdminsPayoutRequested,
  listPayoutsAdmin,
  listCommissionsAdmin,
};
