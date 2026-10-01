export const NOTIFICATION_CATEGORIES = [
  'security',
  'assessment',
  'assignment',
  'material',
  'group',
  'grading',
  'partner',
  'billing',
  'system',
]

const CATEGORY_ICON = {
  security: 'shield',
  assessment: 'exams',
  assignment: 'tasks',
  material: 'materials',
  group: 'groups',
  grading: 'analytics',
  partner: 'briefcase',
  billing: 'payments',
  system: 'notifications',
}

/** NavIcon name for a notification category. */
export function categoryIconName(category) {
  return CATEGORY_ICON[category] || 'notifications'
}

/** `''` for 0, `'99+'` above 99. */
export function badgeLabel(count) {
  const n = Math.max(0, Math.floor(Number(count) || 0))
  if (!n) return ''
  return n > 99 ? '99+' : String(n)
}

export function isHighPriority(priority) {
  return priority === 'CRITICAL' || priority === 'HIGH'
}

/**
 * Title/body in the current UI language when the backend stored an i18n key,
 * otherwise the stored (recipient-locale) text.
 * @param {{ title?: string, body?: string, i18n?: { key: string, params?: object } | null }} n
 * @param {(key: string, opts?: object) => string} t
 */
export function notificationText(n, t) {
  const key = n?.i18n?.key
  if (key && /^[a-z0-9_]+$/.test(key)) {
    const params = n.i18n.params && typeof n.i18n.params === 'object' ? n.i18n.params : {}
    return {
      title: t(`notificationCenter.events.${key}.title`, { ...params, defaultValue: n.title || '' }),
      body: t(`notificationCenter.events.${key}.body`, { ...params, defaultValue: n.body || '' }),
    }
  }
  return { title: n?.title || '', body: n?.body || '' }
}

/** Only same-origin app paths are navigated to. */
export function isSafeInternalHref(href) {
  const h = String(href || '')
  return h.startsWith('/') && !h.startsWith('//') && !h.includes('\\')
}
