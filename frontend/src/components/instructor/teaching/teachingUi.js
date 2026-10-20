import { useCallback, useEffect, useState } from 'react'
import api from '../../../lib/api'
import { formatAzn } from '../../../lib/pricing'

const WEEKDAY_SHORT = { 1: 'B.e.', 2: 'Ç.a.', 3: 'Çər.', 4: 'C.a.', 5: 'Cümə', 6: 'Şən.', 7: 'Baz.' }

/** «8 dərs · 100 ₼» from the group's saved package; null when no package is set. */
export function packageSummary(g) {
  if (!g || g.is_system) return null
  const fee = g.default_package_fee
  if (!g.invite_ready && (fee == null || fee === '')) return null
  const pack = g.default_billing_type === '12_lessons' ? '12 dərs' : g.default_billing_type === 'monthly' ? 'Aylıq' : '8 dərs'
  const n = Number(fee)
  return fee != null && fee !== '' && Number.isFinite(n) ? `${pack} · ${formatAzn(n)} ₼` : pack
}

/** «B.e. 15:00 · Çər. 15:00» from the saved default schedule. */
export function scheduleSummary(g) {
  const days = Array.isArray(g?.default_lesson_weekdays) ? [...g.default_lesson_weekdays].map(Number).sort((a, b) => a - b) : []
  if (!days.length) return null
  const times = g?.default_lesson_times && typeof g.default_lesson_times === 'object' ? g.default_lesson_times : {}
  return days
    .map((d) => {
      const tm = times[d] || times[String(d)]
      return `${WEEKDAY_SHORT[d] || d}${tm ? ` ${String(tm).slice(0, 5)}` : ''}`
    })
    .join(' · ')
}

export function incomeText(n) {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return '0 ₼'
  return `${formatAzn(v)} ₼`
}

/**
 * The teacher's lessons that are on air right now (server-computed `state === 'live'`), keyed by group id.
 * A failed request simply means "no live lesson" — the button then offers scheduling, as before.
 */
export function useLiveLessonsByGroup() {
  const [byGroup, setByGroup] = useState({})
  const load = useCallback(async () => {
    try {
      const d = await api.get('/live-lessons?scope=upcoming&limit=200')
      const list = Array.isArray(d?.lessons) ? d.lessons : Array.isArray(d) ? d : []
      const next = {}
      for (const l of list) {
        if (l?.state === 'live' && l.group_id && !next[l.group_id]) next[l.group_id] = l
      }
      setByGroup(next)
    } catch {
      setByGroup({})
    }
  }, [])
  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), 60000)
    return () => window.clearInterval(id)
  }, [load])
  return byGroup
}

export async function copyToClipboard(text) {
  if (!text) throw new Error('empty')
  if (!navigator?.clipboard?.writeText) throw new Error('unsupported')
  await navigator.clipboard.writeText(String(text))
}
