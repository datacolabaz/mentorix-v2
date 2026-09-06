export function mapsDirectionsUrls(lat, lng) {
  if (lat == null || lng == null || lat === '' || lng === '') return null
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null
  const dest = `${la},${ln}`
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`,
    waze: `https://waze.com/ul?ll=${encodeURIComponent(dest)}&navigate=yes`,
  }
}
