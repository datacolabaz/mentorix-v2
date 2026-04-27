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

function safeNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export default function InstructorAnalytics() {
  const [students, setStudents] = useState([])
  const [exams, setExams] = useState([])
  const [examId, setExamId] = useState('')
  const [groups, setGroups] = useState([])
  const [selectedGrade, setSelectedGrade] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [groupResults, setGroupResults] = useState([])
  const [top10, setTop10] = useState([])
  const [examLoading, setExamLoading] = useState(false)
  const [examErr, setExamErr] = useState(null)
  const theme = useUiStore((s) => s.theme)
  const gridStroke = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.10)'

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
      setGroups(gr)
      setTop10(Array.isArray(t.top10) ? t.top10 : [])
      setGroupResults(Array.isArray(r.results) ? r.results : [])
    } catch (e) {
      setExamErr(e?.message || 'Yüklənmədi')
      setGroups([])
      setTop10([])
      setGroupResults([])
    } finally {
      setExamLoading(false)
    }
  }

  const subjectOptions = useMemo(() => {
    const set = new Set()
    for (const s of students) {
      const name = String(s.track_subject_name || '').trim()
      if (name) set.add(name)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [students])

  const groupOptions = useMemo(() => {
    if (!selectedSubject) return []
    const set = new Set()
    for (const s of students) {
      const subj = String(s.track_subject_name || '').trim()
      if (subj !== selectedSubject) continue
      const g = String(s.track_group_name || '').trim()
      if (g) set.add(g)
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [students, selectedSubject])

  const filteredStudents = useMemo(() => {
    let arr = Array.isArray(students) ? students : []
    if (selectedSubject) {
      arr = arr.filter((s) => String(s.track_subject_name || '').trim() === selectedSubject)
    }
    if (selectedGroup) {
      arr = arr.filter((s) => String(s.track_group_name || '').trim() === selectedGroup)
    }
    return arr
  }, [students, selectedSubject, selectedGroup])

  // `/students` can contain multiple rows per student (multiple enrollments).
  // For referral source chart and total counts, use unique students.
  const uniqueStudents = useMemo(() => {
    const map = new Map()
    for (const s of filteredStudents) {
      const id = String(s.id || '').trim()
      if (!id) continue
      if (!map.has(id)) map.set(id, s)
    }
    return Array.from(map.values())
  }, [filteredStudents])

  const referralData = useMemo(() => {
    return uniqueStudents.reduce((acc, s) => {
      const src = String(s.referral_source || '').trim() || 'Digər'
      acc[src] = (acc[src] || 0) + 1
      return acc
    }, {})
  }, [uniqueStudents])

  const pieData = useMemo(() => {
    return Object.entries(referralData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
  }, [referralData])

  const groupedByTrack = useMemo(() => {
    const src = filteredStudents
    /** subject -> group -> students[] */
    const subjMap = new Map()
    for (const s of src) {
      const subject = String(s.track_subject_name || 'Sahəsiz').trim() || 'Sahəsiz'
      const group = String(s.track_group_name || 'Qrup yoxdur').trim() || 'Qrup yoxdur'
      if (!subjMap.has(subject)) subjMap.set(subject, new Map())
      const gMap = subjMap.get(subject)
      if (!gMap.has(group)) gMap.set(group, [])
      gMap.get(group).push(s)
    }

    const subjects = Array.from(subjMap.entries())
      .map(([subject, gMap]) => {
        const groupsArr = Array.from(gMap.entries())
          .map(([group, list]) => {
            const count = list.length
            const avgScore =
              count > 0
                ? list.reduce((acc, x) => acc + safeNum(x.avg_score), 0) / count
                : 0
            const totalLessons = list.reduce((acc, x) => acc + safeNum(x.lesson_count), 0)
            const sortedStudents = [...list].sort((a, b) =>
              String(a.full_name || '').localeCompare(String(b.full_name || ''))
            )
            return { group, count, avgScore, totalLessons, students: sortedStudents }
          })
          .sort((a, b) => a.group.localeCompare(b.group))

        const count = groupsArr.reduce((acc, g) => acc + g.count, 0)
        const weightedAvg =
          count > 0
            ? groupsArr.reduce((acc, g) => acc + g.avgScore * g.count, 0) / count
            : 0
        const totalLessons = groupsArr.reduce((acc, g) => acc + g.totalLessons, 0)
        return { subject, count, avgScore: weightedAvg, totalLessons, groups: groupsArr }
      })
      .sort((a, b) => a.subject.localeCompare(b.subject))

    return subjects
  }, [filteredStudents])

  const barData = useMemo(() => {
    return filteredStudents.map((s) => ({
      name:
        (s.full_name?.split(' ')?.[0] || '—').length > 10
          ? `${(s.full_name?.split(' ')?.[0] || '').slice(0, 9)}…`
          : s.full_name?.split(' ')?.[0] || '—',
      bal: parseFloat(s.avg_score || 0),
      ders: s.lesson_count || 0,
    }))
  }, [filteredStudents])

  const gradeOptions = useMemo(() => {
    const arr = groups.map((g) => g.grade).filter(Boolean)
    return arr
  }, [groups])

  return (
    <div className="p-6 min-w-0">
      <h1 className="font-display font-bold text-xl sm:text-2xl mb-6">Analitika</h1>

      <Card className="p-4 sm:p-5 mb-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-token-textMain">Filtrlə</div>
            <div className="text-xs text-token-textMuted mt-1">
              Sahə və qrup seçin — qrafiklər yalnız həmin tələbələrə görə göstəriləcək.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:w-auto">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Sahə</label>
              <select
                className="w-full bg-token-surfaceMain border border-[color:var(--border-subtle)] rounded-xl px-4 py-2.5 text-token-textMain text-sm outline-none focus:border-blue-500"
                value={selectedSubject}
                onChange={(e) => {
                  const v = e.target.value
                  setSelectedSubject(v)
                  setSelectedGroup('')
                }}
              >
                <option value="">Hamısı</option>
                {subjectOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Qrup</label>
              <select
                className="w-full bg-token-surfaceMain border border-[color:var(--border-subtle)] rounded-xl px-4 py-2.5 text-token-textMain text-sm outline-none focus:border-blue-500 disabled:opacity-60"
                value={selectedGroup}
                disabled={!selectedSubject || groupOptions.length === 0}
                onChange={(e) => setSelectedGroup(e.target.value)}
              >
                <option value="">Hamısı</option>
                {groupOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-token-textMuted">
          Göstərilən tələbə sayı:{' '}
          <span className="text-token-textMain font-semibold">{uniqueStudents.length}</span>
          {selectedSubject ? (
            <>
              {' '}
              · Sahə: <span className="text-token-textMain font-semibold">{selectedSubject}</span>
            </>
          ) : null}
          {selectedGroup ? (
            <>
              {' '}
              · Qrup: <span className="text-token-textMain font-semibold">{selectedGroup}</span>
            </>
          ) : null}
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 min-w-0">
        <Card hover className="p-4 sm:p-5 min-w-0 overflow-hidden">
          <h2 className="font-display font-bold text-base mb-4 text-token-textMain">Tələbə Performansı</h2>
          <div className="w-full h-[240px] min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 12, right: 12, left: 6, bottom: 8 }}>
                <CartesianGrid stroke={gridStroke} vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={14}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 100]}
                  width={34}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(34,224,136,0.08)' }}
                  contentStyle={{
                    background: 'rgba(11,11,11,0.92)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: 12,
                    color: '#fff',
                  }}
                  labelStyle={{ color: 'rgba(229,231,235,0.9)' }}
                />
                <Bar dataKey="bal" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Orta Bal" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card hover className="p-4 sm:p-5 min-w-0 overflow-hidden">
          <h2 className="font-display font-bold text-base mb-4 text-token-textMain">Yönləndirmə Mənbəyi</h2>
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
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(11,11,11,0.92)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      borderRadius: 12,
                      color: '#fff',
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-52 flex items-center justify-center text-token-textMuted">Məlumat yoxdur</div>
          )}
        </Card>
      </div>

      <Card hover className="p-4 sm:p-5 min-w-0 overflow-hidden">
        <h2 className="font-display font-bold text-base mb-4 text-token-textMain">Dərs Sayı</h2>
        <div className="w-full h-[200px] min-h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 12, right: 12, left: 6, bottom: 8 }}>
              <CartesianGrid stroke={gridStroke} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                minTickGap={14}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} width={34} />
              <Tooltip
                cursor={{ fill: 'rgba(34,224,136,0.08)' }}
                contentStyle={{
                  background: 'rgba(11,11,11,0.92)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 12,
                  color: '#fff',
                }}
              />
              <Bar dataKey="ders" fill="#10b981" radius={[6, 6, 0, 0]} name="Dərs sayı" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="mt-4" />

      <Card hover className="p-4 sm:p-5 min-w-0 overflow-hidden">
        <div className="mb-3">
          <h2 className="font-display font-bold text-base text-token-textMain">Sahələr üzrə izləmə</h2>
          <p className="text-xs text-token-textMuted mt-1">
            Sahəni açın → qrupları görün → qrupun içində tələbələri izləyin.
          </p>
        </div>

        {!groupedByTrack.length ? (
          <div className="h-28 flex items-center justify-center text-token-textMuted">Məlumat yoxdur</div>
        ) : (
          <div className="space-y-3">
            {groupedByTrack.map((subj) => (
              <details
                key={subj.subject}
                className="rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceMain/40 overflow-hidden"
              >
                <summary className="cursor-pointer select-none px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-token-textMain truncate">{subj.subject}</div>
                    <div className="text-xs text-token-textMuted mt-0.5">
                      {subj.count} tələbə · Orta bal: {Math.round(subj.avgScore)} · Dərs cəmi: {subj.totalLessons}
                    </div>
                  </div>
                  <div className="text-xs text-token-textMuted shrink-0">Aç / Bağla</div>
                </summary>

                <div className="px-4 pb-4 space-y-2">
                  {subj.groups.map((g) => (
                    <details
                      key={`${subj.subject}__${g.group}`}
                      className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain/60"
                    >
                      <summary className="cursor-pointer select-none px-3 py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-token-textMain truncate">{g.group}</div>
                          <div className="text-xs text-token-textMuted mt-0.5">
                            {g.count} tələbə · Orta bal: {Math.round(g.avgScore)} · Dərs cəmi: {g.totalLessons}
                          </div>
                        </div>
                        <div className="text-xs text-token-textMuted shrink-0">Aç / Bağla</div>
                      </summary>

                      <div className="px-3 pb-3">
                        <ul className="divide-y divide-[color:var(--border-subtle)]">
                          {g.students.map((s) => (
                            <li key={s.id || s.enrollment_id || s.phone} className="py-2 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm text-token-textMain truncate">{s.full_name || '—'}</div>
                                <div className="text-xs text-token-textMuted mt-0.5">
                                  Bal: {Math.round(safeNum(s.avg_score))} · Dərs: {safeNum(s.lesson_count)}
                                </div>
                              </div>
                              <div className="text-xs text-token-textMuted shrink-0">
                                {String(s.billing_type || '').replace(/_/g, ' ')}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </details>
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-4" />

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
                setGroups([])
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
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Ümumi Top 10
              </p>
              {!top10.length ? (
                <p className="text-sm text-gray-500">Nəticə yoxdur.</p>
              ) : (
                <div className="space-y-2">
                  {top10.map((r) => (
                    <div key={r.student_id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-indigo-500/10 bg-[#13112e]/60">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {r.rank === 1 ? '🥇 ' : r.rank === 2 ? '🥈 ' : r.rank === 3 ? '🥉 ' : ''}
                          {r.rank}. {r.full_name}
                        </p>
                        <p className="text-[11px] text-gray-500">{r.grade || '—'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-extrabold text-white">
                          {Math.round(
                            Math.min(100, Math.max(0, Number(r.score_pct ?? r.score) || 0))
                          )}
                          %
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
                    <div key={r.student_id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl border border-indigo-500/10 bg-[#13112e]/60">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">
                          {r.rank === 1 ? '🥇 ' : r.rank === 2 ? '🥈 ' : r.rank === 3 ? '🥉 ' : ''}
                          {r.rank}. {r.full_name}
                        </p>
                        <p className="text-[11px] text-gray-500 font-mono tabular-nums">
                          {Number.isFinite(Number(r.duration_seconds)) ? `${Math.round(Number(r.duration_seconds))}s` : '—'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-extrabold text-white">
                          {Math.round(
                            Math.min(100, Math.max(0, Number(r.score_pct ?? r.score) || 0))
                          )}
                          %
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
