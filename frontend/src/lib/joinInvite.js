/** WhatsApp üçün hazır dəvət mətni */
export function buildWhatsAppInviteMessage(invitationLink) {
  const link = String(invitationLink || '').trim()
  return `Salam! Qrupa qoşulmaq üçün bu linkə toxunun (kod yazmağa ehtiyac yoxdur):\n${link}`
}

export function groupInvitationLink(group) {
  if (group?.invitation_link) return String(group.invitation_link)
  const code = group?.invitation_code || group?.join_code
  if (!code) return ''
  return `${window.location.origin}/join/${encodeURIComponent(String(code))}`
}

/** Join kodu, tam URL və ya /join/CODE path-indən kod çıxarır. */
export function parseJoinInviteInput(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''

  const normalize = (code) =>
    String(code || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '')

  try {
    if (/^https?:\/\//i.test(s)) {
      const u = new URL(s)
      const m = u.pathname.match(/\/join\/([^/]+)/i)
      if (m?.[1]) return normalize(decodeURIComponent(m[1]))
    }
  } catch {
    /* ignore */
  }

  const pathMatch = s.match(/\/join\/([^/?#\s]+)/i)
  if (pathMatch?.[1]) return normalize(decodeURIComponent(pathMatch[1]))

  const bare = s.split(/[?#\s]/)[0].replace(/^.*\//, '')
  return normalize(bare)
}
