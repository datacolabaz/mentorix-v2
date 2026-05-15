/** WGS84 məsafə (km) — Haversine */
export function distanceKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function formatDistanceKm(km) {
  if (!Number.isFinite(km)) return '—'
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}

export const BAKU_CENTER = [40.4093, 49.8671]

/** İlk yükləmə / Bakı default bbox */
export const BAKU_BBOX = {
  north: 40.52,
  south: 40.3,
  east: 50.08,
  west: 49.68,
}
