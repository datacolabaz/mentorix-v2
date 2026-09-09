import { intlLocale } from './uiLocale'

export function formatOrgDateTime(iso, lang) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(intlLocale(lang), {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(iso)
  }
}

export function orgRoleName(t, roleKey, fallback) {
  if (!roleKey) return fallback || '—'
  return t(`org.roleNames.${roleKey}`, { defaultValue: fallback || roleKey })
}

export function orgAuditAction(t, action) {
  if (!action) return '—'
  return t(`org.auditActions.${action}`, { defaultValue: action })
}

export function orgMemberKind(t, kind) {
  if (!kind) return '—'
  return t(`org.memberKind.${kind}`, { defaultValue: kind })
}

export function orgLifecycleLabel(t, lifecycle) {
  if (!lifecycle) return '—'
  return t(`org.lifecycle.${lifecycle}`, { defaultValue: lifecycle })
}

export function orgAssessmentStatus(t, status) {
  if (!status) return '—'
  return t(`org.assessmentStatus.${status}`, { defaultValue: status })
}
