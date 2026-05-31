export const ASSIGNMENT_STATUS_AZ = {
  pending: 'Gözləyir',
  submitted: 'Təslim edilib',
  reviewed: 'Yoxlanılıb',
  late: 'Gecikmiş',
  late_rejected: 'Gecikmə rədd',
  overdue: 'Vaxtı keçib',
}

export function assignmentStatusLabel(status, displayStatus) {
  const key = displayStatus || status
  return ASSIGNMENT_STATUS_AZ[key] || ASSIGNMENT_STATUS_AZ.pending
}

export function assignmentStatusClass(status, displayStatus) {
  const key = displayStatus || status
  if (key === 'reviewed') return 'bg-emerald-500/15 border-emerald-400/40 text-emerald-200'
  if (key === 'submitted' || key === 'late') return 'bg-blue-500/15 border-blue-400/35 text-blue-200'
  if (key === 'late_rejected') return 'bg-red-500/15 border-red-400/35 text-red-200'
  if (key === 'overdue') return 'bg-amber-500/15 border-amber-400/35 text-amber-100'
  return 'bg-indigo-500/15 border-indigo-400/35 text-indigo-200'
}

export function filterTasksByTab(tasks, tab) {
  const list = (Array.isArray(tasks) ? tasks : []).filter(Boolean)
  if (tab === 'active') {
    return list.filter((t) => ['pending', 'overdue'].includes(t.display_status || t.status))
  }
  if (tab === 'completed') {
    return list.filter((t) => ['submitted', 'reviewed', 'late'].includes(t.display_status || t.status))
  }
  if (tab === 'overdue') {
    return list.filter((t) => (t.display_status || t.status) === 'overdue' || t.status === 'late')
  }
  return list
}

export function isPreviewable(url) {
  const s = String(url || '').toLowerCase()
  return (
    s.endsWith('.png') ||
    s.endsWith('.jpg') ||
    s.endsWith('.jpeg') ||
    s.endsWith('.webp') ||
    s.endsWith('.gif') ||
    s.endsWith('.pdf')
  )
}
