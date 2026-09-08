import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import KpiCard from '../../components/common/KpiCard'
import { useOrgWorkspace } from '../../hooks/useOrgWorkspace'
import OrgPage, { OrgPanel, OrgEmpty, OrgTable } from '../../components/org/OrgPage'
import { orgAssessmentStatus } from '../../lib/orgI18n'

export default function OrgAnalytics({ focus = 'overview' }) {
  const { t } = useTranslation()
  const { can } = useOrgWorkspace()
  const [data, setData] = useState(null)
  const [filters, setFilters] = useState({ from: '', to: '', team_id: '', instructor_id: '' })
  const [teams, setTeams] = useState([])
  const [trainers, setTrainers] = useState([])

  useEffect(() => {
    api.get('/course/teams').then((r) => setTeams(r.teams || [])).catch(() => {})
    api.get('/course/teachers').then((r) => setTrainers(r.teachers || [])).catch(() => {})
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v)
    })
    api
      .get(`/course/analytics?${params.toString()}`)
      .then((res) => setData(res.analytics))
      .catch(() => setData(null))
  }, [filters])

  const summary = data?.summary || {}
  const title =
    focus === 'exams'
      ? t('org.analytics.exams')
      : focus === 'participants'
        ? t('org.analytics.participants')
        : focus === 'teams'
          ? t('org.analytics.teams')
          : focus === 'reports'
            ? t('org.analytics.reports')
            : t('org.analytics.overview')

  function exportCsv() {
    const token = localStorage.getItem('mx_token')
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v)
    })
    fetch(`/api/course/analytics/export?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'teskilat-hesabati.csv'
        a.click()
        URL.revokeObjectURL(url)
      })
  }

  return (
    <OrgPage
      title={title}
      description={t('org.analytics.desc')}
      actions={
        can('reports.export') ? (
          <Button variant="secondary" onClick={exportCsv}>
            {t('org.common.export')}
          </Button>
        ) : null
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <input
          type="date"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          value={filters.from}
          onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
        />
        <input
          type="date"
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          value={filters.to}
          onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
        />
        <select
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          value={filters.team_id}
          onChange={(e) => setFilters((f) => ({ ...f, team_id: e.target.value }))}
        >
          <option value="">{t('org.analytics.allTeams')}</option>
          {teams.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <select
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
          value={filters.instructor_id}
          onChange={(e) => setFilters((f) => ({ ...f, instructor_id: e.target.value }))}
        >
          <option value="">{t('org.analytics.allTeachers')}</option>
          {trainers.map((x) => (
            <option key={x.id} value={x.id}>
              {x.full_name}
            </option>
          ))}
        </select>
      </div>

      {focus === 'overview' || focus === 'reports' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard title={t('org.analytics.participation')} value={String(summary.participation ?? 0)} />
          <KpiCard title={t('org.analytics.completion')} value={String(summary.completion ?? 0)} />
          <KpiCard title={t('org.analytics.avgScore')} value={summary.average_score == null ? '—' : `${summary.average_score}%`} />
        </div>
      ) : null}

      {focus === 'overview' ? (
        <OrgPanel title={t('org.analytics.distribution')}>
          {data?.score_distribution?.some((x) => x.count > 0) ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.score_distribution}>
                  <XAxis dataKey="label" stroke="#9ca3af" fontSize={11} />
                  <YAxis stroke="#9ca3af" fontSize={11} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#22e088" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <OrgEmpty>{t('org.analytics.noDistribution')}</OrgEmpty>
          )}
        </OrgPanel>
      ) : null}

      {(focus === 'exams' || focus === 'overview' || focus === 'reports') && (
        <OrgPanel title={t('org.analytics.assessmentPerf')}>
          <OrgTable
            columns={[
              { key: 'name', label: t('org.analytics.exam') },
              { key: 'created_by', label: t('org.analytics.teacher') },
              { key: 'participants', label: t('org.analytics.participationCol') },
              { key: 'completion', label: '%' },
              { key: 'average_score', label: t('org.exams.avg'), render: (r) => (r.average_score == null ? '—' : `${r.average_score}%`) },
            ]}
            rows={data?.assessments || []}
            empty={<OrgEmpty>{t('org.analytics.noExamResults')}</OrgEmpty>}
          />
        </OrgPanel>
      )}

      {(focus === 'participants' || focus === 'overview' || focus === 'reports') && (
        <OrgPanel title={t('org.analytics.participants')}>
          <OrgTable
            columns={[
              { key: 'name', label: t('org.analytics.participant') },
              { key: 'team_name', label: t('org.analytics.team'), render: (r) => r.team_name || '—' },
              { key: 'group_name', label: t('org.analytics.group'), render: (r) => r.group_name || '—' },
              { key: 'avg_score', label: t('org.analytics.score'), render: (r) => (r.avg_score == null ? '—' : `${r.avg_score}%`) },
              {
                key: 'assessment_status',
                label: t('org.analytics.status'),
                render: (r) => orgAssessmentStatus(t, r.assessment_status),
              },
            ]}
            rows={data?.participants || []}
            empty={<OrgEmpty>{t('org.analytics.noParticipantResults')}</OrgEmpty>}
          />
        </OrgPanel>
      )}

      {(focus === 'teams' || focus === 'overview' || focus === 'reports') && (
        <OrgPanel title={t('org.analytics.teamCompare')}>
          <OrgTable
            columns={[
              { key: 'name', label: t('org.analytics.team') },
              { key: 'member_count', label: t('org.analytics.members') },
              { key: 'average_score', label: t('org.exams.avg'), render: (r) => (r.average_score == null ? '—' : `${r.average_score}%`) },
              { key: 'completion_rate', label: t('org.teams.completion'), render: (r) => `${r.completion_rate ?? 0}%` },
            ]}
            rows={data?.teams || []}
            empty={<OrgEmpty>{t('org.analytics.noTeamResults')}</OrgEmpty>}
          />
        </OrgPanel>
      )}
    </OrgPage>
  )
}
