import { useCallback, useEffect, useState } from 'react'
import { addMonths, format, isValid, parseISO, setDate } from 'date-fns'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import useAuthStore from '../../hooks/useAuth'

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

function fmtAzFromDb(dt) {
  if (!dt) return '—'
  const s = String(dt)
  // If backend returns a timestamp without timezone, treat it as Asia/Baku wall time.
  const iso = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s) ? s : `${s.replace(' ', 'T')}+04:00`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('az-AZ', { timeZone: 'Asia/Baku' })
}

function parseYmdLocal(ymd) {
  if (!ymd) return null
  const s = String(ymd).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = parseISO(s)
  return isValid(d) ? d : null
}

function fmtDdMmYyyy(d) {
  if (!d || !isValid(d)) return '—'
  return format(d, 'dd.MM.yyyy')
}

function monthlyBillingDayLine(ymd) {
  const d = parseYmdLocal(ymd)
  if (!d) return null
  const day = d.getDate()
  return `Hər ayın ${day}-də (təkrarlanan)`
}

function nextMonthlyBillingDateText(ymd) {
  const anchor = parseYmdLocal(ymd)
  if (!anchor) return null
  const day = anchor.getDate()
  const today = new Date()
  let candidate = setDate(today, day)
  if (candidate < today) candidate = setDate(addMonths(today, 1), day)
  return fmtDdMmYyyy(candidate)
}

function enrollmentFromStudentProfile(s) {
  if (!s?.enrollment_id) return null
  const lim = billingLimit(s.billing_type)
  const lc = Number(s.lesson_count)
  const lessonCount = Number.isFinite(lc) ? lc : 0
  const mf = s.monthly_fee != null && s.monthly_fee !== '' ? Number(s.monthly_fee) : null
  return {
    id: s.enrollment_id,
    billing_type: s.billing_type,
    lesson_count: lessonCount,
    billing_cycle: s.billing_cycle,
    lesson_weekdays: s.lesson_weekdays,
    lesson_times: s.lesson_times,
    instructor_name: s.instructor_name,
    enrolled_at: s.enrolled_at || s.enrollment_started_at || null,
    payment_start_date_for_display: s.enrollment_start_date || s.payment_start_date || null,
    monthly_fee: Number.isFinite(mf) ? mf : null,
    lesson_limit: lim,
    remaining_lessons: lim != null ? Math.max(0, lim - lessonCount) : null,
    next_lesson_at: null,
    planned_lessons_in_cycle: null,
  }
}

export default function StudentPayments() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [payments, setPayments] = useState([])
  const [enrollment, setEnrollment] = useState(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [loadError, setLoadError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setLoadError(null)
    api
      .get('/payments/my')
      .then(async (d) => {
        setPayments(d.payments || [])
        let en = d.enrollment || null
        if (!en && user?.id) {
          try {
            const sres = await api.get('/students/' + user.id)
            en = enrollmentFromStudentProfile(sres.student)
          } catch {
            // ignore — tələbənin profilində enrollment yoxdursa boş qalır
          }
        }
        setEnrollment(en)
      })
      .catch(async (e) => {
        setPayments([])
        setEnrollment(null)
        setLoadError(e?.message || 'Yüklənmədi')
        if (user?.id) {
          try {
            const sres = await api.get('/students/' + user.id)
            const en = enrollmentFromStudentProfile(sres.student)
            if (en) {
              setEnrollment(en)
              setLoadError(null)
            }
          } catch {
            // ignore
          }
        }
      })
      .finally(() => setLoading(false))
  }, [user?.id])

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

  const enrolledAtText = enrollment?.enrolled_at ? fmtAzFromDb(enrollment.enrolled_at) : null
  const paymentAnchorLine = enrollment?.billing_type === 'monthly' ? monthlyBillingDayLine(enrollment.payment_start_date_for_display) : null
  const nextMonthlyPaymentText =
    enrollment?.billing_type === 'monthly' ? nextMonthlyBillingDateText(enrollment.payment_start_date_for_display) : null

  const lc = enrollment ? Number(enrollment.lesson_count) : NaN
  const lessonCount = Number.isFinite(lc) ? lc : 0
  const progressPct =
    enrollment && limit && limit > 0 ? Math.min(100, Math.max(0, (lessonCount / limit) * 100)) : 0

  const monthlyFeeNum =
    enrollment?.monthly_fee != null && enrollment.monthly_fee !== ''
      ? Number(enrollment.monthly_fee)
      : NaN
  const hasMonthlyFee = Number.isFinite(monthlyFeeNum) && monthlyFeeNum > 0

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full min-w-0">
      <h1 className="font-display font-bold text-2xl text-white mb-2">Ödəniş</h1>
      <p className="text-gray-400 text-sm mb-6">
        Müəlliminiz sizi sistemə əlavə edərkən seçdiyi paket və qeydə alınmış ödənişlər.
      </p>

      {!loading && loadError && (
        <Card className="p-4 mb-4 border border-amber-500/30 bg-amber-500/10 text-amber-100 text-sm">
          Ödənişlər siyahısı yüklənmədi: {loadError}
          {enrollment ? ' Paket məlumatı profildən göstərilir.' : ''}
        </Card>
      )}

      {loading ? (
        <div className="text-gray-500 text-center py-12">Yüklənir…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <Card className="p-5">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tamamlanan Dərs</div>
              <div className="font-display font-extrabold text-3xl text-blue-400">
                {lessonCount}
                {limit ? `/${limit}` : ''}
              </div>
              {limit ? (
                <div className="mt-3">
                  <div className="h-2 bg-[#13112e] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all max-w-full"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </Card>
            <Card className="p-5">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Billing</div>
              <div className="font-display font-bold text-xl text-emerald-400">
                {enrollment?.billing_type === 'monthly' && hasMonthlyFee
                  ? `${monthlyFeeNum.toFixed(2)} ₼ / ay`
                  : BILLING[enrollment?.billing_type] || enrollment?.billing_type || '—'}
              </div>
              {enrollment?.billing_type === 'monthly' && hasMonthlyFee && (
                <p className="text-[11px] text-gray-500 mt-2 leading-snug">Müəllimin qeyd etdiyi aylıq ödəniş məbləği</p>
              )}
            </Card>
            <Card className="p-5">
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Müəllim</div>
              <div className="font-display font-bold text-xl text-yellow-400">{enrollment?.instructor_name || '—'}</div>
            </Card>
          </div>

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
                {enrollment.billing_type === 'monthly' && hasMonthlyFee && (
                  <li>
                    <span className="text-gray-500">Aylıq məbləğ: </span>
                    <span className="text-emerald-300 font-mono tabular-nums">{monthlyFeeNum.toFixed(2)} ₼</span>
                  </li>
                )}
                {enrollment.payment_start_date_for_display && (
                  <li>
                    <span className="text-gray-500">Ödəniş başlanğıcı (tarix): </span>
                    <span className="font-mono text-white/90">
                      {fmtDdMmYyyy(parseYmdLocal(String(enrollment.payment_start_date_for_display).slice(0, 10)))}
                    </span>
                  </li>
                )}
                {enrollment.billing_type === 'monthly' && paymentAnchorLine && (
                  <li>
                    <span className="text-gray-500">Aylıq ödəniş qaydası: </span>
                    <span className="text-white/90">{paymentAnchorLine}</span>
                  </li>
                )}
                {enrollment.billing_type === 'monthly' && nextMonthlyPaymentText && (
                  <li>
                    <span className="text-gray-500">Növbəti ödəniş tarixi (təxmini): </span>
                    <span className="font-mono text-emerald-200">{nextMonthlyPaymentText}</span>
                  </li>
                )}
                {enrolledAtText && (
                  <li>
                    <span className="text-gray-500">Sistemə qeydiyyat: </span>
                    <span className="font-mono text-white/90">{enrolledAtText}</span>
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
                    <span className="font-mono text-indigo-200">{fmtAzFromDb(enrollment.next_lesson_at)}</span>
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
        </>
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
