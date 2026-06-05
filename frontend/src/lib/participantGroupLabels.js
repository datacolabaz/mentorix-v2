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

export function studentMatchesAudienceFilter(s, filter) {
  if (!filter || filter === 'all') return true
  const kind = participantKindFromRow(s)
  if (filter === 'group') return kind === 'group' && !s?.is_participant_group_row
  if (filter === 'exam') return kind === 'exam'
  if (filter === 'task') return kind === 'task'
  return true
}

export function isSystemTeachingSubjectName(name) {
  return /^\[System\]/i.test(String(name || '').trim())
}
