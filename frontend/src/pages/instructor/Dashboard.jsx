import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
import KpiCard from '../../components/common/KpiCard'
import useAuthStore from '../../hooks/useAuth'
import useUiStore from '../../hooks/useUi'
import { useToast } from '../../components/common/Toast'
import { writeCache } from '../../lib/cache'
import { BILLING_STATUS_QUERY_KEY, useBillingStatus } from '../../hooks/useBillingStatus'

const DEFAULT_DASH = {
  income_this_month: 0,
  income_last_month: 0,
  total_earnings_all: 0,
  pending_monthly_total: 0,
  active_enrollments: 0,
  exam_avg_pct: null,
  income_delta_pct: 0,
  total_income_flow_delta_pct: 0,
  enrollment_growth_delta_pct: 0,
  exam_trend_delta_pct: 0,
  spark_income_months: [],
  spark_enrollment_months: [],
  spark_exam_months: [],
}

export default function InstructorDashboard() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { theme } = useUiStore()
  const [students, setStudents] = useState([])
  const [examStats, setExamStats] = useState([])
  const [dash, setDash] = useState({ ...DEFAULT_DASH })
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  // Quick notification module
  const [quickOpen, setQuickOpen] = useState(false)
  const [quickMessage, setQuickMessage] = useState('')
  const [quickSelectedIds, setQuickSelectedIds] = useState([])
  const [quickMethod, setQuickMethod] = useState('internal') // internal | sms
  const [quickBusy, setQuickBusy] = useState(false)
  const [smsProfile, setSmsProfile] = useState(null)
  const [smsProfileLoading, setSmsProfileLoading] = useState(false)
  const queryClient = useQueryClient()
  const billingQ = useBillingStatus()
  const billing = billingQ.data || null
  const blocked = Boolean(billing?.should_block)

  const [onboardOpen, setOnboardOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.get('/students').catch(() => ({ students: [] })),
      api.get('/exams/student-progress').catch(() => ({ stats: [] })),
      api
        .get('/teacher/dashboard-stats')
        .catch(() => ({ stats: { ...DEFAULT_DASH } })),
      api.get('/students/instructor/my-lessons').catch(() => ({ lessons: [] })),
    ])
      .then(([studentsRes, examsRes, dashRes, lessonsRes]) => {
        if (cancelled) return
        const nextStudents = studentsRes.students || []
        setStudents(nextStudents)
        setExamStats(examsRes.stats || [])
        setDash({ ...DEFAULT_DASH, ...(dashRes.stats || {}) })
        // Pre-fetch: tələbələr və cədvəl keşi (60s TTL üçün yazılır)
        writeCache('instructor_students_v1', { students: nextStudents })
        const nextLessons = Array.isArray(lessonsRes.lessons) ? lessonsRes.lessons : []
        writeCache('instructor_schedule_lessons_v2', { lessons: nextLessons })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (loading) return
    try {
      const flag = localStorage.getItem('mx_onboard_add_student_v1') === '1'
      if (!flag) return
      if (!Array.isArray(students) || students.length > 0) {
        localStorage.removeItem('mx_onboard_add_student_v1')
        return
      }
      setOnboardOpen(true)
    } catch {
      // ignore
    }
  }, [loading, students])

  useEffect(() => {
    if (!quickOpen) return
    if (smsProfileLoading) return
    if (smsProfile) return

    setSmsProfileLoading(true)
    api
      .get('/notifications/instructor')
      .then((d) => setSmsProfile(d.profile || null))
      .catch(() => setSmsProfile(null))
      .finally(() => setSmsProfileLoading(false))
  }, [quickOpen, smsProfile, smsProfileLoading])

  const smsLimit = Number(smsProfile?.sms_limit ?? 0)
  const smsUsed = Number(smsProfile?.sms_used ?? 0)
  const smsDisabled = smsLimit <= 0 || smsUsed >= smsLimit

  function toggleSelected(id) {
    setQuickSelectedIds((prev) => {
      const s = new Set(prev)
      const key = String(id)
      if (s.has(key)) s.delete(key)
      else s.add(key)
      return [...s]
    })
  }

  function openQuick() {
    setQuickOpen(true)
    setQuickMessage('')
    setQuickSelectedIds([])
    setQuickMethod('internal')
    // smsProfile is fetched by effect (only once)
  }

  async function submitQuickNotification() {
    const msg = String(quickMessage ?? '').trim()
    if (!msg) return toast('Mesaj tələb olunur', 'error')
    if (!quickSelectedIds.length) return toast('Tələbələr seçilməlidir', 'error')

    if (blocked) {
      return toast(billing?.messages?.banner || 'Məhdudiyyətə görə bu əməliyyat deaktivdir', 'error')
    }

    if (quickMethod === 'sms' && smsDisabled) {
      return toast('Limitiniz bitib, artırmaq üçün adminlə əlaqə saxlayın', 'error')
    }

    setQuickBusy(true)
    try {
      const payload = {
        message: msg,
        student_ids: quickSelectedIds,
        method: quickMethod,
      }
      const sentCount = quickSelectedIds.length
      const d = await api.post('/notifications/quick', payload)

      if (quickMethod === 'sms') {
        // Optimistic UI update, then refresh from backend for consistency.
        setSmsProfile((prev) => {
          if (!prev) return prev
          return { ...prev, sms_used: Number(prev.sms_used || 0) + sentCount }
        })
        api
          .get('/notifications/instructor')
          .then((x) => setSmsProfile(x.profile || null))
          .catch(() => {})
      }

      toast(quickMethod === 'sms' ? 'SMS göndərildi' : 'Bildiriş göndərildi', 'success')
      queryClient.invalidateQueries({ queryKey: BILLING_STATUS_QUERY_KEY })
      setQuickOpen(false)
      setQuickMessage('')
      setQuickSelectedIds([])
      // Keep smsProfile; next opening will use same cached value
    } catch (err) {
      toast(err?.message || 'Göndərilmədi', 'error')
    } finally {
      setQuickBusy(false)
    }
  }

  function closeOnboard() {
    setOnboardOpen(false)
    try {
      localStorage.removeItem('mx_onboard_add_student_v1')
    } catch {}
  }

  const examById = Object.fromEntries(
    examStats.map((r) => [String(r.student_id), r])
  )

  const hrs = new Date().getHours()
  const greeting = hrs < 12 ? 'Sabahınız xeyir' : hrs < 18 ? 'Günortanız xeyir' : 'Axşamınız xeyir'
  const moneyFmt = new Intl.NumberFormat('en-US')
  const incomeThisMonthAz = `₼ ${moneyFmt.format(Math.round(Number(dash.income_this_month || 0)))}`
  const totalEarningsAz = `₼ ${moneyFmt.format(Math.round(Number(dash.total_earnings_all || 0)))}`
  const pendingMonthlyAz = `₼ ${moneyFmt.format(Math.round(Number(dash.pending_monthly_total || 0)))}`

  const rosterWithExam = students.filter((s) => examById[String(s.id)]?.exam_avg_score != null)
  const avgScore = rosterWithExam.length
    ? Math.min(
        100,
        Math.round(
          rosterWithExam.reduce((a, s) => a + Number(examById[String(s.id)].exam_avg_score), 0) /
            rosterWithExam.length
        )
      )
    : 0

  const activeStudentKpi =
    dash.active_enrollments != null && Number.isFinite(Number(dash.active_enrollments))
      ? Math.max(0, Math.floor(Number(dash.active_enrollments)))
      : students.length

  const examPctKpi =
    dash.exam_avg_pct != null && Number.isFinite(Number(dash.exam_avg_pct))
      ? Math.min(100, Math.max(0, Math.round(Number(dash.exam_avg_pct))))
      : Math.min(100, Math.max(0, avgScore))

  const sparkEnroll =
    Array.isArray(dash.spark_enrollment_months) && dash.spark_enrollment_months.length >= 2
      ? dash.spark_enrollment_months
      : [activeStudentKpi, activeStudentKpi]

  const sparkIncome =
    Array.isArray(dash.spark_income_months) && dash.spark_income_months.length >= 2
      ? dash.spark_income_months
      : [
          Number(dash.pending_monthly_total || 0),
          Number(dash.income_this_month || 0),
          Number(dash.total_earnings_all || 0),
        ]

  const chartRows = students.slice(0, 10).map((s) => {
    const first = s.full_name?.split(' ')?.[0] || '—'
    const row = examById[String(s.id)]
    const bal =
      row?.exam_avg_score != null
        ? Math.min(100, Math.max(0, Number(row.exam_avg_score)))
        : 0
    const examCount = Math.max(0, Math.floor(Number(row?.exams_taken)))
    return {
      name: first.length > 12 ? `${first.slice(0, 11)}…` : first,
      fullName: String(s.full_name || '—').trim() || '—',
      bal,
      examCount,
    }
  })

  const ExamLineTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null
    const p = payload[0]?.payload
    if (!p) return null
    const n = Number(p.examCount) || 0
    const pct = Math.round(Number(p.bal))
    return (
      <div className="rounded-xl border border-white/10 bg-[#0b0b0b] px-3 py-2 text-xs shadow-lg max-w-[240px]">
        <div className="font-semibold text-white mb-1">{p.fullName || p.name}</div>
        <div className="text-emerald-300">Orta faiz: {pct}%</div>
        <div className="text-gray-400 mt-1 leading-snug">
          {n > 0
            ? `${n} təqdim olunmuş imtahanın ortalamasıdır (Dashboard ümumi göstərici).`
            : 'Hələ təqdim olunmuş imtahan yoxdur — qrafikdə 0 göstərilir.'}
        </div>
      </div>
    )
  }

  const sparkFromScores = chartRows.map((r) => r.bal).filter((x) => Number.isFinite(Number(x)))

  const sparkExamMonths =
    Array.isArray(dash.spark_exam_months) && dash.spark_exam_months.length >= 2
      ? dash.spark_exam_months
      : sparkFromScores.length >= 2
        ? sparkFromScores
        : [examPctKpi, examPctKpi]

  const topSorted = [...students].sort((a, b) => {
    const sa = examById[String(a.id)]?.exam_avg_score
    const sb = examById[String(b.id)]?.exam_avg_score
    const na = sa != null ? Number(sa) : -1
    const nb = sb != null ? Number(sb) : -1
    return nb - na
  })

  const axisTick = {
    fill: theme === 'dark' ? '#E5E7EB' : '#1A1D21',
    fontSize: 12,
    fontWeight: 600,
  }
  const axisTickY = {
    fill: theme === 'dark' ? '#E5E7EB' : '#1A1D21',
    fontSize: 11,
    fontWeight: 600,
  }

  return (
    <>
      <Modal open={onboardOpen} onClose={closeOnboard} title="Başlayaq" size="sm">
        <div className="space-y-3">
          <div className="text-sm text-gray-200 font-semibold">İlk tələbəni əlavə et</div>
          <div className="text-xs text-gray-400">
            Telefon təsdiqi tamamlandı. İndi ilk tələbənizi əlavə edə bilərsiniz.
          </div>
          <Button
            className="w-full justify-center py-3"
            onClick={() => {
              closeOnboard()
              navigate('/instructor/students')
            }}
          >
            Tələbə əlavə et
          </Button>
          <Button variant="ghost" className="w-full justify-center py-2" onClick={closeOnboard}>
            Sonra
          </Button>
        </div>
      </Modal>
      <div className="p-4 sm:p-6 min-w-0">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="font-display font-bold text-xl sm:text-2xl break-words">
              {greeting}, {user?.full_name?.split(' ')[0]}! 👋
            </h1>
            <p className="text-gray-400 text-sm mt-1">Bugünün xülasəsi</p>
          </div>

          <div className="sm:shrink-0">
            <Button variant="secondary" size="sm" onClick={openQuick}>
              Sürətli Bildiriş
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <KpiCard
          title="Tələbə"
          to="/instructor/students"
          ariaLabel="Tələbələr səhifəsinə keç"
          value={loading ? '—' : activeStudentKpi}
          icon="🎓"
          secondary="Aktiv tələbə sayı"
          deltaPct={dash.enrollment_growth_delta_pct ?? 0}
          sparkline={sparkEnroll}
        />
        <KpiCard
          title="Orta nəticə (faiz)"
          to="/instructor/analytics"
          ariaLabel="Analitika səhifəsinə keç"
          value={loading ? '—' : `${examPctKpi}%`}
          icon="📊"
          secondary="İmtahan ortalaması"
          deltaPct={dash.exam_trend_delta_pct ?? 0}
          sparkline={sparkExamMonths}
        />
        <KpiCard
          title="Gözlənən ödəniş"
          to="/instructor/payments"
          ariaLabel="Ödənişlər səhifəsinə keç"
          value={loading ? '—' : pendingMonthlyAz}
          icon="⏳"
          secondary="Bu ayın gözlənəni"
          deltaPct={0}
          sparkline={sparkIncome}
        />
        <KpiCard
          title="Ümumi gəlir"
          to="/instructor/payments"
          ariaLabel="Ödənişlər — ümumi gəlir"
          value={loading ? '—' : totalEarningsAz}
          icon="💰"
          secondary="Cəmi (indiyə qədər)"
          deltaPct={dash.total_income_flow_delta_pct ?? 0}
          sparkline={sparkIncome}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-6">
        <KpiCard
          title="Bu ay ödəniş (nağd)"
          to="/instructor/payments"
          ariaLabel="Ödənişlər — bu ayın daxilolmaları"
          value={loading ? '—' : incomeThisMonthAz}
          icon="📅"
          secondary="Nağd daxilolma"
          deltaPct={dash.income_delta_pct ?? 0}
          sparkline={sparkIncome}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
        <div className="lg:col-span-2 min-w-0">
          <Card hover className="p-4 sm:p-5 min-w-0 overflow-hidden">
            <h2 className="font-display font-bold text-base text-token-textMain">Tələbə Proqresi (imtahan)</h2>
            <p className="text-xs text-token-textMuted mt-1 mb-3 leading-relaxed">
              Qrafikdə ilk 10 tələbə: hər biri üçün təqdim olunmuş bütün imtahanlar üzrə orta faiz. Tək imtahanın
              cədvəli və qruplar üçün{' '}
              <Link to="/instructor/analytics" className="text-primary underline-offset-2 hover:underline font-medium">
                Analitika
              </Link>
              .
            </p>
            {students.length ? (
              <div className="w-full overflow-x-auto">
                <div className="min-w-[520px] h-[280px] min-h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="mentorixLine" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#003366" />
                        <stop offset="100%" stopColor="#22e088" />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="name"
                      tick={axisTick}
                      interval={0}
                      angle={-45}
                      textAnchor="end"
                      height={72}
                    />
                    <YAxis tick={axisTickY} domain={[0, 100]} width={36} />
                    <Tooltip content={ExamLineTooltip} cursor={{ stroke: 'rgba(34,224,136,0.35)' }} />
                    <Line
                      type="monotone"
                      dataKey="bal"
                      stroke="url(#mentorixLine)"
                      strokeWidth={3}
                      dot={{ r: 3, fill: '#22e088', stroke: '#003366', strokeWidth: 1 }}
                      activeDot={{ r: 5, fill: '#22e088', stroke: '#003366', strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="h-52 flex items-center justify-center text-token-textMuted">Hələ məlumat yoxdur</div>
            )}
            {students.length > 0 && !rosterWithExam.length && (
              <p className="text-token-textMuted text-xs mt-2">
                Hələ təqdim olunmuş imtahan nəticəsi yoxdur — tələbə imtahanı bitirənə qədər orta bal 0 göstərilir.
              </p>
            )}
          </Card>
        </div>

        <Card hover className="p-4 sm:p-5 min-w-0">
          <h2 className="font-display font-bold text-base text-token-textMain">Top Tələbələr (imtahan)</h2>
          <p className="text-xs text-token-textMuted mt-1 mb-3">
            Sıralama eyni mənbəyə əsasən: təqdim olunmuş imtahanların orta faizi; yanında imtahan sayı.
          </p>
          <div className="space-y-3">
            {topSorted.slice(0, 5).map((s, i) => {
              const ex = examById[String(s.id)]
              const hasScore = ex?.exam_avg_score != null
              const pct = hasScore ? Math.min(100, Math.max(0, Number(ex.exam_avg_score))) : 0
              const taken = Math.max(0, Math.floor(Number(ex?.exams_taken)))
              return (
                <div key={s.enrollment_id || s.id} className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <span className="text-sm font-bold text-token-textMuted w-5 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate text-token-textMain">{s.full_name}</div>
                    <div className="h-1.5 bg-white/5 border border-[color:var(--border-subtle)] rounded-full mt-1 overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: hasScore ? `${pct}%` : '0%' }}
                      />
                    </div>
                    {hasScore && taken > 0 ? (
                      <div className="text-[11px] text-token-textMuted mt-0.5">{taken} imtahanın ortası</div>
                    ) : null}
                  </div>
                  <span className="text-sm font-bold text-token-textMain shrink-0 tabular-nums">
                    {hasScore ? `${Math.round(pct)}%` : '—'}
                  </span>
                </div>
              )
            })}
            {!students.length && (
              <div className="text-center text-token-textMuted text-sm py-8">Hələ tələbə yoxdur</div>
            )}
          </div>
        </Card>
      </div>
      </div>

      <Modal open={quickOpen} onClose={() => setQuickOpen(false)} title="Sürətli Bildiriş" size="xl">
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Mesaj
            </label>
            <textarea
              value={quickMessage}
              onChange={(e) => setQuickMessage(e.target.value)}
              rows={3}
              className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500"
              placeholder="Dərs saatı 15:00-a dəyişdirildi"
            />
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Tələbələr
              </label>
              <div className="text-xs text-gray-500">
                Seçilən: <span className="text-white/80 font-semibold">{quickSelectedIds.length}</span>
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto pr-2">
              {students.length ? (
                <div className="space-y-2">
                  {students.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl border border-indigo-500/10 hover:border-indigo-500/20 transition-all"
                    >
                      <input type="checkbox" checked={quickSelectedIds.includes(String(s.id))} onChange={() => toggleSelected(s.id)} />
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{s.full_name}</div>
                        <div className="text-xs text-gray-500">{s.grade ? `Sinif: ${s.grade}` : '—'}</div>
                      </div>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-6">Tələbələr yüklənməyib</div>
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Göndərmə metodu</div>

            <div className="space-y-3">
              <label className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-indigo-500/10 bg-white/0">
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="radio"
                    value="internal"
                    checked={quickMethod === 'internal'}
                    onChange={() => setQuickMethod('internal')}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white/90">Yalnız Panel Daxili</div>
                    <div className="text-xs text-gray-500">Pulsuz</div>
                  </div>
                </div>
              </label>

              <label
                className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-indigo-500/10 ${
                  smsDisabled ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <input
                    type="radio"
                    value="sms"
                    checked={quickMethod === 'sms'}
                    disabled={smsDisabled}
                    onChange={() => setQuickMethod('sms')}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white/90">SMS olaraq göndər</div>
                    {smsDisabled ? (
                      <div className="text-xs text-amber-300">
                        Limitiniz bitib, artırmaq üçün adminlə əlaqə saxlayın
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500">
                        Qalıq: <span className="text-white/80 font-semibold">{Math.max(0, smsLimit - smsUsed)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setQuickOpen(false)} disabled={quickBusy}>
              Ləğv et
            </Button>
            <Button
              variant="primary"
              loading={quickBusy}
              onClick={submitQuickNotification}
              disabled={quickSelectedIds.length === 0 || !quickMessage.trim()}
            >
              Göndər
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
