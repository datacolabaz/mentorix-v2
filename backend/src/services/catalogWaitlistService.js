const db = require('../utils/db');
const { isValidPublicEmail } = require('../lib/emailValidation');
const { sendCatalogWaitlistEmail } = require('./catalogWaitlistEmailService');

async function resolveCategoryId({ categoryId, categorySlug }) {
  if (categoryId) {
    const { rows } = await db.query(`SELECT id FROM exam_categories WHERE id = $1 LIMIT 1`, [categoryId]);
    return rows[0]?.id || null;
  }
  const slug = String(categorySlug || '').trim();
  if (!slug) return null;
  const { rows } = await db.query(`SELECT id FROM exam_categories WHERE slug = $1 LIMIT 1`, [slug]);
  return rows[0]?.id || null;
}

async function subscribeWaitlist({ email, categoryId, categorySlug }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!isValidPublicEmail(normalized)) {
    const err = new Error('Düzgün email daxil edin (.local və s. qəbul olunmur)');
    err.status = 400;
    throw err;
  }

  const resolvedCategoryId = await resolveCategoryId({ categoryId, categorySlug });
  if (!resolvedCategoryId && (categoryId || categorySlug)) {
    const err = new Error('Kateqoriya tapılmadı');
    err.status = 404;
    throw err;
  }

  const { rows: catRows } = resolvedCategoryId
    ? await db.query(`SELECT id, slug, name FROM exam_categories WHERE id = $1`, [resolvedCategoryId])
    : { rows: [] };
  const category = catRows[0] || null;

  if (resolvedCategoryId) {
    const { rows: existing } = await db.query(
      `SELECT id FROM waitlist_notifications WHERE email = $1 AND category_id = $2 LIMIT 1`,
      [normalized, resolvedCategoryId],
    );
    if (existing[0]) {
      await db.query(
        `UPDATE waitlist_notifications SET
           notified_at = NULL,
           category_slug = $2,
           category = $3,
           created_at = NOW()
         WHERE id = $1`,
        [existing[0].id, category?.slug || categorySlug || null, category?.slug || null],
      );
    } else {
      await db.query(
        `INSERT INTO waitlist_notifications (email, category_id, category_slug, category, source)
         VALUES ($1, $2, $3, $4, 'certified_catalog')`,
        [normalized.slice(0, 255), resolvedCategoryId, category?.slug || categorySlug || null, category?.slug || null],
      );
    }
  } else {
    const { rows: existing } = await db.query(
      `SELECT id FROM waitlist_notifications WHERE email = $1 AND category_id IS NULL LIMIT 1`,
      [normalized],
    );
    if (existing[0]) {
      await db.query(
        `UPDATE waitlist_notifications SET notified_at = NULL, created_at = NOW() WHERE id = $1`,
        [existing[0].id],
      );
    } else {
      await db.query(
        `INSERT INTO waitlist_notifications (email, category_id, source) VALUES ($1, NULL, 'certified_catalog')`,
        [normalized],
      );
    }
  }

  return {
    email: normalized,
    category_id: resolvedCategoryId,
    category_name: category?.name || null,
    category_slug: category?.slug || categorySlug || null,
  };
}

async function emailSentWithin24h(email) {
  const { rows } = await db.query(
    `SELECT 1 FROM waitlist_email_log
     WHERE email = $1 AND sent_at > NOW() - INTERVAL '24 hours'
     LIMIT 1`,
    [email],
  );
  return rows.length > 0;
}

async function getAdminWaitlistStats() {
  const { rows } = await db.query(
    `SELECT
       ec.id AS category_id,
       ec.slug AS category_slug,
       ec.name AS category_name,
       ec.icon AS category_icon,
       parent.name AS parent_name,
       COUNT(w.id)::int AS pending_count,
       COUNT(w.id) FILTER (WHERE w.created_at > NOW() - INTERVAL '7 days')::int AS recent_count,
       MAX(w.created_at) AS last_signup_at
     FROM waitlist_notifications w
     JOIN exam_categories ec ON ec.id = w.category_id
     LEFT JOIN exam_categories parent ON parent.id = ec.parent_id
     WHERE w.notified_at IS NULL AND w.category_id IS NOT NULL
     GROUP BY ec.id, ec.slug, ec.name, ec.icon, parent.name, COALESCE(parent.sort_order, ec.sort_order), ec.sort_order
     ORDER BY pending_count DESC, last_signup_at DESC NULLS LAST`,
  );
  return rows;
}

async function notifyWaitlistForVerifiedExam(examId) {
  const { rows: examRows } = await db.query(
    `SELECT
       e.id, e.title, e.title_ru, e.category_id,
       ec.slug AS category_slug, ec.name AS category_name, ec.parent_id,
       parent.slug AS parent_slug, parent.name AS parent_name
     FROM exams e
     LEFT JOIN exam_categories ec ON ec.id = e.category_id
     LEFT JOIN exam_categories parent ON parent.id = ec.parent_id
     WHERE e.id = $1 AND COALESCE(e.is_deleted, FALSE) = FALSE`,
    [examId],
  );
  const exam = examRows[0];
  if (!exam?.category_id) return { sent: 0, skipped: 0, marked: 0 };

  const { rows: waiters } = await db.query(
    `SELECT w.id, w.email
     FROM waitlist_notifications w
     WHERE w.notified_at IS NULL
       AND w.category_id IS NOT NULL
       AND (
         w.category_id = $1
         OR w.category_id = $2
         OR EXISTS (
           SELECT 1 FROM exam_categories ec
           WHERE ec.id = $1 AND ec.parent_id = w.category_id
         )
       )
     ORDER BY w.created_at ASC`,
    [exam.category_id, exam.parent_id],
  );

  if (!waiters.length) return { sent: 0, skipped: 0, marked: 0 };

  const categorySlug = exam.parent_slug || exam.category_slug;
  const categoryName = exam.parent_name || exam.category_name;
  const byEmail = new Map();
  for (const w of waiters) {
    if (!byEmail.has(w.email)) byEmail.set(w.email, []);
    byEmail.get(w.email).push(w.id);
  }

  let sent = 0;
  let skipped = 0;
  let marked = 0;

  for (const [email, ids] of byEmail.entries()) {
    const recentlySent = await emailSentWithin24h(email);
    if (!recentlySent) {
      const result = await sendCatalogWaitlistEmail({
        to: email,
        categoryName,
        examTitle: exam.title,
        categorySlug,
        examId: exam.id,
      });
      if (result.ok) {
        await db.query(
          `INSERT INTO waitlist_email_log (email, exam_id, category_id) VALUES ($1, $2, $3)`,
          [email, exam.id, exam.category_id],
        );
        sent += 1;
      } else {
        skipped += 1;
        continue;
      }
    } else {
      skipped += 1;
    }

    await db.query(
      `UPDATE waitlist_notifications SET notified_at = NOW() WHERE id = ANY($1::uuid[])`,
      [ids],
    );
    marked += ids.length;
  }

  return { sent, skipped, marked };
}

module.exports = {
  subscribeWaitlist,
  getAdminWaitlistStats,
  notifyWaitlistForVerifiedExam,
};
