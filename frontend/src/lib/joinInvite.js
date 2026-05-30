/** WhatsApp üçün hazır dəvət mətni */
export function buildWhatsAppInviteMessage(invitationLink) {
  const link = String(invitationLink || '').trim()
  return `Salam, dərslərimizin idarə olunması üçün bu linkə daxil olub qeydiyyatdan keçin: ${link}`
}

export function groupInvitationLink(group) {
  if (group?.invitation_link) return String(group.invitation_link)
  const code = group?.invitation_code || group?.join_code
  if (!code) return ''
  return `${window.location.origin}/join/${encodeURIComponent(String(code))}`
}
