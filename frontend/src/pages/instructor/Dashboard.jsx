import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
import useAuthStore from '../../hooks/useAuth'
import { useToast } from '../../components/common/Toast'
import { writeCache } from '../../lib/cache'

const StatCard = ({ label, value, icon, color }) => (
  <Card className="p-5">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</div>
        <div className={`font-display font-extrabold text-3xl ${color}`}>{value}</div>
      </div>
      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-2xl">{icon}</div>
    </div>
  </Card>
)

export default function InstructorDashboard() {
  const { user } = useAuthStore()
  const [students, setStudents] = useState([])
  const [examStats, setExamStats] = useState([])
  const [dash, setDash] = useState({
    income_this_month: 0,
    total_earnings_all: 0,
    pending_monthly_total: 0,
  })
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

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.get('/students').catch(() => ({ students: [] })),
      api.get('/exams/student-progress').catch(() => ({ stats: [] })),
      api
        .get('/teacher/dashboard-stats')
        .catch(() => ({ stats: { income_this_month: 0, total_earnings_all: 0, pending_monthly_total: 0 } })),
      api.get('/students/instructor/my-lessons').catch(() => ({ lessons: [] })),
    ])
      .then(([studentsRes, examsRes, dashRes, lessonsRes]) => {
        if (cancelled) return
        const nextStudents = studentsRes.students || []
        setStudents(nextStudents)
        setExamStats(examsRes.stats || [])
        setDash(
          dashRes.stats || { income_this_month: 0, total_earnings_all: 0, pending_monthly_total: 0 }
        )
        // Pre-fetch: tələbələr və cədvəl keşi (60s TTL üçün yazılır)
        writeCache('instructor_students_v1', { students: nextStudents })
        const nextLessons = Array.isArray(lessonsRes.lessons) ? lessonsRes.lessons : []
        writeCache('instructor_schedule_lessons_v1', { lessons: nextLessons })
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

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
    ? Math.round(
        rosterWithExam.reduce((a, s) => a + Number(examById[String(s.id)].exam_avg_score), 0) /
          rosterWithExam.length
      )
    : 0

  const chartRows = students.slice(0, 10).map((s) => {
    const first = s.full_name?.split(' ')?.[0] || '—'
    const row = examById[String(s.id)]
    const bal = row?.exam_avg_score != null ? Number(row.exam_avg_score) : 0
    return { name: first.length > 12 ? `${first.slice(0, 11)}…` : first, bal }
  })

  const topSorted = [...students].sort((a, b) => {
    const sa = examById[String(a.id)]?.exam_avg_score
    const sb = examById[String(b.id)]?.exam_avg_score
    const na = sa != null ? Number(sa) : -1
    const nb = sb != null ? Number(sb) : -1
    return nb - na
  })

  return (
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

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Tələbə" value={loading ? '—' : students.length} icon="🎓" color="text-blue-400" />
        <StatCard label="Orta imtahan balı" value={loading ? '—' : `${avgScore}%`} icon="📊" color="text-emerald-400" />
        <StatCard
          label="Gözlənən (aylıq)"
          value={loading ? '—' : pendingMonthlyAz}
          icon="⏳"
          color="text-amber-300"
        />
        <StatCard label="Ümumi gəlir" value={loading ? '—' : totalEarningsAz} icon="💰" color="text-cyan-400" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
        <StatCard
          label="Bu ay ödəniş (nağd)"
          value={loading ? '—' : incomeThisMonthAz}
          icon="📅"
          color="text-yellow-400"
        />
        <p className="text-xs text-gray-500 self-center sm:col-span-1">
          Gözlənən: aylıq «sonradan» dövr borcu + «əvvəlcədən» balans kəsiri (ankor yalnız dərslərə başlama tarixinin
          günü).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 min-w-0">
        <div className="lg:col-span-2 min-w-0">
          <Card className="p-4 sm:p-5 min-w-0 overflow-hidden">
            <h2 className="font-display font-bold text-base mb-4">Tələbə Proqresi (imtahan)</h2>
            {students.length ? (
              <div className="w-full h-[220px] min-h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={56} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} width={32} />
                    <Tooltip contentStyle={{ background: '#1a1740', border: '1px solid rgba(99,102,241,.3)', borderRadius: 8 }} />
                    <Line type="monotone" dataKey="bal" stroke="#3b82f6" strokeWidth={2.5} dot={{ fill: '#3b82f6' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-52 flex items-center justify-center text-gray-500">Hələ məlumat yoxdur</div>
            )}
            {students.length > 0 && !rosterWithExam.length && (
              <p className="text-gray-500 text-xs mt-2">
                Hələ təqdim olunmuş imtahan nəticəsi yoxdur — tələbə imtahanı bitirənə qədər orta bal 0 göstərilir.
              </p>
            )}
          </Card>
        </div>

        <Card className="p-4 sm:p-5 min-w-0">
          <h2 className="font-display font-bold text-base mb-4">Top Tələbələr (imtahan)</h2>
          <div className="space-y-3">
            {topSorted.slice(0, 5).map((s, i) => {
              const ex = examById[String(s.id)]
              const hasScore = ex?.exam_avg_score != null
              const pct = hasScore ? Number(ex.exam_avg_score) : 0
              return (
                <div key={s.enrollment_id || s.id} className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <span className="text-sm font-bold text-gray-500 w-5 shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.full_name}</div>
                    <div className="h-1.5 bg-[#13112e] rounded-full mt-1">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: hasScore ? `${pct}%` : '0%' }} />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-blue-400 shrink-0 tabular-nums">
                    {hasScore ? `${pct}%` : '—'}
                  </span>
                </div>
              )
            })}
            {!students.length && (
              <div className="text-center text-gray-500 text-sm py-8">Hələ tələbə yoxdur</div>
            )}
          </div>
        </Card>
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
    </div>
  )
}
