import { useCallback, useEffect, useState } from 'react'
import { format, isValid, parseISO } from 'date-fns'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import useAuthStore from '../../hooks/useAuth'
import { instructorRoleAz, instructorYourForm } from '../../lib/instructorLabel'

const BILLING = {
  '8_lessons': '8 dərs paketi',
  '12_lessons': '12 dərs paketi',
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
  // 1) Native Date object (Axios/JSON rarely, but keep safe)
  if (dt instanceof Date) {
    return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleString('az-AZ', { timeZone: 'Asia/Baku' })
  }

  const raw = String(dt).trim()
  if (!raw) return '—'

  // 2) Normalize common DB timestamp strings to valid ISO8601
  // Examples we may receive:
  // - "2026-04-20T07:00:00.000Z"
  // - "2026-04-20 07:00:00"
  // - "2026-04-20 07:00:00+00"
  // - "2026-04-20 07:00:00+0000"
  // - "2026-04-20 07:00:00+00:00"
  let s = raw.replace(' ', 'T')

  // Convert "+0000" → "+00:00"
  s = s.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
  // Convert "+00" → "+00:00"
  s = s.replace(/([+-]\d{2})$/, '$1:00')

  const hasTz = /([zZ]|[+-]\d{2}:\d{2})$/.test(s)
  const iso = hasTz ? s : `${s}+04:00` // treat TZ-less timestamps as Asia/Baku wall time

  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return raw
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

/** Müəllimin qeyd etdiyi ödəniş tarixi (tarixçə ilə eyni); yoxdursa qəbul vaxtı */
function primaryPaymentDateLabel(p) {
  const ymd = p.payment_date != null ? String(p.payment_date).slice(0, 10) : ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    return fmtDdMmYyyy(parseYmdLocal(ymd))
  }
  if (p.paid_at) return fmtAzFromDb(p.paid_at)
  return '—'
}

function hasSeparatePaymentDate(p) {
  const ymd = p.payment_date != null ? String(p.payment_date).slice(0, 10) : ''
  return /^\d{4}-\d{2}-\d{2}$/.test(ymd) && Boolean(p.paid_at)
}

/** Bu qeyd növləri tələbə üçün göstərilmir (yalnız müəllim/admin tərəfi) */
function displayNotesForStudent(raw) {
  if (raw == null || String(raw).trim() === '') return ''
  const s = String(raw).trim()
  if (/^\[Başlanğıc balansı\]/i.test(s)) return ''
  if (/^\[Keçmiş ödəniş qeydi\]/i.test(s)) return ''
  if (/^\[Balans düzəlişi\]/i.test(s)) return ''
  return s
}

function enrollmentFromStudentProfile(s) {
  if (!s?.enrollment_id) return null
  const btRaw = s.billing_type ?? s.enrollment_billing_type ?? s.enrollmentBillingType ?? null
  const btStr = btRaw != null ? String(btRaw).trim() : ''
  // Keep parity with backend normalization in /payments/my:
  // if legacy rows have empty billing_type, default to 8_lessons so UI doesn't show "—".
  const btNorm = billingLimit(btStr) ? btStr : btStr === 'monthly' ? 'monthly' : '8_lessons'
  const lim = billingLimit(btNorm)
  const lc = Number(s.lesson_count)
  const lessonCount = Number.isFinite(lc) ? lc : 0
  const calUsed = s.calendar_used_lessons != null ? Number(s.calendar_used_lessons) : NaN
  const calTotal = s.calendar_total_lessons != null ? Number(s.calendar_total_lessons) : NaN
  const hasCal = Number.isFinite(calUsed) && Number.isFinite(calTotal)
  const mf = s.monthly_fee != null && s.monthly_fee !== '' ? Number(s.monthly_fee) : null
  return {
    id: s.enrollment_id,
    billing_type: btNorm,
    lesson_count: lessonCount,
    billing_cycle: s.billing_cycle,
    lesson_weekdays: s.lesson_weekdays,
    lesson_times: s.lesson_times,
    instructor_name: s.instructor_name,
    instructor_public_label: s.instructor_public_label === 'trainer' ? 'trainer' : 'instructor',
    enrolled_at: s.enrolled_at || s.enrollment_started_at || null,
    payment_start_date_for_display: s.enrollment_start_date || null,
    lesson_start_date_for_display: s.enrollment_start_date || null,
    billing_timing: s.billing_timing === 'prepaid' ? 'prepaid' : 'postpaid',
    pre_system_enrollment: Boolean(
      s.enrollment_start_date &&
        s.enrollment_started_at &&
        String(s.enrollment_start_date).slice(0, 10) < String(s.enrollment_started_at).slice(0, 10)
    ),
    monthly_fee: Number.isFinite(mf) ? mf : null,
    lesson_limit: lim,
    countdown_model: hasCal ? 'calendar' : null,
    calendar_used_lessons: hasCal ? calUsed : null,
    calendar_total_lessons: hasCal ? calTotal : null,
    remaining_lessons:
      hasCal ? Math.max(0, calTotal - calUsed) : lim != null ? Math.max(0, lim - lessonCount) : null,
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
  const [partialInfoOpen, setPartialInfoOpen] = useState(false)

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
  const packSize = limit != null ? Number(limit) : null
  const totalCompletedAll =
    enrollment?.total_lessons_completed != null ? Number(enrollment.total_lessons_completed) : null
  const expectedTotal =
    enrollment?.expected_lessons_total != null ? Number(enrollment.expected_lessons_total) : null
  const currentPackNo =
    enrollment?.current_package_number != null
      ? Number(enrollment.current_package_number)
      : packSize && totalCompletedAll != null
        ? Math.floor(totalCompletedAll / packSize) + 1
        : null
  const expectedPackNo =
    enrollment?.current_package_expected != null ? Number(enrollment.current_package_expected) : null
  const completedInCurrentPack =
    enrollment?.lessons_in_current_package != null
      ? Number(enrollment.lessons_in_current_package)
      : totalCompletedAll != null && packSize
        ? totalCompletedAll % packSize
        : null
  const remaining =
    packSize && completedInCurrentPack != null
      ? Math.max(0, packSize - completedInCurrentPack)
      : enrollment && enrollment.remaining_lessons != null
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
  const packStartYmd =
    enrollment?.lesson_start_date_for_display || enrollment?.payment_start_date_for_display || null
  const packStartText = packStartYmd ? fmtDdMmYyyy(parseYmdLocal(String(packStartYmd).slice(0, 10))) : null

  const usedLessons = completedInCurrentPack != null ? completedInCurrentPack : Number(enrollment?.lesson_count || 0)
  const totalLessons = packSize != null ? Number(packSize) : Number(limit || 0)
  const progressPct =
    enrollment && totalLessons > 0 ? Math.min(100, Math.max(0, (usedLessons / totalLessons) * 100)) : 0

  const notifEnabled = enrollment?.notifications_enabled !== false
  const roleNoun = instructorRoleAz(enrollment?.instructor_public_label)
  const roleYour = instructorYourForm(enrollment?.instructor_public_label)
  const lessonPackages = Array.isArray(enrollment?.lesson_packages) ? enrollment.lesson_packages : []
  const paymentsByCycle = Array.isArray(enrollment?.payments_by_cycle) ? enrollment.payments_by_cycle : []
  const payByCycleMap = new Map(paymentsByCycle.map((x) => [Number(x.billing_cycle) || 1, Number(x.total_paid) || 0]))
  const attendancePct = enrollment?.attendance_pct != null ? Number(enrollment.attendance_pct) : null

  const [openPackages, setOpenPackages] = useState(() => new Set())

  function togglePkg(cyc) {
    setOpenPackages((prev) => {
      const next = new Set(prev)
      if (next.has(cyc)) next.delete(cyc)
      else next.add(cyc)
      return next
    })
  }

  function lessonStatusLabel(st) {
    const s = String(st || '').toLowerCase()
    if (s === 'done') return { text: 'İştirak etdi', cls: 'text-emerald-300' }
    if (s === 'absent') return { text: 'Qaib', cls: 'text-rose-300' }
    if (s === 'cancelled') return { text: 'Ləğv edildi', cls: 'text-token-textMuted' }
    return { text: 'Gözlənilir', cls: 'text-token-textMuted' }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto w-full min-w-0">
      <h1 className="font-display font-bold text-2xl text-token-textMain mb-2">Ödəniş</h1>
      <p className="text-token-textMuted text-sm mb-6">
        {roleYour} sizi sistemə əlavə edərkən seçdiyi paket və qeydə alınmış ödənişlər.
      </p>

      {!loading && loadError && (
        <Card className="p-4 mb-4 border border-amber-500/30 bg-amber-500/10 text-amber-100 text-sm">
          Ödənişlər siyahısı yüklənmədi: {loadError}
          {enrollment ? ' Paket məlumatı profildən göstərilir.' : ''}
        </Card>
      )}

      {loading ? (
        <div className="text-token-textMuted text-center py-12">Yüklənir…</div>
      ) : (
        <>
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <Card hover className="p-5 border border-[color:var(--border-subtle)] hover:border-primary/20">
                <div className="text-xs font-semibold text-token-textMuted uppercase tracking-wider mb-2">Bu paketdə</div>
                <div className="font-display font-extrabold text-3xl text-blue-400">
                  {Number.isFinite(usedLessons) ? usedLessons : 0}
                  {Number.isFinite(totalLessons) && totalLessons > 0 ? `/${totalLessons}` : ''}
                </div>
                {Number.isFinite(totalCompletedAll) ? (
                  <div className="text-xs text-token-textMuted mt-2">
                    Ümumi keçilən dərs: <span className="font-mono text-token-textMain">{totalCompletedAll}</span>
                  </div>
                ) : null}
                {Number.isFinite(totalLessons) && totalLessons > 0 ? (
                  <div className="mt-3">
                    <div className="h-2 bg-token-surfaceMain/50 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all max-w-full" style={{ width: `${progressPct}%` }} />
                    </div>
                  </div>
                ) : null}
              </Card>
              <Card hover className="p-5 border border-[color:var(--border-subtle)] hover:border-primary/20">
                <div className="text-xs font-semibold text-token-textMuted uppercase tracking-wider mb-2">Billing</div>
                <div className="font-display font-bold text-xl text-emerald-400">
                  {BILLING[enrollment?.billing_type] || enrollment?.billing_type || '—'}
                </div>
                {Number.isFinite(currentPackNo) ? (
                  <div className="text-xs text-token-textMuted mt-2">
                    Cari paket (real): <span className="font-mono text-token-textMain">#{currentPackNo}</span>
                  </div>
                ) : null}
                {Number.isFinite(expectedPackNo) ? (
                  <div className="text-xs text-token-textMuted mt-1">
                    Plan üzrə paket: <span className="font-mono text-token-textMain">#{expectedPackNo}</span>
                  </div>
                ) : null}
                {Number.isFinite(expectedTotal) ? (
                  <div className="text-xs text-token-textMuted mt-1">
                    Gözlənilən dərs sayı: <span className="font-mono text-token-textMain">{expectedTotal}</span>
                  </div>
                ) : null}
              </Card>
              <Card hover className="p-5 border border-[color:var(--border-subtle)] hover:border-primary/20">
                <div className="text-xs font-semibold text-token-textMuted uppercase tracking-wider mb-2">{roleNoun}</div>
                <div className="font-display font-bold text-xl text-yellow-400">{enrollment?.instructor_name || '—'}</div>
              </Card>
            </div>

            <Card hover className="p-5 border border-[color:var(--border-subtle)] hover:border-primary/20">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h2 className="font-semibold text-token-textMain">Cari paket</h2>
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
                  <ul className="text-sm text-token-textMain space-y-2">
                    <li>
                      <span className="text-token-textMuted">{roleNoun}: </span>
                      {enrollment.instructor_name || '—'}
                    </li>
                    <li>
                      <span className="text-token-textMuted">Paket: </span>
                      {BILLING[enrollment.billing_type] || enrollment.billing_type || '—'}
                    </li>
                    {packStartText && (
                      <li>
                        <span className="text-token-textMuted">Başlanğıc tarixi: </span>
                        <span className="font-mono text-token-textMain">{packStartText}</span>
                      </li>
                    )}
                    {enrolledAtText && (
                      <li>
                        <span className="text-token-textMuted">Sistemdə yaradılıb: </span>
                        <span className="font-mono text-token-textMain">{enrolledAtText}</span>
                      </li>
                    )}
                    {Number.isFinite(currentPackNo) && (
                      <li>
                        <span className="text-token-textMuted">Cari paket (real): </span>
                        <span className="font-mono text-token-textMain">#{currentPackNo}</span>
                      </li>
                    )}
                    {Number.isFinite(expectedPackNo) && (
                      <li>
                        <span className="text-token-textMuted">Plan üzrə paket: </span>
                        <span className="font-mono text-token-textMain">#{expectedPackNo}</span>
                      </li>
                    )}
                    {Number.isFinite(expectedTotal) && (
                      <li>
                        <span className="text-token-textMuted">Gözlənilən dərs sayı: </span>
                        <span className="font-mono text-token-textMain">{expectedTotal}</span>
                      </li>
                    )}
                    {packSize != null && completedInCurrentPack != null && (
                      <li>
                        <span className="text-token-textMuted">Bu paketdə: </span>
                        <span className="font-mono text-token-textMain">
                          {completedInCurrentPack} / {packSize} dərs
                        </span>
                      </li>
                    )}
                    {Number.isFinite(totalCompletedAll) && (
                      <li>
                        <span className="text-token-textMuted">Ümumi keçilən dərs: </span>
                        <span className="font-mono text-token-textMain">{totalCompletedAll}</span>
                      </li>
                    )}
                    {weekdayLine && (
                      <li>
                        <span className="text-token-textMuted">Həftəlik dərs günləri/saatları: </span>
                        <span className="text-token-textMain">{weekdayLine}</span>
                      </li>
                    )}
                    {enrollment.planned_lessons_in_cycle != null && limit != null && (
                      <li>
                        <span className="text-token-textMuted">Cədvəldəki dərs sayı (cari dövr): </span>
                        <span className="font-mono text-token-textMain">
                          {Number(enrollment.planned_lessons_in_cycle || 0)} / {limit}
                        </span>
                      </li>
                    )}
                    {(enrollment.next_lesson_display || enrollment.next_lesson_at) && (
                      <li>
                        <span className="text-token-textMuted">Növbəti dərs: </span>
                        <span className="font-mono text-indigo-200">
                          {enrollment.next_lesson_display
                            ? fmtAzFromDb(enrollment.next_lesson_display)
                            : fmtAzFromDb(enrollment.next_lesson_at)}
                        </span>
                      </li>
                    )}
                    {remaining != null && (
                      <li>
                        <span className="text-token-textMuted">Qalan dərs sayı: </span>
                        <span className="text-emerald-300 font-mono">{remaining}</span>
                      </li>
                    )}
                    <li>
                      <span className="text-token-textMuted">Bildirişlər: </span>
                      <span className={notifEnabled ? 'text-emerald-300 font-semibold' : 'text-token-textMuted font-semibold'}>
                        {notifEnabled ? 'Aktiv' : 'Deaktiv'}
                      </span>
                    </li>
                  </ul>
                ) : (
                  <p className="text-token-textMuted text-sm">Aktiv qeydiyyat tapılmadı.</p>
                )}
            </Card>
          </>
        </>
      )}

      {!loading && historyOpen && (
        <Card hover className="p-5 mt-4 border border-[color:var(--border-subtle)] hover:border-primary/20">
          <h2 className="font-display font-bold text-lg text-token-textMain mb-4">Ödəniş tarixçəsi</h2>
          {enrollment?.pre_system_enrollment && (
            <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 text-sky-100 text-sm px-4 py-3 mb-4 leading-relaxed">
              Bu tələbə sistemin aktivləşdirilməsindən öncə qeydiyyatdan keçmişdir. Ödəniş tarixçəsi sistemdə qeydə
              alınan əməliyyatları göstərir; keçmiş dövr üçün {roleYour.toLowerCase()} əlavə qeyd edə bilər.
            </div>
          )}
          {enrollment && (
            <div className="rounded-xl bg-token-surfaceCard/40 border border-[color:var(--border-subtle)] p-3 text-sm text-token-textMain mb-4">
              <p>
                <span className="text-token-textMuted">Paket ({roleNoun.toLowerCase()} seçimi):</span>{' '}
                <span className="text-token-textMain font-medium">
                  {BILLING[enrollment.billing_type] || enrollment.billing_type || '—'}
                </span>
              </p>
              <p className="mt-1">
                <span className="text-token-textMuted">Qeydə alınmış ödəniş cəmi:</span>{' '}
                <span className="text-emerald-300 font-mono">
                  {Number.isFinite(totalPaid) ? totalPaid.toFixed(2) : '0.00'} ₼
                </span>
              </p>
            </div>
          )}

          {!payments.length ? (
            <div className="text-token-textMuted text-sm py-2 space-y-2">
              <p>Hələ ödəniş qeydi yoxdur. {roleYour} ödəniş əlavə edəndə burada görünəcək.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {payments.map((p) => {
                const noteForStudent = displayNotesForStudent(p.notes)
                return (
                <li
                  key={p.id}
                  className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 hover:bg-token-surfaceCard/55 transition-colors p-3 text-sm"
                >
                  <div className="flex justify-between gap-3 flex-wrap items-start">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-token-textMuted uppercase tracking-wider">Ödəniş tarixi</p>
                      <p className="text-token-textMain font-mono tabular-nums text-sm font-medium mt-0.5">
                        {primaryPaymentDateLabel(p)}
                      </p>
                      {hasSeparatePaymentDate(p) ? (
                        <p className="text-[10px] text-token-textMuted mt-1">
                          Sistemə qeyd: <span className="font-mono text-token-textMuted">{fmtAzFromDb(p.paid_at)}</span>
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-emerald-300 font-semibold tabular-nums">
                        {p.amount != null ? Number(p.amount).toFixed(2) : '—'} {p.currency || 'AZN'}
                      </p>
                      <p
                        className={
                          p.status === 'completed'
                            ? 'text-emerald-400/90 text-xs font-semibold mt-0.5'
                            : 'text-amber-400 text-xs mt-0.5'
                        }
                      >
                        {p.status || '—'}
                      </p>
                    </div>
                  </div>
                  {p.period && <p className="text-xs text-token-textMuted mt-2">Dövr: {p.period}</p>}
                  {p.payment_method && <p className="text-xs text-token-textMuted">Üsul: {p.payment_method}</p>}
                  {noteForStudent ? (
                    <p className="text-xs text-token-textMuted mt-2 leading-relaxed">{noteForStudent}</p>
                  ) : null}
                </li>
                )
              })}
            </ul>
          )}

          {/* Lesson history */}
          <div className="mt-6">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-display font-bold text-lg text-token-textMain">Dərs tarixçəsi</h3>
              {Number.isFinite(attendancePct) ? (
                <span className="text-xs text-token-textMuted">
                  Davamiyyət: <span className="font-mono text-token-textMain">{Math.max(0, Math.min(100, attendancePct))}%</span>
                </span>
              ) : null}
            </div>

            {!lessonPackages.length ? (
              <p className="text-token-textMuted text-sm">Hələ dərs tarixçəsi yoxdur.</p>
            ) : (
              <div className="space-y-2">
                {lessonPackages.map((pkg) => {
                  const cyc = Number(pkg.package_number) || 1
                  const isOpen = openPackages.has(cyc)
                  const start = pkg.start_ymd ? fmtDdMmYyyy(parseYmdLocal(pkg.start_ymd)) : '—'
                  const end = pkg.end_ymd ? fmtDdMmYyyy(parseYmdLocal(pkg.end_ymd)) : '—'
                  const total = Number(pkg.total) || packSize || 0
                  const completed = Number(pkg.completed) || 0
                  const paid = payByCycleMap.get(cyc) || 0
                  const paidLabel = paid > 0.005 ? `Ödəniş: ${paid.toFixed(2)} ₼` : 'Ödəniş: —'
                  const headerRight = completed >= total && total > 0 ? 'Tamamlanıb' : cyc === Number(enrollment?.billing_cycle || 1) ? 'Cari' : ''

                  return (
                    <Card key={cyc} hover className="p-0 overflow-hidden border border-[color:var(--border-subtle)]">
                      <button
                        type="button"
                        onClick={() => togglePkg(cyc)}
                        className="w-full px-4 py-3 flex items-center justify-between gap-3 bg-token-surfaceCard/45 hover:bg-token-surfaceCard/60 transition-colors"
                      >
                        <div className="min-w-0 text-left">
                          <div className="font-semibold text-token-textMain truncate">
                            Paket #{cyc}{headerRight ? ` · ${headerRight}` : ''}
                          </div>
                          <div className="text-xs text-token-textMuted mt-0.5">
                            {start} — {end} · <span className="font-mono">{completed}/{total}</span> dərs · {paidLabel}
                          </div>
                        </div>
                        <div className="text-token-textMuted text-sm font-mono shrink-0">{isOpen ? '▴' : '▾'}</div>
                      </button>

                      {isOpen && (
                        <div className="p-3 bg-token-surfaceMain/40">
                          <ul className="space-y-1.5">
                            {(pkg.lessons || []).map((ls) => {
                              const ymd = ls.ymd ? fmtDdMmYyyy(parseYmdLocal(ls.ymd)) : '—'
                              const st = lessonStatusLabel(ls.status)
                              return (
                                <li
                                  key={`${cyc}:${ls.lesson_number}`}
                                  className="flex items-center justify-between gap-2 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard/40 px-3 py-2 text-sm"
                                >
                                  <span className="text-token-textMain">
                                    Dərs {ls.lesson_number || '—'}: <span className="font-mono">{ymd}</span>
                                  </span>
                                  <span className={`text-xs font-semibold ${st.cls}`}>{st.text}</span>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}
