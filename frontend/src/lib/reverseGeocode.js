/** OpenStreetMap Nominatim — təxmini ünvan (az) */
export async function reverseGeocodeLabel(lat, lng) {
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null

  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('lat', String(la))
    url.searchParams.set('lon', String(ln))
    url.searchParams.set('format', 'json')
    url.searchParams.set('accept-language', 'az')

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const data = await res.json()
    const a = data?.address || {}
    const area =
      a.suburb ||
      a.neighbourhood ||
      a.quarter ||
      a.district ||
      a.road ||
      a.village ||
      ''
    const city = a.city || a.town || a.municipality || a.state || 'Bakı'
    if (area && city) return `${area}, ${city}`
    if (area) return area
    if (city) return city
    return data?.display_name?.split(',').slice(0, 2).join(',') || null
  } catch {
    return null
  }
}
