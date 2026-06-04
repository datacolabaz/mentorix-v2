/** Paket üzrə axtarış sıralaması: premium → growth → pro → basic, sonra məsafə */

export function normalizePlanSlug(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
  if (s === 'premium' || s === 'business' || s === 'biznes') return 'premium'
  if (s === 'growth') return 'growth'
  if (s === 'pro') return 'pro'
  return 'basic'
}

export function listingSortKey(plan) {
  const p = normalizePlanSlug(plan)
  if (p === 'premium') return 1
  if (p === 'growth') return 2
  if (p === 'pro') return 3
  return 4
}

export function sortInstructorsForMapListing(list, distanceOf) {
  return [...list].sort((a, b) => {
    const pa = a.listing_priority ?? listingSortKey(a.plan)
    const pb = b.listing_priority ?? listingSortKey(b.plan)
    if (pa !== pb) return pa - pb
    const da = distanceOf(a)
    const db = distanceOf(b)
    if (da !== db) return da - db
    return String(a.full_name || '').localeCompare(String(b.full_name || ''), 'az')
  })
}
