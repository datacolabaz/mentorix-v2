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
  if (material.group_id) return groupLibraryShareUrl(material.group_id)
  return materialShareUrl(material.id)
}
