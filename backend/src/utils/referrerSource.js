/** UTM / referrer → sabit mənbə adları (admin + partner analitika) */
function resolveReferrerSource({ utm_source, utm_medium, referrer_url, referer_header }) {
  const utm = String(utm_source || '').trim().toLowerCase();
  const medium = String(utm_medium || '').trim().toLowerCase();

  if (utm.includes('google') || medium.includes('google') || utm === 'gclid') return 'google';
  if (utm.includes('instagram') || utm === 'ig') return 'instagram';
  if (utm.includes('facebook') || utm === 'fb' || utm.includes('meta')) return 'facebook';
  if (utm.includes('telegram') || utm === 'tg' || utm === 't.me') return 'telegram';
  if (utm.includes('whatsapp') || utm === 'wa' || utm.includes('wa.me')) return 'whatsapp';

  const ref = String(referrer_url || referer_header || '').trim().toLowerCase();
  if (!ref) return 'direct';

  if (ref.includes('google.') || ref.includes('googleadservices')) return 'google';
  if (ref.includes('instagram.') || ref.includes('l.instagram')) return 'instagram';
  if (ref.includes('facebook.') || ref.includes('fb.com') || ref.includes('m.facebook')) return 'facebook';
  if (ref.includes('t.me') || ref.includes('telegram.')) return 'telegram';
  if (ref.includes('whatsapp.') || ref.includes('wa.me') || ref.includes('api.whatsapp')) return 'whatsapp';

  try {
    const host = new URL(ref).hostname.toLowerCase();
    if (!host) return 'direct';
    if (host.includes('google.')) return 'google';
    if (host.includes('instagram.')) return 'instagram';
    if (host.includes('facebook.') || host === 'fb.com') return 'facebook';
    if (host === 't.me' || host.includes('telegram.')) return 'telegram';
    if (host.includes('whatsapp.') || host === 'wa.me') return 'whatsapp';
    return 'other';
  } catch {
    return 'direct';
  }
}

const SOURCE_LABELS = {
  google: 'Google',
  instagram: 'Instagram',
  facebook: 'Facebook',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  direct: 'Direct',
  other: 'Digər',
};

function labelForSource(key) {
  return SOURCE_LABELS[String(key || '').toLowerCase()] || 'Digər';
}

module.exports = { resolveReferrerSource, labelForSource, SOURCE_LABELS };
