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
  // Light-mode text uses darker shades; dark theme overrides via [.theme-dark_&]
  if (key === 'reviewed') {
    return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 [.theme-dark_&]:text-emerald-200 [.theme-dark_&]:border-emerald-400/40'
  }
  if (key === 'submitted' || key === 'late') {
    return 'bg-blue-500/15 border-blue-500/30 text-blue-700 [.theme-dark_&]:text-blue-200 [.theme-dark_&]:border-blue-400/35'
  }
  if (key === 'late_rejected') {
    return 'bg-red-500/15 border-red-500/30 text-red-700 [.theme-dark_&]:text-red-200 [.theme-dark_&]:border-red-400/35'
  }
  if (key === 'overdue') {
    return 'bg-amber-500/15 border-amber-500/30 text-amber-800 [.theme-dark_&]:text-amber-100 [.theme-dark_&]:border-amber-400/35'
  }
  return 'bg-indigo-500/15 border-indigo-500/30 text-indigo-700 [.theme-dark_&]:text-indigo-200 [.theme-dark_&]:border-indigo-400/35'
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
