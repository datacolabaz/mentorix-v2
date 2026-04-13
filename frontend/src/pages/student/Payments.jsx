import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'

const BILLING = {
  '8_lessons': '8 dərs paketi',
  '12_lessons': '12 dərs paketi',
  monthly: 'Aylıq',
}

function billingLimit(type) {
  if (type === '8_lessons') return 8
  if (type === '12_lessons') return 12
  return null
}

const WEEKDAYS = [
  { v: 1, short: 'B.e.' },
  { v: 2, short: 'Ç.a.' },
  { v: 3, short: 'Çər.' },
  { v: 4, short: 'C.a.' },
  { v: 5, short: 'Cümə' },
  { v: 6, short: 'Şən.' },
  { v: 7, short: 'Baz.' },
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

function parseLessonTimes(raw) {
  let obj = raw
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw)
    } catch {
      obj = {}
    }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {}
  return obj
}

export default function StudentPayments() {
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState([])
  const [enrollment, setEnrollment] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    api
      .get('/payments/my')
      .then((d) => {
        setPayments(d.payments || [])
        setEnrollment(d.enrollment || null)
      })
      .catch(() => {
        setPayments([])
        setEnrollment(null)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const limit = enrollment ? (enrollment.lesson_limit ?? billingLimit(enrollment.billing_type)) : null
  const remaining =
    enrollment && enrollment.remaining_lessons != null
      ? Number(enrollment.remaining_lessons)
      : enrollment && limit != null
        ? Math.max(0, Number(limit) - Number(enrollment.lesson_count || 0))
        : null
  const totalPaid = payments
    .filter((p) => p.status === 'completed')
    .reduce((s, p) => s + Number(p.amount || 0), 0)

  const lwd = enrollment ? normalizeWeekdays(enrollment.lesson_weekdays) : []
  const lt = enrollment ? parseLessonTimes(enrollment.lesson_times) : {}
  const weekdayLine =
    lwd.length > 0
      ? lwd
          .map((d) => {
            const t = lt?.[String(d)] ?? lt?.[d]
            const short = WEEKDAYS.find((w) => w.v === d)?.short || d
            return t ? `${short}: ${String(t).slice(0, 5)}` : `${short}: —`
          })
          .join(' · ')
      : null

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full min-w-0">
      <h1 className="font-display font-bold text-2xl text-white mb-2">Ödəniş</h1>
      <p className="text-gray-400 text-sm mb-6">
        Müəlliminiz sizi sistemə əlavə edərkən seçdiyi paket və qeydə alınmış ödənişlər.
      </p>

      {loading ? (
        <div className="text-gray-500 text-center py-12">Yüklənir…</div>
      ) : (
        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold text-white">Cari paket</h2>
            <button
              type="button"
              onClick={() => setHistoryOpen((v) => !v)}
              className="text-sm font-semibold text-blue-400 border border-blue-500/30 rounded-xl px-3 py-1.5 hover:bg-blue-500/10"
              aria-expanded={historyOpen}
            >
              {historyOpen ? 'Tarixçəni gizlət' : 'Ödəniş tarixçəsi'}
            </button>
          </div>
          {enrollment ? (
            <ul className="text-sm text-gray-300 space-y-2">
              <li>
                <span className="text-gray-500">Müəllim: </span>
                {enrollment.instructor_name || '—'}
              </li>
              <li>
                <span className="text-gray-500">Paket: </span>
                {BILLING[enrollment.billing_type] || enrollment.billing_type || '—'}
              </li>
              {enrollment.payment_start_date_for_display && (
                <li>
                  <span className="text-gray-500">Ödəniş başlanğıcı: </span>
                  <span className="font-mono text-white/90">{String(enrollment.payment_start_date_for_display).slice(0, 10)}</span>
                </li>
              )}
              {weekdayLine && (
                <li>
                  <span className="text-gray-500">Həftəlik dərs günləri/saatları: </span>
                  <span className="text-white/90">{weekdayLine}</span>
                </li>
              )}
              {enrollment.planned_lessons_in_cycle != null && limit != null && (
                <li>
                  <span className="text-gray-500">Cədvəldəki dərs sayı (cari dövr): </span>
                  <span className="font-mono text-white/90">
                    {Number(enrollment.planned_lessons_in_cycle || 0)} / {limit}
                  </span>
                </li>
              )}
              {enrollment.next_lesson_at && (
                <li>
                  <span className="text-gray-500">Növbəti dərs: </span>
                  <span className="font-mono text-indigo-200">
                    {new Date(enrollment.next_lesson_at).toLocaleString('az-AZ')}
                  </span>
                </li>
              )}
              <li>
                <span className="text-gray-500">Keçilmiş dərs sayı: </span>
                {enrollment.lesson_count ?? 0}
                {limit != null ? ` / ${limit} (Dövr #${enrollment.billing_cycle || 1})` : ''}
              </li>
              {remaining != null && (
                <li>
                  <span className="text-gray-500">Qalan dərs sayı: </span>
                  <span className="text-emerald-300 font-mono">{remaining}</span>
                </li>
              )}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">Aktiv qeydiyyat tapılmadı.</p>
          )}
        </Card>
      )}

      {!loading && historyOpen && (
        <Card className="p-5 mt-4 border-indigo-500/25">
          <h2 className="font-display font-bold text-lg text-white mb-4">Ödəniş tarixçəsi</h2>
          {enrollment && (
            <div className="rounded-xl bg-[#1a1740] border border-indigo-500/20 p-3 text-sm text-gray-300 mb-4">
              <p>
                <span className="text-gray-500">Paket (müəllim seçimi):</span>{' '}
                <span className="text-white font-medium">
                  {BILLING[enrollment.billing_type] || enrollment.billing_type || '—'}
                </span>
              </p>
              <p className="mt-1">
                <span className="text-gray-500">Qeydə alınmış ödəniş cəmi:</span>{' '}
                <span className="text-emerald-300 font-mono">
                  {Number.isFinite(totalPaid) ? totalPaid.toFixed(2) : '0.00'} ₼
                </span>
              </p>
            </div>
          )}

          {!payments.length ? (
            <p className="text-gray-500 text-sm py-2">
              Hələ ödəniş qeydi yoxdur. Müəlliminiz ödəniş əlavə edəndə burada görünəcək.
            </p>
          ) : (
            <ul className="space-y-2">
              {payments.map((p) => (
                <li
                  key={p.id}
                  className="rounded-xl border border-indigo-500/20 bg-[#0f0c29]/80 p-3 text-sm"
                >
                  <div className="flex justify-between gap-2 flex-wrap">
                    <span className="font-mono text-emerald-300">
                      {p.amount != null ? Number(p.amount).toFixed(2) : '—'} {p.currency || 'AZN'}
                    </span>
                    <span
                      className={
                        p.status === 'completed'
                          ? 'text-emerald-400 text-xs font-semibold'
                          : 'text-amber-400 text-xs'
                      }
                    >
                      {p.status || '—'}
                    </span>
                  </div>
                  {p.period && <p className="text-xs text-gray-500 mt-1">Dövr: {p.period}</p>}
                  {p.payment_method && <p className="text-xs text-gray-500">Üsul: {p.payment_method}</p>}
                  {p.paid_at && (
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(p.paid_at).toLocaleString('az-AZ')}
                    </p>
                  )}
                  {p.notes && <p className="text-xs text-gray-400 mt-1">{p.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  )
}
