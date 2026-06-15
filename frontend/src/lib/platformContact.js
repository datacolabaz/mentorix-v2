export const DEFAULT_PLATFORM_WHATSAPP_MSISDN = '994553775770'

export function normalizeWhatsAppMsisdn(raw) {
  let d = String(raw || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.startsWith('0')) d = `994${d.slice(1)}`
  else if (!d.startsWith('994') && d.length === 9) d = `994${d}`
  return d
}

export function formatAzMsisdnDisplay(msisdn) {
  const d = normalizeWhatsAppMsisdn(msisdn)
  if (d.length < 12) return d ? `+${d}` : ''
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`
}

export function buildWhatsAppUrl(msisdn) {
  const d = normalizeWhatsAppMsisdn(msisdn)
  return `https://wa.me/${d || DEFAULT_PLATFORM_WHATSAPP_MSISDN}`
}

export function defaultPlatformContact() {
  return {
    whatsapp_msisdn: DEFAULT_PLATFORM_WHATSAPP_MSISDN,
    whatsapp_url: buildWhatsAppUrl(DEFAULT_PLATFORM_WHATSAPP_MSISDN),
    phone_display: formatAzMsisdnDisplay(DEFAULT_PLATFORM_WHATSAPP_MSISDN),
  }
}
