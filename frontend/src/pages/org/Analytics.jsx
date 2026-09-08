import { useEffect, useState } from 'react'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import KpiCard from '../../components/common/KpiCard'
import { useOrgWorkspace } from '../../hooks/useOrgWorkspace'
import OrgPage, { OrgPanel, OrgEmpty, OrgTable } from '../../components/org/OrgPage'

export default function OrgAnalytics({ focus = 'overview' }) {
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
      ? 'İmtahan nəticələri'
      : focus === 'participants'
        ? 'İştirakçı performansı'
        : focus === 'teams'
          ? 'Komanda nəticələri'
          : focus === 'reports'
            ? 'Hesabatlar'
            : 'Ümumi analitika'

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
      description="Təşkilat analitikası fərdi müəllim statistikasından ayrıdır: participation, completion, komanda müqayisəsi."
      actions={
        can('reports.export') ? (
          <Button variant="secondary" onClick={exportCsv}>
            Export
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
          <option value="">Komanda</option>
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
          <option value="">Müəllim</option>
          {trainers.map((x) => (
            <option key={x.id} value={x.id}>
              {x.full_name}
            </option>
          ))}
        </select>
      </div>

      {focus === 'overview' || focus === 'reports' ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <KpiCard title="Participation" value={String(summary.participation ?? 0)} />
          <KpiCard title="Completion" value={String(summary.completion ?? 0)} />
          <KpiCard title="Orta nəticə" value={summary.average_score == null ? '—' : `${summary.average_score}%`} />
        </div>
      ) : null}

      {focus === 'overview' ? (
        <OrgPanel title="Nəticə paylanması">
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
            <OrgEmpty>Paylanma üçün nəticə yoxdur.</OrgEmpty>
          )}
        </OrgPanel>
      ) : null}

      {(focus === 'exams' || focus === 'overview' || focus === 'reports') && (
        <OrgPanel title="Qiymətləndirmə performansı">
          <OrgTable
            columns={[
              { key: 'name', label: 'İmtahan' },
              { key: 'created_by', label: 'Müəllim' },
              { key: 'participants', label: 'İştirak' },
              { key: 'completion', label: '%' },
              { key: 'average_score', label: 'Orta', render: (r) => (r.average_score == null ? '—' : `${r.average_score}%`) },
            ]}
            rows={data?.assessments || []}
            empty={<OrgEmpty>İmtahan nəticəsi yoxdur.</OrgEmpty>}
          />
        </OrgPanel>
      )}

      {(focus === 'participants' || focus === 'overview' || focus === 'reports') && (
        <OrgPanel title="İştirakçı performansı">
          <OrgTable
            columns={[
              { key: 'name', label: 'İştirakçı' },
              { key: 'team_name', label: 'Komanda', render: (r) => r.team_name || '—' },
              { key: 'group_name', label: 'Qrup', render: (r) => r.group_name || '—' },
              { key: 'avg_score', label: 'Nəticə', render: (r) => (r.avg_score == null ? '—' : `${r.avg_score}%`) },
              { key: 'assessment_status', label: 'Status' },
            ]}
            rows={data?.participants || []}
            empty={<OrgEmpty>İştirakçı nəticəsi yoxdur.</OrgEmpty>}
          />
        </OrgPanel>
      )}

      {(focus === 'teams' || focus === 'overview' || focus === 'reports') && (
        <OrgPanel title="Komanda müqayisəsi">
          <OrgTable
            columns={[
              { key: 'name', label: 'Komanda' },
              { key: 'member_count', label: 'Üzvlər' },
              { key: 'average_score', label: 'Orta', render: (r) => (r.average_score == null ? '—' : `${r.average_score}%`) },
              { key: 'completion_rate', label: 'Tamamlanma', render: (r) => `${r.completion_rate ?? 0}%` },
            ]}
            rows={data?.teams || []}
            empty={<OrgEmpty>Komanda nəticəsi yoxdur.</OrgEmpty>}
          />
        </OrgPanel>
      )}
    </OrgPage>
  )
}
