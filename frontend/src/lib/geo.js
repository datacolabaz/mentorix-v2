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

/** Badamdar / mərkəz — icazə rədd ediləndə default */
export const BAKU_CENTER = [40.3628, 49.8056]

/** İlk yükləmə / Bakı default bbox (Badamdar ətrafı) */
export const BAKU_BBOX = {
  north: 40.48,
  south: 40.28,
  east: 49.92,
  west: 49.72,
}

export function bboxFromCenter(lat, lng, radiusKm = 10) {
  const r = Math.min(200, Math.max(0.5, Number(radiusKm) || 10))
  const latDelta = r / 111
  const cosLat = Math.cos((lat * Math.PI) / 180) || 1e-6
  const lngDelta = r / (111 * cosLat)
  return {
    north: Math.min(85, lat + latDelta),
    south: Math.max(-85, lat - latDelta),
    east: Math.min(180, lng + lngDelta),
    west: Math.max(-180, lng - lngDelta),
  }
}
