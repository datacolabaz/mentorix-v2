/**
 * One HTML/text shell for every email: brand name from config/brand.js (Mentorix today,
 * Resulio via BRAND_NAME), one CTA button with a plain-text fallback link, footer.
 * All interpolated values are escaped here; templates pass plain strings.
 */

const COLORS = Object.freeze({
  text: '#111827',
  muted: '#6b7280',
  subtle: '#9ca3af',
  border: '#e5e7eb',
  accent: '#4f46e5',
  onAccent: '#ffffff',
});

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeHref(url) {
  const s = String(url || '').trim();
  return /^https?:\/\//i.test(s) ? s : '';
}

/**
 * @param {object} p
 * @param {string} p.brandName
 * @param {string} [p.lang]
 * @param {string} [p.eyebrow]       small label above the heading
 * @param {string} [p.heading]
 * @param {string[]} [p.paragraphs]
 * @param {{ label: string, url: string }} [p.cta]
 * @param {string} [p.linkHint]      "If the button does not work: <url>"
 * @param {string[]} [p.footer]      small print lines
 * @param {string} [p.code]          one-time code shown large (verification only)
 * @returns {{ html: string, text: string }}
 */
function renderLayout(p) {
  const paragraphs = (p.paragraphs || []).filter((x) => x != null && String(x).trim() !== '');
  const footer = (p.footer || []).filter(Boolean);
  const ctaUrl = p.cta ? safeHref(p.cta.url) : '';

  const htmlParts = [
    `<div lang="${escapeHtml(p.lang || 'az')}" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;line-height:1.55;max-width:560px;color:${COLORS.text}">`,
  ];
  if (p.eyebrow) {
    htmlParts.push(`<p style="margin:0 0 12px;font-size:13px;color:${COLORS.accent};font-weight:600">${escapeHtml(p.eyebrow)}</p>`);
  }
  if (p.heading) htmlParts.push(`<h2 style="margin:0 0 16px;font-size:20px">${escapeHtml(p.heading)}</h2>`);
  for (const para of paragraphs) {
    htmlParts.push(`<p style="margin:0 0 12px;white-space:pre-line">${escapeHtml(para)}</p>`);
  }
  if (p.code) {
    htmlParts.push(
      `<p style="margin:0 0 16px;font-size:22px;font-weight:bold;letter-spacing:4px">${escapeHtml(p.code)}</p>`,
    );
  }
  if (ctaUrl) {
    htmlParts.push(
      `<p style="margin:20px 0"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:${COLORS.accent};color:${COLORS.onAccent};padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${escapeHtml(p.cta.label)}</a></p>`,
    );
    if (p.linkHint) {
      htmlParts.push(
        `<p style="margin:0 0 12px;font-size:12px;color:${COLORS.muted}">${escapeHtml(p.linkHint)} <a href="${escapeHtml(ctaUrl)}" style="color:${COLORS.muted}">${escapeHtml(ctaUrl)}</a></p>`,
      );
    }
  }
  htmlParts.push(`<hr style="border:none;border-top:1px solid ${COLORS.border};margin:20px 0 12px">`);
  for (const line of footer) {
    htmlParts.push(`<p style="margin:0 0 6px;font-size:12px;color:${COLORS.subtle}">${escapeHtml(line)}</p>`);
  }
  htmlParts.push(`<p style="margin:0;font-size:12px;color:${COLORS.subtle}">${escapeHtml(p.brandName)}</p>`);
  htmlParts.push('</div>');

  const textParts = [];
  if (p.heading) textParts.push(p.heading, '');
  for (const para of paragraphs) textParts.push(para, '');
  if (p.code) textParts.push(p.code, '');
  if (ctaUrl) textParts.push(`${p.cta.label}: ${ctaUrl}`, '');
  if (footer.length) textParts.push('--', ...footer);
  textParts.push(p.brandName);

  return { html: htmlParts.join('\n'), text: textParts.join('\n') };
}

module.exports = { renderLayout, escapeHtml, safeHref, COLORS };
