/**
 * In-app bildiriş mətnləri (az/en). Saxlanılan title/body alıcının `users.locale` dilində render olunur;
 * `meta.i18n = { key, params }` də saxlanılır ki, frontend cari dildə yenidən göstərə bilsin
 * (frontend açarları: notificationCenter.events.<key>.title|body).
 * Parametrlərdə gizli məlumat olmamalıdır (cavab açarı, bal, token, şəxsi rəy).
 */

const TEMPLATES = Object.freeze({
  join_request: {
    az: {
      title: 'Yeni qoşulma sorğusu',
      body: '{{studentName}} «{{groupName}}» qrupunuza qoşulmaq istəyir. Təsdiqləyin.',
    },
    en: {
      title: 'New join request',
      body: '{{studentName}} wants to join your group “{{groupName}}”. Please review the request.',
    },
  },
  exam_access_request: {
    az: {
      title: 'İmtahana giriş sorğusu',
      body: '{{studentName}} «{{examTitle}}» imtahanına qoşulmaq istəyir. Təsdiqləyin.',
    },
    en: {
      title: 'Assessment access request',
      body: '{{studentName}} wants to join the assessment “{{examTitle}}”. Please review the request.',
    },
  },
  task_access_request: {
    az: {
      title: 'Tapşırıq giriş sorğusu',
      body: '{{studentName}} «{{assignmentTitle}}» tapşırığına qoşulmaq istəyir. Təsdiqləyin.',
    },
    en: {
      title: 'Assignment access request',
      body: '{{studentName}} wants to join the assignment “{{assignmentTitle}}”. Please review the request.',
    },
  },
  assignment_submitted: {
    az: {
      title: 'Tapşırıq təslim edildi',
      body: '{{studentName}} «{{assignmentTitle}}» tapşırığını təslim etdi.',
    },
    en: {
      title: 'Assignment submitted',
      body: '{{studentName}} submitted the assignment “{{assignmentTitle}}”.',
    },
  },
  open_grading_pending: {
    az: {
      title: 'Açıq sual qiymətləndirməsi',
      body: '{{count}} tələbənin cavabı təsdiqinizi gözləyir — «{{examTitle}}».',
    },
    en: {
      title: 'Open answers awaiting review',
      body: '{{count}} student answers are waiting for your confirmation — “{{examTitle}}”.',
    },
  },
});

function templateLocale(locale) {
  const l = String(locale || '').trim().toLowerCase().slice(0, 2);
  return l === 'en' ? 'en' : 'az';
}

function interpolate(str, params = {}) {
  return String(str).replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = params[k];
    return v == null ? '' : String(v);
  });
}

function hasTemplate(key) {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, key);
}

/** @returns {{ title: string, body: string } | null} */
function renderTemplate(key, locale, params = {}) {
  if (!hasTemplate(key)) return null;
  const t = TEMPLATES[key][templateLocale(locale)] || TEMPLATES[key].az;
  return { title: interpolate(t.title, params), body: interpolate(t.body, params) };
}

module.exports = { TEMPLATES, hasTemplate, renderTemplate, templateLocale, interpolate };
