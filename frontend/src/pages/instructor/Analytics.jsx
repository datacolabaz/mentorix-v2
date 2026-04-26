import { useEffect, useMemo, useState } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import useUiStore from '../../hooks/useUi'

const COLORS = ['#e1306c', '#1877f2', '#000', '#3b82f6', '#6366f1']

const MAX_CHART_GROUPS = 7

/** Stable display label for a teaching cohort (subject + group when available). */
function groupLabelFromStudent(s) {
  const grp = (s.track_group_name || '').trim()
  const sub = (s.track_subject_name || '').trim()
  if (sub && grp) return `${sub} · ${grp}`
  if (grp) return grp
  if (sub) return sub
  return 'Digər'
}

function clampPct(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return 0
  return Math.min(100, Math.max(0, x))
}

function weightedPerformanceByStudents(rows) {
  let sum = 0
  let n = 0
  for (const r of rows) {
    const v = Number(r.avg_score)
    if (Number.isFinite(v)) {
      sum += v
      n += 1
    }
  }
  return n ? sum / n : 0
}

function mergeSmallestGroups(rows, max = MAX_CHART_GROUPS) {
  if (rows.length <= max) return rows
  const sorted = [...rows].sort((a, b) => b.students - a.students)
  const head = sorted.slice(0, max - 1)
  const tail = sorted.slice(max - 1)
  const mergedStudents = tail.reduce((acc, r) => acc + r.students, 0)
  const mergedLessons = tail.reduce((acc, r) => acc + r.lessons, 0)
  let perfNum = 0
  let perfDen = 0
  for (const r of tail) {
    if (r.students > 0) {
      perfNum += r.performance * r.students
      perfDen += r.students
    }
  }
  const merged = {
    name: `Digər qruplar (${tail.length})`,
    performance: perfDen ? perfNum / perfDen : 0,
    lessons: mergedLessons,
    students: mergedStudents,
    riskCount: tail.reduce((acc, r) => acc + r.riskCount, 0),
    members: tail.flatMap((r) => r.members),
  }
  return [...head, merged]
}

export default function InstructorAnalytics() {
  const [students, setStudents] = useState([])
  const [exams, setExams] = useState([])
  const [examId, setExamId] = useState('')
  const [examGroups, setExamGroups] = useState([])
  const [selectedGrade, setSelectedGrade] = useState('')
  const [groupResults, setGroupResults] = useState([])
  const [top10, setTop10] = useState([])
  const [examLoading, setExamLoading] = useState(false)
  const [examErr, setExamErr] = useState(null)
  const [selectedCohort, setSelectedCohort] = useState('')

  const theme = useUiStore((s) => s.theme)
  const gridStroke = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.10)'
  const axisTick = theme === 'dark' ? '#94a3b8' : '#64748b'
  const tooltipStyle = {
    background: theme === 'dark' ? 'rgba(11,11,11,0.92)' : 'rgba(255,255,255,0.98)',
    border: theme === 'dark' ? '1px solid rgba(255,255,255,0.10)' : '1px solid rgba(15,23,42,0.12)',
    borderRadius: 12,
    color: theme === 'dark' ? '#fff' : '#0f172a',
    fontSize: 12,
  }

  useEffect(() => {
    api
      .get('/students')
      .then((d) => setStudents(d.students || []))
      .catch(() => setStudents([]))
  }, [])

  useEffect(() => {
    api
      .get('/exams')
      .then((d) => setExams(Array.isArray(d.exams) ? d.exams : []))
      .catch(() => setExams([]))
  }, [])

  /** Raw cohort stats (one row per teaching group label). */
  const cohortRows = useMemo(() => {
    const map = new Map()
    for (const s of students) {
      const name = groupLabelFromStudent(s)
      if (!map.has(name)) {
        map.set(name, {
          name,
          members: [],
          lessons: 0,
          riskCount: 0,
        })
      }
      const row = map.get(name)
      row.members.push(s)
      row.lessons += Number(s.lesson_count) || 0
      const sc = Number(s.avg_score)
      if (!Number.isFinite(sc) || sc < 55) row.riskCount += 1
    }
    return [...map.values()].map((row) => ({
      ...row,
      students: row.members.length,
      performance: weightedPerformanceByStudents(row.members),
    }))
  }, [students])

  /** Chart rows: merged to max 7 for readability. */
  const chartGroupRows = useMemo(() => mergeSmallestGroups(cohortRows, MAX_CHART_GROUPS), [cohortRows])

  const performanceChartData = useMemo(
    () =>
      chartGroupRows.map((r) => ({
        name: r.name,
        performance: Math.round(clampPct(r.performance) * 10) / 10,
        students: r.students,
        riskCount: r.riskCount,
      })),
    [chartGroupRows]
  )

  const lessonsChartData = useMemo(
    () =>
      chartGroupRows.map((r) => ({
        name: r.name,
        lessons: r.lessons,
        students: r.students,
      })),
    [chartGroupRows]
  )

  const overallAvg = useMemo(() => weightedPerformanceByStudents(students), [students])

  const insights = useMemo(() => {
    const lines = []
    if (!cohortRows.length) return lines
    const best = [...cohortRows].sort((a, b) => b.performance - a.performance)[0]
    if (best && best.students > 0) {
      lines.push({
        key: 'best',
        text: `Ən yüksək orta bal: ${best.name} (${Math.round(clampPct(best.performance))}%).`,
      })
    }
    if (Number.isFinite(overallAvg) && overallAvg > 0) {
      const below = cohortRows.filter(
        (g) => g.students >= 2 && clampPct(g.performance) < clampPct(overallAvg) - 5
      )
      if (below.length) {
        lines.push({
          key: 'below',
          text: `${below.length} qrup ümumi ortadan aşağıdır (ümumi orta ~${Math.round(clampPct(overallAvg))}%).`,
        })
      }
    }
    const risky = cohortRows.filter((g) => g.riskCount >= 2)
    if (risky.length) {
      lines.push({
        key: 'risk',
        text: `${risky.length} qrupda aşağı bal və ya bal məlumatı olmayan tələbə sayı yüksəkdir.`,
      })
    }
    return lines
  }, [cohortRows, overallAvg])

  useEffect(() => {
    if (!cohortRows.length) {
      setSelectedCohort('')
      return
    }
    setSelectedCohort((prev) => {
      if (prev && cohortRows.some((r) => r.name === prev)) return prev
      const sorted = [...cohortRows].sort((a, b) => b.students - a.students)
      return sorted[0]?.name || ''
    })
  }, [cohortRows])

  const rankedInCohort = useMemo(() => {
    const row = cohortRows.find((r) => r.name === selectedCohort)
    if (!row) return []
    return [...row.members].sort((a, b) => Number(b.avg_score || 0) - Number(a.avg_score || 0))
  }, [cohortRows, selectedCohort])

  const referralData = students.reduce((acc, s) => {
    const src = s.referral_source || 'Digər'
    acc[src] = (acc[src] || 0) + 1
    return acc
  }, {})

  const pieData = Object.entries(referralData).map(([name, value]) => ({ name, value }))

  const loadExamAnalytics = async (id, grade = null) => {
    if (!id) return
    setExamErr(null)
    setExamLoading(true)
    try {
      const [g, t, r] = await Promise.all([
        api.get(`/exams/${encodeURIComponent(id)}/groups`),
        api.get(`/exams/${encodeURIComponent(id)}/top10`),
        api.get(`/exams/${encodeURIComponent(id)}/results${grade ? `?grade=${encodeURIComponent(grade)}` : ''}`),
      ])
      const gr = Array.isArray(g.groups) ? g.groups : []
      setExamGroups(gr)
      setTop10(Array.isArray(t.top10) ? t.top10 : [])
      setGroupResults(Array.isArray(r.results) ? r.results : [])
    } catch (e) {
      setExamErr(e?.message || 'Yüklənmədi')
      setExamGroups([])
      setTop10([])
      setGroupResults([])
    } finally {
      setExamLoading(false)
    }
  }

  const gradeOptions = useMemo(() => {
    const arr = examGroups.map((g) => g.grade).filter(Boolean)
    return arr
  }, [examGroups])

  return (
    <div className="p-6 min-w-0 space-y-4">
      <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain mb-2">Analitika</h1>
      <p className="text-sm text-token-textMuted max-w-3xl">
        Qruplar üzrə cəmləşdirilmiş göstəricilər — qərar qəbul etmək üçün oxunaqlıdır. Tələbə səviyyəsində müqayisə yalnız
        aşağıdakı reytinq siyahısında göstərilir.
      </p>

      {/* TOP — group performance */}
      <Card hover className="p-4 sm:p-5 min-w-0 overflow-hidden">
        <h2 className="font-display font-bold text-base mb-1 text-token-textMain">Qrup performansı</h2>
        <p className="text-xs text-token-textMuted mb-4">X: tədris qrupu · Y: orta bal (%)</p>
        {!performanceChartData.length ? (
          <div className="h-52 flex items-center justify-center text-token-textMuted text-sm">Məlumat yoxdur</div>
        ) : (
          <div className="w-full h-[280px] min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceChartData} margin={{ top: 12, right: 12, left: 4, bottom: 64 }}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: axisTick, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-32}
                  textAnchor="end"
                  height={70}
                />
                <YAxis
                  tick={{ fill: axisTick, fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  width={36}
                  tickFormatter={(v) => `${v}%`}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(34,224,136,0.08)' }}
                  contentStyle={tooltipStyle}
                  formatter={(value, name, props) => {
                    if (name === 'performance') return [`${value}%`, 'Orta bal']
                    return [value, name]
                  }}
                  labelFormatter={(label) => String(label)}
                />
                <Bar dataKey="performance" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Orta bal" maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* MIDDLE — group lesson distribution */}
      <Card hover className="p-4 sm:p-5 min-w-0 overflow-hidden">
        <h2 className="font-display font-bold text-base mb-1 text-token-textMain">Qrup üzrə dərs paylanması</h2>
        <p className="text-xs text-token-textMuted mb-4">Hər qrupdakı tələbələrin ümumi dərs sayı cəmi</p>
        {!lessonsChartData.length ? (
          <div className="h-52 flex items-center justify-center text-token-textMuted text-sm">Məlumat yoxdur</div>
        ) : (
          <div className="w-full h-[280px] min-h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={lessonsChartData} margin={{ top: 12, right: 12, left: 4, bottom: 64 }}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: axisTick, fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  interval={0}
                  angle={-32}
                  textAnchor="end"
                  height={70}
                />
                <YAxis tick={{ fill: axisTick, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                <Tooltip
                  cursor={{ fill: 'rgba(34,224,136,0.08)' }}
                  contentStyle={tooltipStyle}
                  formatter={(value, name) => (name === 'lessons' ? [value, 'Dərs sayı'] : [value, name])}
                />
                <Bar dataKey="lessons" fill="#10b981" radius={[6, 6, 0, 0]} name="Dərs sayı" maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* BOTTOM — optional insights */}
      {insights.length > 0 && (
        <Card className="p-4 sm:p-5 border border-[color:var(--border-subtle)]">
          <h3 className="text-xs font-semibold text-token-textMuted uppercase tracking-wider mb-2">Qısa çıxarış</h3>
          <ul className="space-y-2 text-sm text-token-textMain">
            {insights.map((item) => (
              <li key={item.key} className="leading-relaxed">
                {item.text}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 min-w-0">
        <Card hover className="p-4 sm:p-5 min-w-0 overflow-hidden">
          <h2 className="font-display font-bold text-base mb-4 text-token-textMain">Yönləndirmə mənbəyi</h2>
          {pieData.length ? (
            <div className="w-full h-[240px] min-h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius="45%"
                    outerRadius="75%"
                    dataKey="value"
                    paddingAngle={2}
                    labelLine={false}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-token-textMuted">Məlumat yoxdur</div>
          )}
        </Card>

        <Card hover className="p-4 sm:p-5 min-w-0 overflow-hidden">
          <h2 className="font-display font-bold text-base mb-1 text-token-textMain">Qrup üzrə tələbə reytinqi</h2>
          <p className="text-xs text-token-textMuted mb-4">Qrafik deyil — seçilmiş qrupda sıralanmış siyahı və bal zolaqları.</p>
          {!cohortRows.length ? (
            <div className="h-40 flex items-center justify-center text-token-textMuted text-sm">Qrup məlumatı yoxdur</div>
          ) : (
            <>
              <label className="block text-xs font-semibold text-token-textMuted uppercase tracking-wider mb-2">Qrup</label>
              <select
                className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard px-3 py-2.5 text-sm text-token-textMain outline-none focus:ring-2 focus:ring-primary/25"
                value={selectedCohort}
                onChange={(e) => setSelectedCohort(e.target.value)}
              >
                {[...cohortRows]
                  .sort((a, b) => a.name.localeCompare(b.name, 'az'))
                  .map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name} ({r.students})
                    </option>
                  ))}
              </select>
              <div className="mt-4 space-y-3 max-h-[320px] overflow-y-auto pr-1">
                {rankedInCohort.map((s, idx) => {
                  const pct = clampPct(s.avg_score)
                  return (
                    <div
                      key={s.id || `${selectedCohort}-${idx}`}
                      className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain/50 px-3 py-2.5"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-sm font-semibold text-token-textMain truncate">
                          {idx + 1}. {s.full_name || '—'}
                        </span>
                        <span className="text-xs font-mono tabular-nums text-token-textMuted shrink-0">
                          {Number.isFinite(Number(s.avg_score)) ? `${Math.round(pct)}%` : '—'}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-[width] duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </Card>
      </div>

      <Card hover className="p-4 sm:p-5 min-w-0 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
          <div className="min-w-0">
            <h2 className="font-display font-bold text-base text-token-textMain">İmtahan nəticələri</h2>
            <p className="text-xs text-token-textMuted mt-1">Qruplara görə baxış və ümumi Top 10.</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadExamAnalytics(examId, selectedGrade || null)}
            disabled={!examId || examLoading}
          >
            Yenilə
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">İmtahan</label>
            <select
              className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={examId}
              onChange={async (e) => {
                const id = e.target.value
                setExamId(id)
                setSelectedGrade('')
                setExamGroups([])
                setGroupResults([])
                setTop10([])
                if (id) await loadExamAnalytics(id, null)
              }}
            >
              <option value="">— İmtahan seçin —</option>
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title || 'İmtahan'}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Qrup</label>
            <select
              className="w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500"
              value={selectedGrade}
              onChange={async (e) => {
                const g = e.target.value
                setSelectedGrade(g)
                if (examId) await loadExamAnalytics(examId, g || null)
              }}
              disabled={!examId || examLoading}
            >
              <option value="">Ümumi (hamısı)</option>
              {gradeOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>
        </div>

        {examErr && <p className="text-sm text-amber-200/90 mt-3">{examErr}</p>}
        {examLoading && <p className="text-xs text-token-textMuted mt-3">Yüklənir…</p>}

        {examId && !examLoading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ümumi Top 10</p>
              {!top10.length ? (
                <p className="text-sm text-gray-500">Nəticə yoxdur.</p>
              ) : (
                <div className="space-y-2">
                  {top10.map((r) => (
                    <div
                      key={r.student_id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-indigo-500/10 bg-[#13112e]/60"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {r.rank === 1 ? '🥇 ' : r.rank === 2 ? '🥈 ' : r.rank === 3 ? '🥉 ' : ''}
                          {r.rank}. {r.full_name}
                        </p>
                        <p className="text-[11px] text-gray-500">{r.grade || '—'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-extrabold text-white">
                          {Math.round(Math.min(100, Math.max(0, Number(r.score_pct ?? r.score) || 0)))}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {selectedGrade ? `${selectedGrade} qrupu nəticələri` : 'Nəticələr (hamısı)'}
              </p>
              {!groupResults.length ? (
                <p className="text-sm text-gray-500">Nəticə yoxdur.</p>
              ) : (
                <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                  {groupResults.map((r) => (
                    <div
                      key={r.student_id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-indigo-500/10 bg-[#13112e]/60"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {r.rank === 1 ? '🥇 ' : r.rank === 2 ? '🥈 ' : r.rank === 3 ? '🥉 ' : ''}
                          {r.rank}. {r.full_name}
                        </p>
                        <p className="text-[11px] text-gray-500 font-mono tabular-nums">
                          {Number.isFinite(Number(r.duration_seconds))
                            ? `${Math.round(Number(r.duration_seconds))}s`
                            : '—'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-extrabold text-white">
                          {Math.round(Math.min(100, Math.max(0, Number(r.score_pct ?? r.score) || 0)))}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
