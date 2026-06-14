import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import { useStudentGroups } from '../../contexts/StudentGroupContext'
import GroupSwitcher from '../../components/student/GroupSwitcher'
import { studentEnrollmentDisplay } from '../../lib/participantGroupLabels'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('az-AZ', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function MyGroups() {
  const { enrollments, loading, setActiveEnrollmentId, refreshEnrollments } = useStudentGroups()
  const [overview, setOverview] = useState(null)
  const [leaveBusy, setLeaveBusy] = useState(null)
  const toast = useToast()
  const navigate = useNavigate()

  useEffect(() => {
    api
      .get('/students/my/overview')
      .then((d) => setOverview(d))
      .catch(() => setOverview(null))
  }, [enrollments.length])

  const statsFor = (enrollmentId) =>
    overview?.by_group?.find((g) => String(g.enrollment_id) === String(enrollmentId))

  const openGroup = (enrollmentId) => {
    setActiveEnrollmentId(enrollmentId)
    navigate('/student')
  }

  const leaveGroup = async (enrollmentId, name) => {
    if (!window.confirm(`"${name}" qrupundan ayrılmaq istəyirsiniz?`)) return
    setLeaveBusy(enrollmentId)
    try {
      await api.post(`/students/my/leave/${enrollmentId}`)
      toast('Qrupdan ayrıldınız')
      await refreshEnrollments()
      const d = await api.get('/students/my/overview')
      setOverview(d)
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setLeaveBusy(null)
    }
  }

  return (
    <div className="p-4 sm:p-6 w-full min-w-0 max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 min-w-0">
        <div>
          <h1 className="font-display font-bold text-2xl text-token-textMain">Qruplarım</h1>
          <p className="text-token-textMuted text-sm mt-1">
            Bütün qruplarınız — hər biri ayrı müəllim və fənn
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <GroupSwitcher />
        </div>
      </div>

      {loading && (
        <div className="text-center py-16 text-token-textMuted text-sm">Yüklənir...</div>
      )}

      {!loading && !enrollments.length && (
        <Card className="p-8 text-center border border-dashed border-[color:var(--border-subtle)]">
          <div className="text-4xl mb-3">📚</div>
          <h2 className="font-display font-bold text-lg text-token-textMain">Hələ qrup yoxdur</h2>
          <p className="text-sm text-token-textMuted mt-2 max-w-md mx-auto">
            Müəllimin WhatsApp-dan göndərdiyi linkə toxunun. Eyni hesabla bir neçə qrupa qoşula bilərsiniz.
          </p>
        </Card>
      )}

      <div className="space-y-4">
        {enrollments.map((g) => {
          const st = statsFor(g.enrollment_id)
          const display = studentEnrollmentDisplay(g)
          return (
            <Card
              key={g.enrollment_id}
              className="p-5 border border-[color:var(--border-subtle)] overflow-hidden"
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0 border border-white/10"
                  style={{ backgroundColor: `${g.color}22`, borderColor: `${g.color}44` }}
                >
                  📘
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="font-display font-bold text-lg text-token-textMain truncate">
                    {display.title}
                  </h2>
                  {display.subtitle ? (
                    <p className="text-sm text-token-textMuted mt-0.5">{display.subtitle}</p>
                  ) : null}
                  {String(g.status || '').toLowerCase() === 'pending_approval' && (
                    <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wide text-sky-300 bg-sky-500/10 border border-sky-500/30 rounded-lg px-2 py-0.5">
                      Sorğu göndərildi — müəllim təsdiqi gözlənilir
                    </span>
                  )}
                  {String(g.status || '').toLowerCase() === 'pending_setup' && (
                    <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wide text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-2 py-0.5">
                      Müəllim quraşdırmanı tamamlayır
                    </span>
                  )}
                  <div className="flex flex-wrap gap-3 mt-3 text-xs text-token-textMuted">
                    <span>👥 {g.student_count ?? 0} tələbə</span>
                    <span>📅 Qoşulma: {fmtDate(g.join_date)}</span>
                    {g.join_code && (
                      <span className="font-mono text-primary/90">{g.join_code}</span>
                    )}
                  </div>
                  {st && (
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      <div className="rounded-lg bg-black/[0.03] dark:bg-white/5 px-2 py-2 text-center">
                        <div className="text-lg font-bold text-token-textMain">{st.upcoming_exams}</div>
                        <div className="text-[10px] uppercase text-token-textMuted">İmtahan</div>
                      </div>
                      <div className="rounded-lg bg-black/[0.03] dark:bg-white/5 px-2 py-2 text-center">
                        <div className="text-lg font-bold text-token-textMain">{st.pending_tasks}</div>
                        <div className="text-[10px] uppercase text-token-textMuted">Tapşırıq</div>
                      </div>
                      <div className="rounded-lg bg-black/[0.03] dark:bg-white/5 px-2 py-2 text-center">
                        <div className="text-lg font-bold text-token-textMain">
                          {st.avg_score != null ? `${st.avg_score}%` : '—'}
                        </div>
                        <div className="text-[10px] uppercase text-token-textMuted">Orta bal</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[color:var(--border-subtle)]">
                <Button size="sm" onClick={() => openGroup(g.enrollment_id)}>
                  Panelə keç
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setActiveEnrollmentId(g.enrollment_id)
                    navigate('/student/exams')
                  }}
                >
                  İmtahanlar
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setActiveEnrollmentId(g.enrollment_id)
                    navigate('/student/assignments')
                  }}
                >
                  Tapşırıqlar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={leaveBusy === g.enrollment_id}
                  onClick={() => leaveGroup(g.enrollment_id, display.title)}
                >
                  Qrupdan ayrıl
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {enrollments.length > 0 && (
        <p className="text-center text-xs text-token-textMuted mt-6">
          Başqa qrupa qoşulmaq üçün müəllimin göndərdiyi dəvət linkinə toxunun.
        </p>
      )}
    </div>
  )
}
