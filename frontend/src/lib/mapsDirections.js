export const WAZE_LIVE_MAP_URL = 'https://www.waze.com/live-map'

function destPair(lat, lng) {
  if (lat == null || lng == null || lat === '' || lng === '') return null
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null
  return `${la},${ln}`
}

export function mapsDirectionsUrls(lat, lng) {
  const dest = destPair(lat, lng)
  if (!dest) return null
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`,
    waze: `https://waze.com/ul?ll=${encodeURIComponent(dest)}&navigate=yes`,
  }
}

/** Xəritədə yeri göstər — naviqasiya başlamır, Waze login tələb etmir. */
export function mapsPlaceUrls(lat, lng) {
  const dest = destPair(lat, lng)
  if (!dest) return null
  const [la, ln] = dest.split(',')
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest)}`,
    waze: `https://www.waze.com/live-map/directions?to=ll.${encodeURIComponent(la)}%2C${encodeURIComponent(ln)}`,
    wazePick: WAZE_LIVE_MAP_URL,
  }
}
