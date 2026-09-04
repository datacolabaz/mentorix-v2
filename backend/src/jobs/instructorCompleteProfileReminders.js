const db = require('../utils/db');
const { normalizeLocale } = require('../lib/userLocale');
const { sendCompleteProfileEmail } = require('../services/instructorCompleteProfileEmail');

const MIN_AGE = "INTERVAL '2 hours'";
const RESEND_AFTER = "INTERVAL '7 days'";
const MAX_SENDS = 2;

function isSearchable(row) {
  const hasCategories = Number(row.categories_count || 0) > 0;
  const hasMapPin = row.latitude != null && row.longitude != null;
  const hasFormats = Number(row.formats_count || 0) > 0;
  const mapVisible = row.map_visible !== false;
  return hasCategories && mapVisible && (hasMapPin || hasFormats);
}

async function runInstructorCompleteProfileReminders() {
  const { rows } = await db.query(
    `SELECT
        u.id,
        u.full_name,
        u.email,
        COALESCE(u.locale, 'az') AS locale,
        COALESCE(ip.complete_profile_email_count, 0)::int AS email_count,
        COALESCE(ip.map_visible, TRUE) AS map_visible,
        ip.latitude,
        ip.longitude,
        COALESCE(cat.n, 0)::int AS categories_count,
        COALESCE(fmt.n, 0)::int AS formats_count
     FROM users u
     INNER JOIN instructor_profiles ip ON ip.user_id = u.id
     LEFT JOIN (
       SELECT user_id, COUNT(*)::int AS n FROM instructor_categories GROUP BY user_id
     ) cat ON cat.user_id = u.id
     LEFT JOIN (
       SELECT user_id, COUNT(*)::int AS n FROM instructor_delivery_formats GROUP BY user_id
     ) fmt ON fmt.user_id = u.id
     WHERE u.role = 'instructor'
       AND COALESCE(u.is_active, TRUE) = TRUE
       AND u.deleted_at IS NULL
       AND u.email IS NOT NULL
       AND TRIM(u.email) <> ''
       AND u.created_at < NOW() - ${MIN_AGE}
       AND COALESCE(ip.complete_profile_email_count, 0) < $1
       AND (
         ip.complete_profile_email_sent_at IS NULL
         OR ip.complete_profile_email_sent_at < NOW() - ${RESEND_AFTER}
       )`,
    [MAX_SENDS],
  );

  let sent = 0;
  let skippedComplete = 0;
  let failed = 0;

  for (const row of rows) {
    if (isSearchable(row)) {
      skippedComplete += 1;
      continue;
    }
    const to = String(row.email || '').trim();
    if (!to) continue;

    try {
      const r = await sendCompleteProfileEmail({
        to,
        locale: normalizeLocale(row.locale),
        fullName: row.full_name,
      });
      if (!r?.ok) {
        failed += 1;
        if (!r?.skipped) {
          console.error('instructor complete-profile email failed', to, r?.error || r?.reason);
        }
        continue;
      }

      await db.query(
        `UPDATE instructor_profiles
         SET complete_profile_email_sent_at = NOW(),
             complete_profile_email_count = COALESCE(complete_profile_email_count, 0) + 1
         WHERE user_id = $1`,
        [row.id],
      );

      await db
        .query(
          `INSERT INTO notifications (user_id, title, body, type, is_read, meta)
           VALUES ($1, $2, $3, 'instructor_complete_profile', FALSE, $4::jsonb)`,
          [
            row.id,
            r.subject,
            r.text.slice(0, 1500),
            JSON.stringify({ kind: 'instructor_complete_profile', lang: r.lang }),
          ],
        )
        .catch((e) => console.error('instructor complete-profile notify insert', e.message));

      sent += 1;
    } catch (e) {
      failed += 1;
      console.error('instructor complete-profile reminder', row.id, e.message);
    }
  }

  return { scanned: rows.length, sent, skippedComplete, failed };
}

module.exports = { runInstructorCompleteProfileReminders, isSearchable, MAX_SENDS };
