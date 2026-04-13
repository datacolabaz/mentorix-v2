import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'

const WEEKDAYS = [
  { v: 1, short: 'B.e.', full: 'Bazar ertəsi' },
  { v: 2, short: 'Ç.a.', full: 'Çərşənbə axşamı' },
  { v: 3, short: 'Çər.', full: 'Çərşənbə' },
  { v: 4, short: 'C.a.', full: 'Cümə axşamı' },
  { v: 5, short: 'Cümə', full: 'Cümə' },
  { v: 6, short: 'Şən.', full: 'Şənbə' },
  { v: 7, short: 'Baz.', full: 'Bazar' },
]

function normalizeWeekdays(raw) {
  let arr = raw
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw)
    } catch {
      arr = []
    }
  }
  if (!Array.isArray(arr)) return []
  const set = new Set()
  for (const x of arr) {
    const d = parseInt(String(x), 10)
    if (Number.isFinite(d) && d >= 1 && d <= 7) set.add(d)
  }
  return [...set].sort((a, b) => a - b)
}

function fmtTime(t) {
  if (!t) return ''
  const s = typeof t === 'string' ? t : String(t)
  return s.slice(0, 5)
}

export default function StudentSchedule() {
  const [loading, setLoading] = useState(true)
  const [enrollments, setEnrollments] = useState([])
  const [err, setErr] = useState(null)
  const [prepDays, setPrepDays] = useState([])
  const toast = useToast()

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const d = await api.get('/students/my/schedule')
      setEnrollments(Array.isArray(d.enrollments) ? d.enrollments : [])
    } catch (e) {
      setErr(e?.message || 'Yüklənmədi')
      setEnrollments([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const lessonDays = useMemo(() => {
    const set = new Set()
    for (const e of enrollments) {
      for (const d of normalizeWeekdays(e.lesson_weekdays)) set.add(d)
    }
    return [...set].sort((a, b) => a - b)
  }, [enrollments])

  const freeDays = useMemo(() => {
    const l = new Set(lessonDays)
    return WEEKDAYS.map((d) => d.v).filter((x) => !l.has(x))
  }, [lessonDays])

  const togglePrepDay = (v) => {
    setPrepDays((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort((a, b) => a - b)))
  }

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-4xl mx-auto">
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-white">Cədvəlim</h1>
          <p className="text-gray-500 text-sm mt-1">Dərs günləri və hazırlıq üçün boş günlər.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>
          Yenilə
        </Button>
      </div>

      {err && (
        <Card className="p-4 border border-red-500/30 bg-red-500/10 text-red-200 mb-4">
          {err}
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <p className="text-sm font-semibold mb-3">Dərs günlərim</p>
          {loading ? (
            <p className="text-sm text-gray-500">Yüklənir…</p>
          ) : lessonDays.length === 0 ? (
            <p className="text-sm text-gray-500">Aktiv dərs gününüz tapılmadı.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((d) => {
                const active = lessonDays.includes(d.v)
                return (
                  <span
                    key={d.v}
                    className={[
                      'px-3 py-1.5 rounded-xl text-xs font-semibold border',
                      active
                        ? 'bg-indigo-500/20 border-indigo-400/40 text-indigo-200'
                        : 'bg-[#13112e] border-indigo-500/20 text-gray-500',
                    ].join(' ')}
                  >
                    {d.full}
                  </span>
                )
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-sm font-semibold mb-1">Boş günlər (hazırlıq üçün)</p>
          <p className="text-xs text-gray-500 mb-3">İstədiyiniz günləri seçin (yalnız sizdə görünür).</p>

          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => {
              const isFree = freeDays.includes(d.v)
              const selected = prepDays.includes(d.v)
              return (
                <button
                  type="button"
                  key={d.v}
                  disabled={!isFree}
                  onClick={() => togglePrepDay(d.v)}
                  className={[
                    'px-3 py-2 rounded-xl text-xs font-semibold border transition-colors',
                    isFree
                      ? selected
                        ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                        : 'bg-[#13112e] border-indigo-500/20 text-gray-200 hover:border-indigo-400/40'
                      : 'bg-[#13112e] border-indigo-500/10 text-gray-600 opacity-60 cursor-not-allowed',
                  ].join(' ')}
                  title={!isFree ? 'Bu gün dərsiniz var' : 'Hazırlıq günü kimi seç'}
                >
                  {d.full}
                </button>
              )
            })}
          </div>
        </Card>
      </div>

      <Card className="p-5 mt-4">
        <p className="text-sm font-semibold mb-3">Dərs saatım (slot)</p>
        {loading ? (
          <p className="text-sm text-gray-500">Yüklənir…</p>
        ) : enrollments.length === 0 ? (
          <p className="text-sm text-gray-500">Aktiv qeydiyyat tapılmadı.</p>
        ) : (
          <div className="space-y-3">
            {enrollments.map((e) => (
              <div
                key={e.enrollment_id}
                className="p-3 rounded-xl bg-[#13112e] border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{e.instructor_name}</p>
                  <p className="text-xs text-gray-500">Müəllim</p>
                </div>
                <div className="text-sm font-mono text-gray-200">
                  {e.slot_id ? (
                    <>
                      {WEEKDAYS.find((x) => x.v === e.slot_day_of_week)?.short || e.slot_day_of_week} · {fmtTime(e.slot_start_time)}–{fmtTime(e.slot_end_time)}
                    </>
                  ) : (
                    <span className="text-gray-500">Slot təyin olunmayıb</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

