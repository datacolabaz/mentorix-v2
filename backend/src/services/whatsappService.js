const normalizePhone = (phone) => String(phone ?? '').replace(/\D/g, '');

/** WhatsApp Cloud API: 994XXXXXXXXX */
function toWhatsAppRecipient(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('994') && d.length >= 12) return d;
  if (d.startsWith('0') && d.length === 10) return `994${d.slice(1)}`;
  if (!d.startsWith('0') && d.length === 9) return `994${d}`;
  if (d.length >= 10) return d;
  return null;
}

/**
 * Meta WhatsApp Cloud API (WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID).
 * Konfiqurasiya yoxdursa skipped qaytarır — çağıran SMS fallback edə bilər.
 */
async function sendWhatsAppMessage({ phone, message }) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { success: false, skipped: true, reason: 'whatsapp_not_configured' };
  }

  const to = toWhatsAppRecipient(normalizePhone(phone));
  if (!to) return { success: false, error: 'Invalid phone number' };

  const version = String(process.env.WHATSAPP_API_VERSION || 'v21.0').trim();
  const url = `https://graph.facebook.com/${version}/${phoneNumberId}/messages`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: String(message || '').slice(0, 4096) },
      }),
    });

    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }

    if (!res.ok) {
      const errMsg =
        json?.error?.message ||
        json?.error?.error_user_msg ||
        `WhatsApp HTTP ${res.status}`;
      return { success: false, error: errMsg, result: json, channel: 'whatsapp' };
    }

    const msgId = json?.messages?.[0]?.id || null;
    return { success: true, channel: 'whatsapp', messageId: msgId, result: json };
  } catch (err) {
    return { success: false, error: err.message, channel: 'whatsapp' };
  }
}

module.exports = { sendWhatsAppMessage, toWhatsAppRecipient };
