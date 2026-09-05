function mapAdmission(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    display_name: row.display_name,
    requester_kind: row.requester_kind,
    email: row.email || null,
    requested_at: row.requested_at,
  };
}

function canEnterLiveRoom({ isInstructor, status }) {
  if (isInstructor) return true;
  return String(status || '') === 'approved';
}

module.exports = { mapAdmission, canEnterLiveRoom };
