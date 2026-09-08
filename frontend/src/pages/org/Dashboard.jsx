import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import KpiCard from '../../components/common/KpiCard'
import CourseSetupModal from '../../components/course/CourseSetupModal'
import { useOrgWorkspace } from '../../hooks/useOrgWorkspace'
import OrgPage, { OrgPanel, OrgEmpty, OrgTable } from '../../components/org/OrgPage'
import { formatOrgDateTime, orgAuditAction } from '../../lib/orgI18n'

function fmtScore(v) {
  if (v == null || v === '') return '—'
  return `${v}%`
}

export default function OrgDashboard() {
  const { t, i18n } = useTranslation()
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
        setError(null)
        if (next.needs_branding) setSetupOpen(true)
      })
      .catch((err) => setError(err?.message || t('org.common.loadFailed')))
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
      label: t('org.quick.createExam'),
      hint: instructorExams ? t('org.quick.createExamHint') : t('org.quick.createExamNeedTrainer'),
      show: can('assessments.view'),
    },
    {
      to: '/org/participants',
      label: t('org.quick.addParticipant'),
      hint: t('org.quick.addParticipantHint'),
      show: can('users.create'),
    },
    {
      to: '/org/trainers',
      label: t('org.quick.inviteTrainer'),
      hint: t('org.quick.inviteTrainerHint'),
      show: can('trainers.invite'),
    },
    {
      to: '/org/teams',
      label: t('org.quick.createTeam'),
      hint: t('org.quick.createTeamHint'),
      show: can('teams.create'),
    },
    {
      to: instructorExams ? '/instructor/exams' : '/org/tests',
      label: t('org.quick.createTest'),
      hint: instructorExams ? t('org.quick.createTestHint') : t('org.quick.createTestNeedTrainer'),
      show: can('content.view'),
    },
  ].filter((x) => x.show)

  return (
    <OrgPage
      title={t('org.dashboard.title')}
      description={
        loading
          ? '…'
          : t('org.dashboard.subtitle', {
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
          title={t('org.kpi.participants')}
          value={loading ? '…' : String(kpis.active_participants ?? 0)}
          to="/org/participants"
        />
        <KpiCard
          title={t('org.kpi.trainers')}
          value={loading ? '…' : String(kpis.active_trainers ?? 0)}
          to="/org/trainers"
        />
        <KpiCard
          title={t('org.kpi.activeExams')}
          value={loading ? '…' : String(kpis.active_exams ?? 0)}
          to="/org/exams"
        />
        <KpiCard
          title={t('org.kpi.completed')}
          value={loading ? '…' : String(kpis.completed_assessments ?? 0)}
          to="/org/assessments"
        />
        <KpiCard
          title={t('org.kpi.avgScore')}
          value={loading ? '…' : fmtScore(kpis.average_score)}
          to="/org/analytics"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <OrgPanel title={t('org.dashboard.activity')}>
          <OrgTable
            columns={[
              { key: 'actor_name', label: t('org.audit.actor'), render: (r) => r.actor_name || '—' },
              {
                key: 'action',
                label: t('org.audit.action'),
                render: (r) => orgAuditAction(t, r.action),
              },
              {
                key: 'created_at',
                label: t('org.audit.time'),
                render: (r) => formatOrgDateTime(r.created_at, i18n.language),
              },
            ]}
            rows={data?.recent_activity || []}
            empty={<OrgEmpty>{t('org.dashboard.noActivity')}</OrgEmpty>}
          />
        </OrgPanel>
        <OrgPanel title={t('org.dashboard.quick')}>
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
        <OrgPanel title={t('org.dashboard.activeExams')}>
          <OrgTable
            columns={[
              { key: 'title', label: t('org.exams.name') },
              { key: 'created_by', label: t('org.exams.createdBy') },
              { key: 'participants', label: t('org.exams.participants') },
              { key: 'average_score', label: t('org.exams.avg'), render: (r) => fmtScore(r.average_score) },
            ]}
            rows={data?.active_exams || []}
            empty={<OrgEmpty>{t('org.dashboard.noActiveExams')}</OrgEmpty>}
          />
        </OrgPanel>
        <OrgPanel title={t('org.dashboard.upcomingExams')}>
          <OrgTable
            columns={[
              { key: 'title', label: t('org.exams.name') },
              { key: 'created_by', label: t('org.exams.createdBy') },
              {
                key: 'available_from',
                label: t('org.exams.date'),
                render: (r) => formatOrgDateTime(r.available_from || r.start_time, i18n.language),
              },
            ]}
            rows={data?.upcoming_exams || []}
            empty={<OrgEmpty>{t('org.dashboard.noUpcoming')}</OrgEmpty>}
          />
        </OrgPanel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <OrgPanel title={t('org.dashboard.teamPerf')}>
          <OrgTable
            columns={[
              { key: 'name', label: t('org.teams.name') },
              { key: 'member_count', label: t('org.teams.members') },
              { key: 'average_score', label: t('org.exams.avg'), render: (r) => fmtScore(r.average_score) },
              {
                key: 'completion_rate',
                label: t('org.teams.completion'),
                render: (r) => `${r.completion_rate ?? 0}%`,
              },
            ]}
            rows={data?.team_performance || []}
            empty={<OrgEmpty>{t('org.dashboard.noTeams')}</OrgEmpty>}
          />
        </OrgPanel>
        <OrgPanel title={t('org.dashboard.examResults')}>
          <OrgTable
            columns={[
              { key: 'name', label: t('org.exams.name') },
              { key: 'created_by', label: t('org.exams.createdBy') },
              { key: 'average_score', label: t('org.exams.avg'), render: (r) => fmtScore(r.average_score) },
              { key: 'completion', label: '%', render: (r) => `${r.completion ?? 0}%` },
            ]}
            rows={data?.exam_results || []}
            empty={<OrgEmpty>{t('org.dashboard.noResults')}</OrgEmpty>}
          />
        </OrgPanel>
      </div>

      <OrgPanel title={t('org.dashboard.recentParticipants')}>
        <OrgTable
          columns={[
            { key: 'full_name', label: t('org.participants.name') },
            { key: 'team_name', label: t('org.participants.team'), render: (r) => r.team_name || '—' },
            { key: 'group_name', label: t('org.participants.group'), render: (r) => r.group_name || '—' },
            { key: 'avg_score', label: t('org.participants.score'), render: (r) => fmtScore(r.avg_score) },
          ]}
          rows={data?.recent_participants || []}
          empty={<OrgEmpty>{t('org.dashboard.noParticipants')}</OrgEmpty>}
        />
        {can('users.view') ? (
          <div className="mt-3">
            <Link to="/org/participants" className="text-sm text-emerald-300 hover:underline">
              {t('org.dashboard.seeAll')}
            </Link>
          </div>
        ) : null}
      </OrgPanel>
    </OrgPage>
  )
}
