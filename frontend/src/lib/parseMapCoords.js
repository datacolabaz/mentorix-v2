function asPair(latRaw, lngRaw) {
  const lat = Number(String(latRaw).replace(',', '.'))
  const lng = Number(String(lngRaw).replace(',', '.'))
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat: String(lat), lng: String(lng) }
}

/**
 * Waze / Google koordinatı və ya linkindən lat/lng oxuyur.
 * Login tələb etmir — Live Map-də klikdən kopyalanan "40.4028, 49.8715" kifayətdir.
 */
export function parseMapCoords(input) {
  if (input == null) return null
  let s = String(input).trim()
  if (!s) return null

  try {
    s = decodeURIComponent(s.replace(/\+/g, ' '))
  } catch {
    /* keep raw */
  }

  const wazeLl = s.match(/[?&#]ll=([-\d.]+),([-\d.]+)/i)
  if (wazeLl) return asPair(wazeLl[1], wazeLl[2])

  const wazeToLl = s.match(/to=ll\.([-\d.]+),([-\d.]+)/i)
  if (wazeToLl) return asPair(wazeToLl[1], wazeToLl[2])

  const latlng = s.match(/latlng=([-\d.]+),([-\d.]+)/i)
  if (latlng) return asPair(latlng[1], latlng[2])

  const googleAt = s.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (googleAt) return asPair(googleAt[1], googleAt[2])

  const query = s.match(/[?&](?:q|query|destination)=([-\d.]+),([-\d.]+)/i)
  if (query) return asPair(query[1], query[2])

  const pair = s.match(/(-?\d+(?:\.\d+)?)\s*[,;]\s*(-?\d+(?:\.\d+)?)/)
  if (pair) return asPair(pair[1], pair[2])

  return null
}

export function formatCoordPair(lat, lng) {
  if (lat === '' || lat == null || lng === '' || lng == null) return ''
  const parsed = asPair(lat, lng)
  if (!parsed) return ''
  return `${parsed.lat}, ${parsed.lng}`
}

/** Koordinat, Waze/Google linki və ya yer adı (məs. Dəstəkçi İcma Mərkəzi). */
export function splitPlaceOrCoords(input) {
  const label = String(input ?? '').trim()
  if (!label) return { coords: null, label: '' }
  const coords = parseMapCoords(label)
  if (coords) return { coords, label: '' }
  return { coords: null, label }
}
