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

function sourceName(trackRef) {
  return String(trackRef?.source || '')
}

export function isScreenShareTrack(trackRef) {
  const source = sourceName(trackRef)
  return source === 'screen_share' || source === 'ScreenShare'
}

export function isCameraTrack(trackRef) {
  const source = sourceName(trackRef)
  return source === 'camera' || source === 'Camera' || source === ''
}

/**
 * When someone shares a tab/desktop, the share becomes the stage and that
 * presenter's camera/placeholder tile is omitted so it does not sit beside
 * the share at equal size (Google Meet-style).
 */
export function splitLiveConferenceTracks(tracks) {
  const list = Array.isArray(tracks) ? tracks : []
  const screenTracks = list.filter((t) => isScreenShareTrack(t))
  const cameraTracks = list.filter((t) => !isScreenShareTrack(t) && isCameraTrack(t))
  const presentingIdentities = [
    ...new Set(screenTracks.map((t) => t?.participant?.identity).filter(Boolean)),
  ]
  const presenting = new Set(presentingIdentities)
  const galleryTracks = cameraTracks.filter((t) => !presenting.has(t?.participant?.identity))
  return {
    screenTracks,
    cameraTracks,
    galleryTracks,
    presentingIdentities,
    hasScreenShare: screenTracks.length > 0,
  }
}
