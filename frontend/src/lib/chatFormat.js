const AZ_MONTHS = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avqust',
  'sentyabr',
  'oktyabr',
  'noyabr',
  'dekabr',
]

function startOfDay(d) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function initials(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function formatChatTime(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('az-AZ', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

export function formatChatDateSeparator(iso, now = new Date()) {
  if (!iso) return ''
  const d = startOfDay(new Date(iso))
  const today = startOfDay(now)
  const diffMs = today.getTime() - d.getTime()
  const diffDays = Math.round(diffMs / 86400000)

  if (diffDays === 0) return 'Bu gün'
  if (diffDays === 1) return 'Dünən'
  const date = new Date(iso)
  return `${date.getDate()} ${AZ_MONTHS[date.getMonth()]}`
}

export function dayKey(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

/** Adjacent messages from the same sender form one visual block. */
export function groupAdjacentMessages(messages) {
  const groups = []
  for (const m of messages || []) {
    const last = groups[groups.length - 1]
    if (last && String(last.sender_id) === String(m.sender_id)) {
      last.messages.push(m)
    } else {
      groups.push({
        sender_id: m.sender_id,
        sender_name: m.sender_name,
        sender_role: m.sender_role,
        messages: [m],
      })
    }
  }
  return groups
}

export function buildChatTimeline(messages) {
  const items = []
  let lastDay = null

  for (const group of groupAdjacentMessages(messages)) {
    const first = group.messages[0]
    const dk = dayKey(first?.created_at)
    if (dk && dk !== lastDay) {
      items.push({ type: 'date', key: `date-${dk}`, label: formatChatDateSeparator(first.created_at) })
      lastDay = dk
    }
    items.push({
      type: 'group',
      key: `grp-${group.messages.map((m) => m.id).join('-')}`,
      ...group,
    })
  }

  return items
}

export function isImageAttachment(type) {
  return String(type || '').toLowerCase().startsWith('image/')
}

export function isPdfAttachment(type) {
  return String(type || '').toLowerCase() === 'application/pdf'
}
