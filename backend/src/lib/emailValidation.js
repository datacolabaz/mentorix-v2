/** Reject obviously fake / dev-only email domains (.local, example.com, etc.) */

const BLOCKED_TLD = new Set(['local', 'localhost', 'invalid', 'test', 'example']);
const BLOCKED_DOMAINS = new Set(['example.com', 'example.org', 'example.net', 'test.com']);

function isValidPublicEmail(raw) {
  const email = String(raw || '').trim().toLowerCase();
  if (!email || email.length > 254) return false;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,63}$/.test(email)) return false;

  const at = email.lastIndexOf('@');
  const domain = email.slice(at + 1);
  if (!domain || domain.includes('..')) return false;
  if (BLOCKED_DOMAINS.has(domain)) return false;
  if (domain.endsWith('.local') || domain.endsWith('.localhost')) return false;

  const tld = domain.split('.').pop();
  if (!tld || BLOCKED_TLD.has(tld)) return false;

  return true;
}

module.exports = { isValidPublicEmail };
