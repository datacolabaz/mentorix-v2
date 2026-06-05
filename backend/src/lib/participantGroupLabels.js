const SYSTEM_KIND_EXAM = 'exam_participants';
const SYSTEM_KIND_ASSIGNMENT = 'assignment_participants';

function parseParticipantTitleFromGroupName(name) {
  return String(name || '')
    .replace(/^\[System\]\s*/i, '')
    .replace(/\s+Participants\s*$/i, '')
    .trim();
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

module.exports = {
  SYSTEM_KIND_EXAM,
  SYSTEM_KIND_ASSIGNMENT,
  parseParticipantTitleFromGroupName,
  friendlyParticipantLabel,
  participantKindFromSystemKind,
};
