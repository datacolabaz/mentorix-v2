import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import ListSkeleton from '../../components/common/ListSkeleton'
import { useOrgWorkspace } from '../../hooks/useOrgWorkspace'
import OrgPage, { OrgPanel, OrgEmpty, OrgTable } from '../../components/org/OrgPage'
import StatusBadge from '../../components/common/StatusBadge'
import { formatOrgDateTime, orgLifecycleLabel } from '../../lib/orgI18n'

function badge(lifecycle) {
  if (lifecycle === 'active') return 'paid'
  if (lifecycle === 'scheduled') return 'pending'
  if (lifecycle === 'completed') return 'neutral'
  if (lifecycle === 'archived') return 'danger'
  return 'due'
}

export default function OrgExams({ assessmentView = false }) {
  const { t, i18n } = useTranslation()
  const { can } = useOrgWorkspace()
  const [status, setStatus] = useState('all')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([])

  const filters = useMemo(
    () => [
      { id: 'all', label: t('org.exams.filterAll') },
      { id: 'draft', label: t('org.lifecycle.draft') },
      { id: 'scheduled', label: t('org.lifecycle.scheduled') },
      { id: 'active', label: t('org.lifecycle.active') },
      { id: 'completed', label: t('org.lifecycle.completed') },
      { id: 'archived', label: t('org.lifecycle.archived') },
    ],
    [t],
  )

  const load = useCallback(() => {
    setLoading(true)
    const q = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''
    return api
      .get(`/course/exams${q}`)
      .then((res) => setRows(res.exams || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false))
  }, [status])

  useEffect(() => {
    load()
  }, [load])

  function exportCsv() {
    const token = localStorage.getItem('mx_token')
    const q = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : ''
    fetch(`/api/course/exams/export${q}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'teskilat-imtahanalari.csv'
        a.click()
        URL.revokeObjectURL(url)
      })
  }

  return (
    <OrgPage
      title={assessmentView ? t('org.exams.assessmentsTitle') : t('org.exams.title')}
      description={assessmentView ? t('org.exams.assessmentsDesc') : t('org.exams.desc')}
      actions={
        can('reports.export') ? (
          <Button variant="secondary" onClick={exportCsv}>
            {t('org.common.export')}
          </Button>
        ) : null
      }
    >
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setStatus(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${
              status === f.id ? 'border-primary bg-primary/15 text-emerald-200' : 'border-white/10 text-token-textMuted'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <OrgPanel>
        {loading ? (
          <ListSkeleton />
        ) : (
          <OrgTable
            columns={[
              {
                key: 'select',
                label: '',
                render: (r) => (
                  <input
                    type="checkbox"
                    checked={selected.includes(r.id)}
                    onChange={() =>
                      setSelected((s) => (s.includes(r.id) ? s.filter((id) => id !== r.id) : [...s, r.id]))
                    }
                  />
                ),
              },
              { key: 'title', label: t('org.exams.name') },
              { key: 'created_by', label: t('org.exams.createdBy') },
              { key: 'participants', label: t('org.exams.participants') },
              { key: 'completion', label: t('org.exams.completion'), render: (r) => `${r.completion ?? 0}%` },
              { key: 'average_score', label: t('org.exams.avg'), render: (r) => (r.average_score == null ? '—' : `${r.average_score}%`) },
              {
                key: 'available_from',
                label: t('org.exams.date'),
                render: (r) => formatOrgDateTime(r.available_from || r.start_time, i18n.language),
              },
              {
                key: 'lifecycle',
                label: t('org.exams.status'),
                render: (r) => <StatusBadge variant={badge(r.lifecycle)}>{orgLifecycleLabel(t, r.lifecycle)}</StatusBadge>,
              },
            ]}
            rows={rows}
            empty={<OrgEmpty>{t('org.exams.empty')}</OrgEmpty>}
          />
        )}
      </OrgPanel>
    </OrgPage>
  )
}
