/** True only when discover search subjects (fənnlər / categories) are still missing. */
export function shouldShowDiscoverSubjectsModal(alert) {
  if (!alert) return false
  const missing = Array.isArray(alert.missing) ? alert.missing : []
  return missing.includes('categories')
}

/** Build localized discover-profile banner copy from API missing[] flags. */
export function localizeDiscoverProfileAlert(alert, t, lang = 'az') {
  if (!alert) return null
  const missing = Array.isArray(alert.missing) ? alert.missing : []
  const locale = String(lang || '').toLowerCase()
  const useServerAz = locale.startsWith('az') && !missing.length && alert.message

  const parts = []
  if (missing.includes('categories')) parts.push(t('layout.discover.partCategories'))
  if (missing.includes('map_pin')) parts.push(t('layout.discover.partMapPin'))
  if (missing.includes('delivery_formats')) parts.push(t('layout.discover.partFormats'))

  const focus =
    missing[0] === 'categories' ? t('layout.discover.focusCategories') : t('layout.discover.focusIncomplete')

  const message = useServerAz
    ? alert.message
    : parts.length
      ? t('layout.discover.fillInSettings', { focus, parts: parts.join(', ') })
      : focus

  const addSubject = missing.includes('categories')
  return {
    ...alert,
    message,
    cta: {
      ...(alert.cta || {}),
      label: addSubject ? t('layout.discover.addSubject') : t('layout.discover.completeProfile'),
    },
  }
}
