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

function getWhatsAppConfig() {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = String(process.env.WHATSAPP_API_VERSION || 'v21.0').trim();
  const templateName = String(process.env.WHATSAPP_TEMPLATE_NAME || '').trim() || null;
  const templateLanguage = String(process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en_US').trim();
  const examTemplateName = String(process.env.WHATSAPP_EXAM_TEMPLATE_NAME || '').trim() || templateName;
  return {
    configured: Boolean(token && phoneNumberId),
    token,
    phoneNumberId,
    version,
    templateName,
    templateLanguage,
    examTemplateName,
    /** Prod: template təsdiqlənəndə istənilən nömrəyə gedir; test recipient lazım deyil */
    productionStyle: Boolean(templateName),
  };
}

async function postWhatsAppMessage(payload) {
  const cfg = getWhatsAppConfig();
  if (!cfg.configured) {
    return { success: false, skipped: true, reason: 'whatsapp_not_configured' };
  }

  const to = toWhatsAppRecipient(normalizePhone(payload.to));
  if (!to) return { success: false, error: 'Invalid phone number', channel: 'whatsapp' };

  const url = `https://graph.facebook.com/${cfg.version}/${cfg.phoneNumberId}/messages`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        ...payload.body,
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

/**
 * Sərbəst mətn — yalnız 24 saatlıq «customer service window» və ya Meta test recipient üçün.
 */
async function sendWhatsAppMessage({ phone, message }) {
  return postWhatsAppMessage({
    to: phone,
    body: {
      type: 'text',
      text: { preview_url: false, body: String(message || '').slice(0, 4096) },
    },
  });
}

/**
 * Təsdiqlənmiş şablon — prod-da istənilən tələbə nömrəsinə (recipient siyahısı yox).
 * bodyParameters: ['param1', 'param2', ...] → şablondakı {{1}}, {{2}} ...
 */
async function sendWhatsAppTemplate({ phone, templateName, languageCode, bodyParameters = [] }) {
  const name = String(templateName || '').trim();
  if (!name) return { success: false, error: 'template_name_required' };

  const lang = String(languageCode || 'en_US').trim();
  const params = (bodyParameters || [])
    .map((p) => String(p ?? '').slice(0, 1024))
    .filter((p) => p.length > 0);

  const template = { name, language: { code: lang } };
  if (params.length) {
    template.components = [
      {
        type: 'body',
        parameters: params.map((text) => ({ type: 'text', text })),
      },
    ];
  }

  return postWhatsAppMessage({
    to: phone,
    body: {
      type: 'template',
      template,
    },
  });
}

/**
 * Xarici mesaj: prod-da şablon (WHATSAPP_TEMPLATE_NAME), əks halda sərbəst mətn.
 * templateBodyParams verilsə, birbaşa şablona ötürülür.
 */
async function sendWhatsAppOutbound({ phone, message, templateBodyParams, templateNameOverride }) {
  const cfg = getWhatsAppConfig();
  const tpl = templateNameOverride || cfg.templateName;

  if (tpl) {
    const params =
      Array.isArray(templateBodyParams) && templateBodyParams.length
        ? templateBodyParams
        : [String(message || '').slice(0, 1024)];
    const r = await sendWhatsAppTemplate({
      phone,
      templateName: tpl,
      languageCode: cfg.templateLanguage,
      bodyParameters: params,
    });
    return { ...r, mode: 'template' };
  }

  const r = await sendWhatsAppMessage({ phone, message });
  return { ...r, mode: 'text' };
}

module.exports = {
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
  sendWhatsAppOutbound,
  toWhatsAppRecipient,
  getWhatsAppConfig,
};
