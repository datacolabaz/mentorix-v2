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
import Modal from '../../components/common/Modal'
import ExamBreakdownList from '../../components/exam/ExamBreakdownList'
import { useToast } from '../../components/common/Toast'
import useUiStore from '../../hooks/useUi'

const COLORS = ['#e1306c', '#1877f2', '#000', '#3b82f6', '#6366f1']

function safeNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/** İmtahan orta faizi (0–100); yoxdursa davamiyyət session_score */
function studentPerformanceBal(s, examById) {
  const row = examById[String(s?.id)]
  if (row?.exam_avg_score != null && Number.isFinite(Number(row.exam_avg_score))) {
    return Math.min(100, Math.max(0, Number(row.exam_avg_score)))
  }
  const att = Number(s?.avg_score)
  return Number.isFinite(att) ? Math.min(100, Math.max(0, att)) : 0
}

export default function InstructorAnalytics() {
  const toast = useToast()
  const [students, setStudents] = useState([])
  const [examStats, setExamStats] = useState([])
  const [referralBreakdown, setReferralBreakdown] = useState([])
  const [referralLoading, setReferralLoading] = useState(false)
  const [referralModal, setReferralModal] = useState(null)
  const [exams, setExams] = useState([])
  const [examId, setExamId] = useState('')
  const [groups, setGroups] = useState([])
  const [participantGroupId, setParticipantGroupId] = useState(null)
  const [crmGroups, setCrmGroups] = useState([])
  const [promoteModal, setPromoteModal] = useState(null)
  const [promoteBusy, setPromoteBusy] = useState(false)

  useEffect(() => {
    setStudentReviewModal(null)
  }, [examId])
  const [selectedGrade, setSelectedGrade] = useState('')
  const [examAudienceFilter, setExamAudienceFilter] = useState('all')
  const [examSummary, setExamSummary] = useState(null)
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [groupResults, setGroupResults] = useState([])
  const [top10, setTop10] = useState([])
  const [examLoading, setExamLoading] = useState(false)
  const [examErr, setExamErr] = useState(null)
  /** { open, loading, error, title, score, submitted_at, breakdown } */
  const [studentReviewModal, setStudentReviewModal] = useState(null)
  const theme = useUiStore((s) => s.theme)
  const gridStroke = theme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.10)'

  useEffect(() => {
    Promise.all([
      api.get('/students').catch(() => ({ students: [] })),
      api.get('/exams/student-progress').catch(() => ({ stats: [] })),
    ])
      .then(([studentsRes, examsRes]) => {
        setStudents(studentsRes.students || [])
        setExamStats(Array.isArray(examsRes.stats) ? examsRes.stats : [])
      })
      .catch(() => {
        setStudents([])
        setExamStats([])
      })
  }, [])

  const examById = useMemo(
    () => Object.fromEntries(examStats.map((r) => [String(r.student_id), r])),
    [examStats]
  )

  useEffect(() => {
    api
      .get('/exams')
      .then((d) => setExams(Array.isArray(d.exams) ? d.exams : []))
      .catch(() => setExams([]))
    api
      .get('/instructor/teaching')
      .then((d) => {
        const opts = []
        for (const sub of Array.isArray(d?.subjects) ? d.subjects : []) {
          if (sub?.is_system) continue
          for (const g of Array.isArray(sub?.groups) ? sub.groups : []) {
            if (g?.is_system) continue
            opts.push({
              id: g.id,
              name: g.name,
              subject_name: sub.name,
              label: `${sub.name} → ${g.name}`,
            })
          }
        }
        setCrmGroups(opts)
      })
      .catch(() => setCrmGroups([]))
  }, [])

  const buildExamQuery = (grade, audience) => {
    const params = new URLSearchParams()
    if (grade) params.set('grade', grade)
    if (audience && audience !== 'all') params.set('audience', audience)
    const q = params.toString()
    return q ? `?${q}` : ''
  }

  const loadExamAnalytics = async (id, grade = null, audience = examAudienceFilter) => {
    if (!id) return
    setExamErr(null)
    setExamLoading(true)
    try {
      const q = buildExamQuery(grade, audience)
      const [g, t, r] = await Promise.all([
        api.get(`/exams/${encodeURIComponent(id)}/groups`),
        api.get(`/exams/${encodeURIComponent(id)}/top10${q}`),
        api.get(`/exams/${encodeURIComponent(id)}/results${q}`),
      ])
      const gr = Array.isArray(g.groups) ? g.groups : []
      setGroups(gr)
      setParticipantGroupId(g.participant_group_id || null)
      setExamSummary(g.summary || null)
      setTop10(Array.isArray(t.top10) ? t.top10 : [])
      setGroupResults(Array.isArray(r.results) ? r.results : [])
    } catch (e) {
      setExamErr(e?.message || 'Yüklənmədi')
      setGroups([])
      setParticipantGroupId(null)
      setTop10([])
      setGroupResults([])
    } finally {
      setExamLoading(false)
    }
  }

  const openPromoteModal = (studentId, studentName) => {
    if (!participantGroupId) return
    setPromoteModal({ studentId, studentName, targetGroupId: crmGroups[0]?.id || '' })
  }

  const submitPromote = async () => {
    if (!promoteModal?.studentId || !participantGroupId || !promoteModal?.targetGroupId) return
    setPromoteBusy(true)
    try {
      const r = await api.post('/instructor/teaching/promote-participant', {
        student_id: promoteModal.studentId,
        system_group_id: participantGroupId,
        target_group_id: promoteModal.targetGroupId,
      })
      if (examId) await loadExamAnalytics(examId, selectedGrade || null)
      const studentsRes = await api.get('/students').catch(() => ({ students: [] }))
      setStudents(studentsRes.students || [])
      setPromoteModal(null)
      toast(r?.message || 'Tələbə CRM qrupuna əlavə edildi', 'success')
    } catch (e) {
      setPromoteModal((m) => (m ? { ...m, error: e?.message || 'Xəta' } : m))
    } finally {
      setPromoteBusy(false)
    }
  }

  const openStudentExamAnswers = async (studentId, displayName) => {
    if (!examId || !studentId) return
    setStudentReviewModal({
      loading: true,
      error: null,
      title: displayName || 'Tələbə',
      score: null,
      submitted_at: null,
      breakdown: [],
    })
    try {
      const d = await api.get(
        `/exams/${encodeURIComponent(examId)}/review?student_id=${encodeURIComponent(studentId)}`
      )
      setStudentReviewModal({
        loading: false,
        error: null,
        title: d.student_name || displayName || 'Tələbə',
        score: d.score,
        submitted_at: d.submitted_at,
        breakdown: Array.isArray(d.breakdown) ? d.breakdown : [],
      })
    } catch (e) {
      setStudentReviewModal({
        loading: false,
        error: e?.message || 'Yüklənmədi',
        title: displayName || 'Tələbə',
        score: null,
        submitted_at: null,
        breakdown: [],
      })
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
      const prev = map.get(id)
      if (!prev) {
        map.set(id, s)
        continue
      }
      // Prefer a row that has referral_source filled (some enrollments may not).
      const prevSrc = String(prev.referral_source || '').trim()
      const nextSrc = String(s.referral_source || '').trim()
      if (!prevSrc && nextSrc) map.set(id, s)
    }
    return Array.from(map.values())
  }, [filteredStudents])

  useEffect(() => {
    const params = {}
    if (selectedSubject) params.subject = selectedSubject
    if (selectedGroup) params.group = selectedGroup
    setReferralLoading(true)
    api
      .get('/students/referral-breakdown', { params })
      .then((d) => setReferralBreakdown(Array.isArray(d.breakdown) ? d.breakdown : []))
      .catch(() => setReferralBreakdown([]))
      .finally(() => setReferralLoading(false))
  }, [selectedSubject, selectedGroup])

  const pieData = useMemo(() => {
    return referralBreakdown.map((b) => ({
      name: b.source,
      value: b.count,
    }))
  }, [referralBreakdown])

  const referralModalStudents = useMemo(() => {
    if (!referralModal?.source) return []
    const row = referralBreakdown.find((b) => b.source === referralModal.source)
    return row?.students || []
  }, [referralBreakdown, referralModal])

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
                ? list.reduce((acc, x) => acc + studentPerformanceBal(x, examById), 0) / count
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
  }, [filteredStudents, examById])

  const barData = useMemo(() => {
    return filteredStudents.map((s) => {
      const ex = examById[String(s.id)]
      return {
        name:
          (s.full_name?.split(' ')?.[0] || '—').length > 10
            ? `${(s.full_name?.split(' ')?.[0] || '').slice(0, 9)}…`
            : s.full_name?.split(' ')?.[0] || '—',
        bal: studentPerformanceBal(s, examById),
        ders: s.lesson_count || 0,
        examsTaken: Math.max(0, Math.floor(Number(ex?.exams_taken) || 0)),
      }
    })
  }, [filteredStudents, examById])

  const gradeOptions = useMemo(() => {
    const arr = groups.map((g) => g.grade).filter(Boolean)
    return arr
  }, [groups])

  const examAudiencePie = useMemo(() => {
    if (!examSummary) return []
    const crm = Number(examSummary.crm_count) || 0
    const guest = Number(examSummary.guest_count) || 0
    return [
      { name: 'Daimi (CRM)', value: crm, key: 'crm' },
      { name: 'Qonaq', value: guest, key: 'guest' },
    ].filter((x) => x.value > 0)
  }, [examSummary])

  return (
    <div className="p-6 min-w-0">
      <h1 className="font-display font-bold text-xl sm:text-2xl mb-6">Analitika</h1>

      <Card className="p-4 sm:p-5 mb-4">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-token-textMain">Filtrlə</div>
            <div className="text-xs text-token-textMuted mt-1 leading-relaxed max-w-2xl">
              Sahə və qrup seçin — qrafiklər yalnız həmin tələbələrə görə göstəriləcək.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full lg:max-w-xl">
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
          <h2 className="font-display font-bold text-base text-token-textMain">Tələbə Performansı</h2>
          <p className="text-xs text-token-textMuted mb-4">
            Təqdim olunmuş imtahanlar üzrə orta faiz (0–100). İmtahan yoxdursa — davamiyyət balı.
          </p>
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
                  formatter={(value, _name, item) => {
                    const n = Math.round(Number(value) * 10) / 10
                    const taken = item?.payload?.examsTaken
                    if (taken > 0) return [`${n}%`, `Orta bal (${taken} imtahan)`]
                    return [`${n}%`, 'Orta bal (davamiyyət)']
                  }}
                />
                <Bar dataKey="bal" fill="#3b82f6" radius={[6, 6, 0, 0]} name="Orta Bal" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card hover className="p-4 sm:p-5 min-w-0 overflow-hidden">
          <h2 className="font-display font-bold text-base text-token-textMain">Yönləndirmə Mənbəyi</h2>
          <p className="text-xs text-token-textMuted mt-1 mb-4">
            Seqmentə klik edin — həmin mənbədən gələn tələbələrin siyahısı açılır.
          </p>
          {referralLoading ? (
            <div className="h-52 flex items-center justify-center text-token-textMuted text-sm">Yüklənir…</div>
          ) : pieData.length ? (
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
                    style={{ cursor: 'pointer' }}
                    onClick={(_data, index) => {
                      const entry = pieData[index]
                      if (entry?.name) setReferralModal({ source: entry.name })
                    }}
                  >
                    {pieData.map((entry, i) => (
                      <Cell
                        key={entry.name}
                        fill={COLORS[i % COLORS.length]}
                        stroke={
                          referralModal?.source === entry.name
                            ? theme === 'dark'
                              ? '#fff'
                              : '#0B1220'
                            : 'transparent'
                        }
                        strokeWidth={referralModal?.source === entry.name ? 2 : 0}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: theme === 'dark' ? 'rgba(11,11,11,0.92)' : 'rgba(255,255,255,0.96)',
                      border:
                        theme === 'dark'
                          ? '1px solid rgba(255,255,255,0.10)'
                          : '1px solid rgba(15,23,42,0.10)',
                      borderRadius: 12,
                      color: theme === 'dark' ? '#fff' : '#0B1220',
                      fontSize: 12,
                    }}
                    itemStyle={{ color: theme === 'dark' ? '#fff' : '#0B1220' }}
                    labelStyle={{ color: theme === 'dark' ? 'rgba(229,231,235,0.9)' : '#0B1220' }}
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
                                  Bal: {Math.round(studentPerformanceBal(s, examById))}
                                  {examById[String(s.id)]?.exams_taken
                                    ? ` · ${examById[String(s.id)].exams_taken} imtahan`
                                    : ''}{' '}
                                  · Dərs: {safeNum(s.lesson_count)}
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
            <p className="text-xs text-token-textMuted mt-1">
              Daimi qrup tələbələri və qonaq iştirakçılar ayrıca filtrlənir.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void loadExamAnalytics(examId, selectedGrade || null, examAudienceFilter)}
            disabled={!examId || examLoading}
          >
            Yenilə
          </Button>
        </div>

        {examId && examSummary ? (
          <p className="text-xs text-token-textMuted mb-3">
            {examSummary.crm_count || 0} daimi · {examSummary.guest_count || 0} qonaq · cəmi{' '}
            {examSummary.total_count || 0} nəticə
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { id: 'all', label: 'Hamısı' },
            { id: 'crm', label: 'Daimi Tələbələrim (CRM)' },
            { id: 'guest', label: 'Qonaq İştirakçılar' },
          ].map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                setExamAudienceFilter(opt.id)
                if (examId) void loadExamAnalytics(examId, selectedGrade || null, opt.id)
              }}
              className={[
                'rounded-xl px-3 py-2 text-xs font-semibold border transition-colors',
                examAudienceFilter === opt.id
                  ? 'border-primary/50 bg-primary/15 text-primary'
                  : 'border-indigo-500/20 bg-[#13112e]/60 text-gray-300 hover:border-indigo-500/35',
              ].join(' ')}
            >
              {opt.label}
            </button>
          ))}
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
                setExamAudienceFilter('all')
                setExamSummary(null)
                setGroups([])
                setGroupResults([])
                setTop10([])
                if (id) await loadExamAnalytics(id, null, 'all')
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
                if (examId) await loadExamAnalytics(examId, g || null, examAudienceFilter)
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

        {examId && !examLoading && examAudiencePie.length > 0 ? (
          <div className="rounded-xl border border-indigo-500/15 bg-[#0f0c29]/40 p-4 mt-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              İştirakçı tərkibi
            </p>
            <div className="w-full h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={examAudiencePie}
                    cx="50%"
                    cy="50%"
                    innerRadius="42%"
                    outerRadius="70%"
                    dataKey="value"
                    paddingAngle={2}
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {examAudiencePie.map((entry) => (
                      <Cell key={entry.key} fill={entry.key === 'crm' ? '#22c55e' : '#6366f1'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : null}

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
                        <p className="text-[11px] text-gray-500">
                          {r.is_crm_student ? r.grade || 'CRM' : 'Qonaq'}
                          {r.phone ? ` · ${r.phone}` : ''}
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
                      className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-indigo-500/10 bg-[#13112e]/60"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">
                          {r.rank === 1 ? '🥇 ' : r.rank === 2 ? '🥈 ' : r.rank === 3 ? '🥉 ' : ''}
                          {r.rank}. {r.full_name}
                        </p>
                        <p className="text-[11px] text-gray-500 font-mono tabular-nums">
                          {r.is_crm_student ? r.grade || 'CRM' : 'Qonaq'}
                          {r.phone ? ` · ${r.phone}` : ''}
                          {Number.isFinite(Number(r.duration_seconds))
                            ? ` · ${Math.round(Number(r.duration_seconds))}s`
                            : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void openStudentExamAnswers(r.student_id, r.full_name)}
                        className="text-[11px] font-semibold text-sky-300 hover:text-sky-200 border border-sky-500/30 rounded-lg px-2 py-1 shrink-0"
                      >
                        Cavablar
                      </button>
                      {participantGroupId && crmGroups.length > 0 && !r.is_crm_student ? (
                        <button
                          type="button"
                          onClick={() => openPromoteModal(r.student_id, r.full_name)}
                          className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 border border-emerald-500/30 rounded-lg px-2 py-1 shrink-0"
                          title="Daimi CRM qrupuna köçür"
                        >
                          + Qrupa
                        </button>
                      ) : null}
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

      {promoteModal != null && (
        <Modal
          open
          onClose={() => !promoteBusy && setPromoteModal(null)}
          title="Qrupa əlavə et"
          size="sm"
          footer={
            <div className="flex gap-2 justify-end">
              <Button variant="secondary" disabled={promoteBusy} onClick={() => setPromoteModal(null)}>
                Ləğv et
              </Button>
              <Button loading={promoteBusy} onClick={() => void submitPromote()}>
                Əlavə et
              </Button>
            </div>
          }
        >
          <p className="text-sm text-token-textMuted mb-3">
            <strong className="text-token-textMain">{promoteModal.studentName}</strong> iştirakçı qrupundan
            daimi CRM qrupuna köçürüləcək — paket və cədvəl tətbiq olunacaq.
          </p>
          <label className="block text-xs font-semibold uppercase tracking-wider text-token-textMuted mb-1.5">
            Hədəf qrup
          </label>
          <select
            className="w-full border border-[color:var(--border-subtle)] rounded-xl px-3 py-2.5 text-sm bg-token-surfaceCard/55"
            value={promoteModal.targetGroupId || ''}
            onChange={(e) =>
              setPromoteModal((m) => (m ? { ...m, targetGroupId: e.target.value, error: null } : m))
            }
          >
            {crmGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
          {promoteModal.error ? (
            <p className="text-sm text-red-400 mt-2">{promoteModal.error}</p>
          ) : null}
        </Modal>
      )}

      {studentReviewModal != null && (
        <Modal
          open
          onClose={() => setStudentReviewModal(null)}
          title={`${studentReviewModal.title || 'Tələbə'} — cavablar`}
          size="lg"
        >
          {studentReviewModal.loading ? (
            <p className="text-gray-500 text-center py-10">Yüklənir…</p>
          ) : studentReviewModal.error ? (
            <p className="text-red-400 text-sm text-center py-6">{studentReviewModal.error}</p>
          ) : (
            <>
              <div className="text-center mb-4">
                <div className="font-display font-extrabold text-2xl text-white">
                  {Number.isFinite(Number(studentReviewModal.score))
                    ? Math.round(Number(studentReviewModal.score) * 100) / 100
                    : '—'}{' '}
                  bal
                </div>
                {studentReviewModal.submitted_at && (
                  <p className="text-xs text-gray-500 mt-2">
                    Təqdim: {new Date(studentReviewModal.submitted_at).toLocaleString('az-AZ')}
                  </p>
                )}
              </div>
              <ExamBreakdownList
                rows={studentReviewModal.breakdown}
                answerHeading="Tələbənin cavabı"
              />
            </>
          )}
        </Modal>
      )}

      {referralModal != null && (
        <Modal
          open
          onClose={() => setReferralModal(null)}
          title={`${referralModal.source} — ${referralModalStudents.length} tələbə`}
          size="md"
        >
          {referralModalStudents.length === 0 ? (
            <p className="text-sm text-token-textMuted text-center py-8">Bu mənbə üçün tələbə tapılmadı.</p>
          ) : (
            <ul className="space-y-2 max-h-[min(420px,60vh)] overflow-y-auto pr-1">
              {referralModalStudents.map((s) => {
                const track = [s.track_subject_name, s.track_group_name].filter(Boolean).join(' · ')
                return (
                  <li
                    key={s.id}
                    className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain/40 px-3 py-2.5"
                  >
                    <p className="text-sm font-semibold text-token-textMain">{s.full_name || '—'}</p>
                    {s.phone ? (
                      <p className="text-xs text-token-textMuted mt-0.5 font-mono">{s.phone}</p>
                    ) : null}
                    {track ? <p className="text-xs text-token-textMuted mt-0.5">{track}</p> : null}
                    {s.referral_notes && referralModal.source !== String(s.referral_source || '').trim() ? (
                      <p className="text-[11px] text-token-textMuted mt-1 italic">{s.referral_notes}</p>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex justify-end pt-4">
            <Button variant="secondary" onClick={() => setReferralModal(null)}>
              Bağla
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
