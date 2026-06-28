export function groupLibraryShareUrl(groupId) {
  if (!groupId) return ''
  if (typeof window === 'undefined') return `/library/${groupId}`
  return `${window.location.origin}/library/${groupId}`
}

export function materialShareUrl(materialId) {
  if (!materialId) return ''
  if (typeof window === 'undefined') return `/library/material/${materialId}`
  return `${window.location.origin}/library/material/${materialId}`
}

export function materialShareUrlForRow(material) {
  if (!material?.id) return ''
  return materialShareUrl(material.id)
}

export function materialShareLinksForRow(material) {
  const links = []
  if (material?.id) {
    links.push({ label: 'Xarici link', url: materialShareUrl(material.id) })
  }
  if (material?.share_token) {
    links.push({ label: 'Public preview', url: materialPublicShareUrl(material.share_token) })
  }
  if (material?.group_id) {
    links.push({ label: 'Qrup linki', url: groupLibraryShareUrl(material.group_id) })
  }
  return links
}

export function materialPublicShareUrl(shareToken) {
  if (!shareToken) return ''
  if (typeof window === 'undefined') return `/m/${shareToken}`
  return `${window.location.origin}/m/${shareToken}`
}

export function materialPublicFileUrl(shareToken) {
  if (!shareToken) return ''
  const path = `/public/material-preview/${encodeURIComponent(shareToken)}/file`
  if (typeof window === 'undefined') return `/api${path}`
  const base = String(import.meta.env?.VITE_API_URL || '/api').replace(/\/+$/, '')
  if (base.startsWith('http')) return `${base}${path}`
  return `${window.location.origin}${base.startsWith('/') ? base : `/${base}`}${path}`
}
