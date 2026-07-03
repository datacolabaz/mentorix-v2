function parseCertificateEnabled(raw) {
  return raw === true || raw === 'true' || raw === 1 || raw === '1';
}

function parseCertificatePassPct(raw, fallback = 70) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(1, Math.round(n * 100) / 100));
}

function parseCertificateTemplateId(raw) {
  const s = String(raw || '').trim();
  return s || null;
}

function certificateFieldsFromBody(body = {}) {
  const enabledProvided = Object.prototype.hasOwnProperty.call(body, 'certificate_enabled');
  const passProvided = Object.prototype.hasOwnProperty.call(body, 'certificate_pass_pct');
  const templateProvided = Object.prototype.hasOwnProperty.call(body, 'certificate_template_id');
  return {
    enabledProvided,
    passProvided,
    templateProvided,
    certificate_enabled: enabledProvided ? parseCertificateEnabled(body.certificate_enabled) : undefined,
    certificate_pass_pct: passProvided ? parseCertificatePassPct(body.certificate_pass_pct) : undefined,
    certificate_template_id: templateProvided
      ? parseCertificateTemplateId(body.certificate_template_id)
      : undefined,
  };
}

module.exports = {
  parseCertificateEnabled,
  parseCertificatePassPct,
  parseCertificateTemplateId,
  certificateFieldsFromBody,
};
