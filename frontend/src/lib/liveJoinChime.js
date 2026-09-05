/** Short two-tone ding when a student/guest asks to join or enters the room. */
export function playLiveJoinChime(createContext = defaultAudioContext) {
  try {
    const ctx = createContext()
    if (!ctx) return false
    const now = Number(ctx.currentTime) || 0
    const notes = [
      { freq: 880, at: 0 },
      { freq: 1174.66, at: 0.12 },
    ]
    for (const note of notes) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = note.freq
      const start = now + note.at
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.24)
    }
    return true
  } catch {
    return false
  }
}

function defaultAudioContext() {
  const Ctor = globalThis.AudioContext || globalThis.webkitAudioContext
  if (!Ctor) return null
  return new Ctor()
}

/** First poll only seeds known IDs; later unseen pending rows are "new joins". */
export function newPendingAdmissionIds(seenIds, rows, primed) {
  const ids = []
  const seen = seenIds instanceof Set ? seenIds : new Set()
  for (const row of Array.isArray(rows) ? rows : []) {
    if (!row?.id) continue
    if (primed && !seen.has(row.id)) ids.push(row.id)
  }
  return ids
}
