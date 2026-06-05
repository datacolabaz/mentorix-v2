export function parseParticipantTitleFromGroupName(name) {
  return String(name || '')
    .replace(/^\[System\]\s*/i, '')
    .replace(/\s+Participants\s*$/i, '')
    .trim()
}

export function friendlyParticipantLabel({ system_kind, source_title, group_name }) {
  const title =
    String(source_title || '').trim() ||
    parseParticipantTitleFromGroupName(group_name) ||
    'İştirakçılar'
  if (system_kind === 'assignment_participants') return `${title} (Tapşırıq)`
  if (system_kind === 'exam_participants') return `${title} (İmtahan)`
  return title
}

export function participantKindFromRow(s) {
  if (s?.participant_kind) return s.participant_kind
  const src = String(s?.enrollment_source || s?.membership_source || '').toLowerCase()
  if (src === 'task') return 'task'
  if (src === 'exam') return 'exam'
  if (s?.is_participant_group_row) return 'exam'
  return 'group'
}

export function isLightEnrollmentSource(source) {
  const v = String(source || '').trim().toLowerCase()
  return v === 'exam' || v === 'task'
}

export function studentMatchesAudienceFilter(s, filter) {
  if (!filter || filter === 'all') return true
  if (filter === 'group') {
    return (
      Boolean(s?.is_crm_student) &&
      !s?.is_guest_participant_row &&
      !s?.is_participant_group_row &&
      !s?.is_system_group
    )
  }
  if (filter === 'exam') {
    return (
      s?.is_guest_participant_row === true ||
      s?.participant_kind === 'exam' ||
      (!s?.is_crm_student && isLightEnrollmentSource(s?.enrollment_source) && s?.enrollment_source === 'exam')
    )
  }
  if (filter === 'task') {
    return (
      (s?.is_guest_participant_row === true && s?.participant_kind === 'task') ||
      s?.participant_kind === 'task' ||
      (!s?.is_crm_student && isLightEnrollmentSource(s?.enrollment_source) && s?.enrollment_source === 'task')
    )
  }
  return true
}

export function isSystemTeachingSubjectName(name) {
  return /^\[System\]/i.test(String(name || '').trim())
}

export function isSystemGroupName(name) {
  return /^\[System\]/i.test(String(name || '').trim())
}

export function resolveStudentGroupLabel(s) {
  if (s?.participant_cohort_label) return String(s.participant_cohort_label).trim()
  const raw = String(s?.track_group_name || '').trim()
  if (isSystemGroupName(raw)) {
    const title = parseParticipantTitleFromGroupName(raw)
    return title ? `${title} — Qonaq` : 'Qonaq iştirakçıları'
  }
  return raw || 'Qrup yoxdur'
}

export function resolveStudentSubjectLabel(s) {
  const raw = String(s?.track_subject_name || '').trim()
  if (isSystemTeachingSubjectName(raw) || s?.is_guest_participant_row || s?.is_participant_group_row) {
    if (s?.participant_kind === 'task' || String(s?.enrollment_source || '').toLowerCase() === 'task') {
      return 'Qonaq tapşırıq iştirakçıları'
    }
    if (s?.is_guest_participant_row || s?.is_participant_group_row || isLightEnrollmentSource(s?.enrollment_source)) {
      return 'Qonaq imtahan iştirakçıları'
    }
  }
  return raw || 'Sahəsiz'
}
