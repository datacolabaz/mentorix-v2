const { sendTemplatedEmail } = require('./email');
const { frontendPublicUrl } = require('./email/emailConfig');

/** Kept for existing importers; one source of truth for the public frontend URL. */
function frontendBaseUrl() {
  return frontendPublicUrl();
}

/**
 * @param {{ to: string, categoryName: string, examTitle: string, categorySlug: string, examId: string, locale?: string }} opts
 */
async function sendCatalogWaitlistEmail({ to, categoryName, examTitle, categorySlug, examId, locale }) {
  const url = `${frontendBaseUrl()}/sertifikatli-imtahanlar/${encodeURIComponent(categorySlug)}?exam=${encodeURIComponent(examId)}`;
  const r = await sendTemplatedEmail({
    to,
    templateKey: 'catalog_waitlist',
    locale,
    params: { categoryName, examTitle, url },
  });
  if (r.ok) return { ok: true, provider: r.provider, messageId: r.messageId || null };
  if (r.status === 'dry_run') return { ok: false, skipped: true, reason: 'dry_run' };
  if (r.status === 'skipped') return { ok: false, skipped: true, reason: 'smtp_not_configured' };
  return { ok: false, error: r.error || 'Email xətası' };
}

module.exports = { sendCatalogWaitlistEmail, frontendBaseUrl };
