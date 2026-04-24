import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'

const COLORS = ['#e1306c', '#1877f2', '#000', '#3b82f6', '#6366f1']

export default function InstructorAnalytics() {
  const [students, setStudents] = useState([])
  const [exams, setExams] = useState([])
  const [examId, setExamId] = useState('')
  const [groups, setGroups] = useState([])
  const [selectedGrade, setSelectedGrade] = useState('')
  const [groupResults, setGroupResults] = useState([])
  const [top10, setTop10] = useState([])
  const [examLoading, setExamLoading] = useState(false)
  const [examErr, setExamErr] = useState(null)

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

  const referralData = students.reduce((acc, s) => {
    const src = s.referral_source || 'Digər'
    acc[src] = (acc[src] || 0) + 1
    return acc
  }, {})

  const pieData = Object.entries(referralData).map(([name, value]) => ({ name, value }))

  const barData = students.map(s => ({
    name: (s.full_name?.split(' ')?.[0] || '—').length > 10
      ? `${(s.full_name?.split(' ')?.[0] || '').slice(0, 9)}…`
      : (s.full_name?.split(' ')?.[0] || '—'),
    bal: parseFloat(s.avg_score || 0),
    ders: s.lesson_count || 0,
  }))

  const gradeOptions = useMemo(() => {
    const arr = groups.map((g) => g.grade).filter(Boolean)
    return arr
  }, [groups])

  return (
    <div className="p-4 sm:p-6 min-w-0">
      <h1 className="font-display font-bold text-xl sm:text-2xl mb-6">Analitika</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4 min-w-0">
        <Card hover className="p-4 sm:p-5 min-w-0 overflow-hidden">
          <h2 className="font-display font-bold text-base mb-4 text-token-textMain">Tələbə Performansı</h2>
          <div className="w-full h-[240px] min-h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
                <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={48} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} domain={[0, 100]} width={36} />
                <Tooltip contentStyle={{ background: '#1a1740', border: '1px solid rgba(99,102,241,.3)', borderRadius: 8 }} />
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
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1a1740', border: '1px solid rgba(99,102,241,.3)', borderRadius: 8 }} />
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
            <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={48} />
              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} width={36} />
              <Tooltip contentStyle={{ background: '#1a1740', border: '1px solid rgba(99,102,241,.3)', borderRadius: 8 }} />
              <Bar dataKey="ders" fill="#10b981" radius={[6, 6, 0, 0]} name="Dərs sayı" />
            </BarChart>
          </ResponsiveContainer>
        </div>
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
