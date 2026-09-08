import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import KpiCard from '../../components/common/KpiCard'
import CourseSetupModal from '../../components/course/CourseSetupModal'
import { useOrgWorkspace } from '../../hooks/useOrgWorkspace'
import OrgPage, { OrgPanel, OrgEmpty, OrgTable } from '../../components/org/OrgPage'

function fmtScore(v) {
  if (v == null || v === '') return '—'
  return `${v}%`
}

function fmtWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('az-AZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function OrgDashboard() {
  const { t } = useTranslation()
  const { can, reload } = useOrgWorkspace()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [setupOpen, setSetupOpen] = useState(false)

  const load = () => {
    setLoading(true)
    return api
      .get('/course/overview')
      .then((res) => {
        const next = res.overview || {}
        setData(next)
        if (next.needs_branding) setSetupOpen(true)
      })
      .catch((err) => setError(err?.message || 'Yüklənmədi'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const kpis = data?.kpis || {}
  const instructorExams = Boolean(data?.capabilities?.instructor_exam_workspace)

  const quick = [
    {
      to: instructorExams ? '/instructor/exams' : '/org/trainers',
      label: t('org.quick.createExam', { defaultValue: 'İmtahan yarat' }),
      hint: instructorExams
        ? t('org.quick.createExamHint', { defaultValue: 'Müəllim panelində imtahan yaradılır' })
        : t('org.quick.createExamNeedTrainer', { defaultValue: 'İmtahanı təşkilat müəllimi yaradır' }),
      show: can('assessments.view'),
    },
    {
      to: '/org/participants',
      label: t('org.quick.addParticipant', { defaultValue: 'İştirakçı əlavə et' }),
      hint: t('org.quick.addParticipantHint', { defaultValue: 'Qeydiyyatlı iştirakçını telefona görə əlavə edin' }),
      show: can('users.create'),
    },
    {
      to: '/org/trainers',
      label: t('org.quick.inviteTrainer', { defaultValue: 'Müəllim dəvət et' }),
      hint: t('org.quick.inviteTrainerHint', { defaultValue: 'Platformada qeydiyyatlı təlimçini heyətə əlavə edin' }),
      show: can('trainers.invite'),
    },
    {
      to: '/org/teams',
      label: t('org.quick.createTeam', { defaultValue: 'Komanda yarat' }),
      hint: t('org.quick.createTeamHint', { defaultValue: 'Sales, Engineering və s.' }),
      show: can('teams.create'),
    },
    {
      to: instructorExams ? '/instructor/exams' : '/org/tests',
      label: t('org.quick.createTest', { defaultValue: 'Test yarat' }),
      hint: instructorExams
        ? t('org.quick.createTestHint', { defaultValue: 'Testlər müəllim panelindən yaradılır' })
        : t('org.quick.createTestNeedTrainer', { defaultValue: 'Test yaratmaq üçün müəllim paneli lazımdır' }),
      show: can('content.view'),
    },
  ].filter((x) => x.show)

  return (
    <OrgPage
      title={t('org.dashboard.title', { defaultValue: 'Təşkilat icmalı' })}
      description={
        loading
          ? '…'
          : t('org.dashboard.subtitle', {
              defaultValue: '{{name}} — bütün təşkilatın vəziyyəti',
              name: data?.course_name || '',
            })
      }
    >
      <CourseSetupModal
        open={setupOpen}
        onComplete={() => {
          setSetupOpen(false)
          void load()
          void reload()
        }}
      />
      {error ? <p className="text-sm text-red-300/90">{error}</p> : null}

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
        <KpiCard
          title={t('org.kpi.participants', { defaultValue: 'Aktiv iştirakçılar' })}
          value={loading ? '…' : String(kpis.active_participants ?? 0)}
          to="/org/participants"
        />
        <KpiCard
          title={t('org.kpi.trainers', { defaultValue: 'Aktiv müəllim / təlimçilər' })}
          value={loading ? '…' : String(kpis.active_trainers ?? 0)}
          to="/org/trainers"
        />
        <KpiCard
          title={t('org.kpi.activeExams', { defaultValue: 'Aktiv imtahanlar' })}
          value={loading ? '…' : String(kpis.active_exams ?? 0)}
          to="/org/exams"
        />
        <KpiCard
          title={t('org.kpi.completed', { defaultValue: 'Tamamlanmış qiymətləndirmələr' })}
          value={loading ? '…' : String(kpis.completed_assessments ?? 0)}
          to="/org/assessments"
        />
        <KpiCard
          title={t('org.kpi.avgScore', { defaultValue: 'Orta nəticə' })}
          value={loading ? '…' : fmtScore(kpis.average_score)}
          to="/org/analytics"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <OrgPanel title={t('org.dashboard.activity', { defaultValue: 'Son fəaliyyətlər' })}>
          <OrgTable
            columns={[
              { key: 'actor_name', label: t('org.audit.actor', { defaultValue: 'Actor' }), render: (r) => r.actor_name || '—' },
              { key: 'action', label: t('org.audit.action', { defaultValue: 'Action' }) },
              { key: 'created_at', label: t('org.audit.time', { defaultValue: 'Vaxt' }), render: (r) => fmtWhen(r.created_at) },
            ]}
            rows={data?.recent_activity || []}
            empty={<OrgEmpty>{t('org.dashboard.noActivity', { defaultValue: 'Hələ audit qeydi yoxdur.' })}</OrgEmpty>}
          />
        </OrgPanel>
        <OrgPanel title={t('org.dashboard.quick', { defaultValue: 'Quick Actions' })}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {quick.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <div className="text-sm font-semibold text-token-textMain">{item.label}</div>
                <div className="text-[11px] text-token-textMuted mt-1 leading-snug">{item.hint}</div>
              </Link>
            ))}
          </div>
        </OrgPanel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <OrgPanel title={t('org.dashboard.activeExams', { defaultValue: 'Aktiv imtahanlar' })}>
          <OrgTable
            columns={[
              { key: 'title', label: t('org.exams.name', { defaultValue: 'Ad' }) },
              { key: 'created_by', label: t('org.exams.createdBy', { defaultValue: 'Müəllif' }) },
              { key: 'participants', label: t('org.exams.participants', { defaultValue: 'İştirakçılar' }) },
              { key: 'average_score', label: t('org.exams.avg', { defaultValue: 'Orta' }), render: (r) => fmtScore(r.average_score) },
            ]}
            rows={data?.active_exams || []}
            empty={<OrgEmpty>{t('org.dashboard.noActiveExams', { defaultValue: 'Hazırda aktiv təşkilat imtahanı yoxdur.' })}</OrgEmpty>}
          />
        </OrgPanel>
        <OrgPanel title={t('org.dashboard.upcomingExams', { defaultValue: 'Yaxınlaşan imtahanlar' })}>
          <OrgTable
            columns={[
              { key: 'title', label: t('org.exams.name', { defaultValue: 'Ad' }) },
              { key: 'created_by', label: t('org.exams.createdBy', { defaultValue: 'Müəllif' }) },
              { key: 'available_from', label: t('org.exams.date', { defaultValue: 'Tarix' }), render: (r) => fmtWhen(r.available_from || r.start_time) },
            ]}
            rows={data?.upcoming_exams || []}
            empty={<OrgEmpty>{t('org.dashboard.noUpcoming', { defaultValue: 'Planlaşdırılmış imtahan yoxdur.' })}</OrgEmpty>}
          />
        </OrgPanel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <OrgPanel title={t('org.dashboard.teamPerf', { defaultValue: 'Komandalar üzrə performans' })}>
          <OrgTable
            columns={[
              { key: 'name', label: t('org.teams.name', { defaultValue: 'Komanda' }) },
              { key: 'member_count', label: t('org.teams.members', { defaultValue: 'Üzvlər' }) },
              { key: 'average_score', label: t('org.exams.avg', { defaultValue: 'Orta' }), render: (r) => fmtScore(r.average_score) },
              { key: 'completion_rate', label: t('org.teams.completion', { defaultValue: 'Tamamlanma' }), render: (r) => `${r.completion_rate ?? 0}%` },
            ]}
            rows={data?.team_performance || []}
            empty={<OrgEmpty>{t('org.dashboard.noTeams', { defaultValue: 'Hələ komanda yoxdur. Sales, Marketing kimi struktur yaradın.' })}</OrgEmpty>}
          />
        </OrgPanel>
        <OrgPanel title={t('org.dashboard.examResults', { defaultValue: 'İmtahan nəticələri' })}>
          <OrgTable
            columns={[
              { key: 'name', label: t('org.exams.name', { defaultValue: 'Ad' }) },
              { key: 'created_by', label: t('org.exams.createdBy', { defaultValue: 'Müəllif' }) },
              { key: 'average_score', label: t('org.exams.avg', { defaultValue: 'Orta' }), render: (r) => fmtScore(r.average_score) },
              { key: 'completion', label: '%', render: (r) => `${r.completion ?? 0}%` },
            ]}
            rows={data?.exam_results || []}
            empty={<OrgEmpty>{t('org.dashboard.noResults', { defaultValue: 'Nəticə hələ yoxdur — təşkilat müəllimlərinin imtahanları burada toplanır.' })}</OrgEmpty>}
          />
        </OrgPanel>
      </div>

      <OrgPanel
        title={t('org.dashboard.recentParticipants', { defaultValue: 'Son əlavə edilən iştirakçılar' })}
      >
        <OrgTable
          columns={[
            { key: 'full_name', label: t('org.participants.name', { defaultValue: 'Ad' }) },
            { key: 'team_name', label: t('org.participants.team', { defaultValue: 'Komanda' }), render: (r) => r.team_name || '—' },
            { key: 'group_name', label: t('org.participants.group', { defaultValue: 'Qrup' }), render: (r) => r.group_name || '—' },
            { key: 'avg_score', label: t('org.participants.score', { defaultValue: 'Nəticə' }), render: (r) => fmtScore(r.avg_score) },
          ]}
          rows={data?.recent_participants || []}
          empty={<OrgEmpty>{t('org.dashboard.noParticipants', { defaultValue: 'Hələ iştirakçı yoxdur.' })}</OrgEmpty>}
        />
        {can('users.view') ? (
          <div className="mt-3">
            <Link to="/org/participants" className="text-sm text-emerald-300 hover:underline">
              {t('org.dashboard.seeAll', { defaultValue: 'Hamısına bax' })}
            </Link>
          </div>
        ) : null}
      </OrgPanel>
    </OrgPage>
  )
}
