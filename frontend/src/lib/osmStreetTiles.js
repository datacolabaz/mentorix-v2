/** Pulsuz küçə xəritəsi — API açarı lazım deyil (Carto dark_all artıq açar tələb edir). */
export const OSM_STREET_TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const OSM_STREET_ATTR = '&copy; OpenStreetMap'

/** OSM əlçatan olmayanda ehtiyat küçə xəritəsi (açar yoxdur). */
export const ESRI_STREET_TILE =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
