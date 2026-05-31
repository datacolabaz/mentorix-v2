/** API/cədvəl kənar hallarında null sahə/qrup elementlərini süzür */
export function normalizeTeachingSubjects(raw) {
  return (Array.isArray(raw) ? raw : [])
    .filter((s) => s && s.id != null)
    .map((s) => ({
      ...s,
      name: String(s.name || '').trim() || '—',
      groups: (Array.isArray(s.groups) ? s.groups : [])
        .filter((g) => g && g.id != null)
        .map((g) => ({ ...g, name: String(g.name || '').trim() || '—' })),
    }))
}

export function findSubjectById(subjects, subjectId) {
  const id = String(subjectId || '')
  if (!id) return null
  return (Array.isArray(subjects) ? subjects : []).find((s) => s && String(s.id) === id) || null
}

export function findGroupById(subject, groupId) {
  const id = String(groupId || '')
  if (!id || !subject) return null
  return (Array.isArray(subject.groups) ? subject.groups : []).find(
    (g) => g && String(g.id) === id,
  ) || null
}
