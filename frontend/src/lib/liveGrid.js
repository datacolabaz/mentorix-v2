/** Stable column buckets so tiles stay equal 16:9 windows. */
export function liveGridCountAttr(n) {
  const count = Math.max(0, Number(n) || 0)
  if (count <= 1) return '1'
  if (count === 2) return '2'
  if (count <= 4) return '4'
  if (count <= 6) return '6'
  return '9'
}

export function liveTileKey(trackRef) {
  const id = trackRef?.participant?.sid || trackRef?.participant?.identity || 'p'
  const source = trackRef?.source || 'camera'
  return `${id}:${source}`
}
