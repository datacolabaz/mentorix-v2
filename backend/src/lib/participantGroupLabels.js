const SYSTEM_KIND_EXAM = 'exam_participants';
const SYSTEM_KIND_ASSIGNMENT = 'assignment_participants';

function parseParticipantTitleFromGroupName(name) {
  return String(name || '')
    .replace(/^\[System\]\s*/i, '')
    .replace(/\s+Participants\s*$/i, '')
    .trim();
}

function displayGroupLabel({
  name,
  is_system,
  system_kind,
  exam_title,
  assignment_title,
} = {}) {
  if (!is_system) return String(name || '').trim() || '—';
  const fromRef =
    String(exam_title || '').trim() || String(assignment_title || '').trim();
  if (fromRef) return fromRef;
  const parsed = parseParticipantTitleFromGroupName(name);
  return parsed || 'İştirakçılar';
}

function friendlyParticipantLabel({ system_kind, source_title, group_name }) {
  const title =
    String(source_title || '').trim() ||
    parseParticipantTitleFromGroupName(group_name) ||
    'İştirakçılar';
  if (system_kind === SYSTEM_KIND_ASSIGNMENT) return `${title} (Tapşırıq)`;
  if (system_kind === SYSTEM_KIND_EXAM) return `${title} (İmtahan)`;
  return title;
}

function participantKindFromSystemKind(system_kind) {
  if (system_kind === SYSTEM_KIND_ASSIGNMENT) return 'task';
  if (system_kind === SYSTEM_KIND_EXAM) return 'exam';
  return null;
}

function guestCohortDisplayFromRow(row) {
  const sourceTitle = row?.exam_title || row?.assignment_title || null;
  const baseTitle =
    String(sourceTitle || '').trim() ||
    friendlyParticipantLabel({ group_name: row?.name || row?.group_name }).replace(
      /\s*\([^)]*\)\s*$/,
      '',
    );
  const kind = participantKindFromSystemKind(row?.system_kind) || 'exam';
  const name =
    kind === 'task' ? `${baseTitle} — Qonaq (Tapşırıq)` : `${baseTitle} — Qonaq`;
  const subject =
    kind === 'task' ? 'Qonaq tapşırıq iştirakçıları' : 'Qonaq imtahan iştirakçıları';
  return { name, subject, participant_kind: kind };
}

/** Admin /classes: sistem iştirakçı qrupunu müəllim UI ilə eyni adlandırma */
function decorateAdminClassRow(row) {
  if (!row || !row.is_system) {
    return {
      id: row.id,
      name: row.name,
      subject: row.subject,
      join_code: row.join_code || null,
      join_code_expires_at: row.join_code_expires_at || null,
      created_at: row.created_at,
      instructor_id: row.instructor_id,
      instructor_name: row.instructor_name,
      instructor_phone: row.instructor_phone,
      student_count: row.student_count ?? 0,
      is_participant_cohort: false,
      is_system: false,
    };
  }
  const guest = guestCohortDisplayFromRow(row);
  return {
    id: row.id,
    name: guest.name,
    subject: guest.subject,
    join_code: null,
    join_code_expires_at: null,
    created_at: row.created_at,
    instructor_id: row.instructor_id,
    instructor_name: row.instructor_name,
    instructor_phone: row.instructor_phone,
    student_count: row.student_count ?? 0,
    is_participant_cohort: true,
    is_system: true,
    participant_kind: guest.participant_kind,
  };
}

module.exports = {
  SYSTEM_KIND_EXAM,
  SYSTEM_KIND_ASSIGNMENT,
  parseParticipantTitleFromGroupName,
  displayGroupLabel,
  friendlyParticipantLabel,
  participantKindFromSystemKind,
  guestCohortDisplayFromRow,
  decorateAdminClassRow,
};
