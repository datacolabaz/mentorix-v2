/** service_areas API cavabını UI qruplarına ayırır */

export function groupServiceAreas(areas) {
  const list = Array.isArray(areas) ? areas : []
  const popularIds = new Set(list.filter((a) => a.is_popular).map((a) => a.id))
  return {
    popular: list.filter((a) => a.is_popular),
    bakuDistricts: list.filter((a) => a.kind === 'district' && !popularIds.has(a.id)),
    metros: list.filter((a) => a.kind === 'metro' && !popularIds.has(a.id)),
    regions: list.filter((a) => a.kind === 'region' && !popularIds.has(a.id)),
  }
}

export function areaKindLabel(kind) {
  if (kind === 'metro') return 'Metro'
  if (kind === 'region') return 'Rayon'
  return 'Bakı'
}
