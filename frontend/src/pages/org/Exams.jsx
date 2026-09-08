import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import ListSkeleton from '../../components/common/ListSkeleton'
import { useOrgWorkspace } from '../../hooks/useOrgWorkspace'
import OrgPage, { OrgPanel, OrgEmpty, OrgTable } from '../../components/org/OrgPage'
import StatusBadge from '../../components/common/StatusBadge'

const FILTERS = [
  { id: 'all', label: 'Hamısı' },
  { id: 'draft', label: 'Draft' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'archived', label: 'Archived' },
]

function badge(lifecycle) {
  if (lifecycle === 'active') return 'paid'
  if (lifecycle === 'scheduled') return 'pending'
  if (lifecycle === 'completed') return 'neutral'
  if (lifecycle === 'archived') return 'danger'
  return 'due'
}

function fmtWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('az-AZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

export default function OrgExams({ assessmentView = false }) {
  const { can } = useOrgWorkspace()
  const [status, setStatus] = useState('all')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState([])

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
      title={assessmentView ? 'Qiymətləndirmələr' : 'İmtahanlar'}
      description={
        assessmentView
          ? 'Assessment: test, suallar, vaxt, scoring və iştirakçı təyinatı. Təşkilat müəllimlərinin imtahanları burada birləşir.'
          : 'Təşkilat imtahanları — bütün heyət təlimçilərinin imtahanları. “Mənim imtahanlarım” deyil.'
      }
      actions={
        can('reports.export') ? (
          <Button variant="secondary" onClick={exportCsv}>
            Export
          </Button>
        ) : null
      }
    >
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
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
              { key: 'title', label: 'Ad' },
              { key: 'created_by', label: 'Müəllif' },
              { key: 'participants', label: 'İştirakçılar' },
              { key: 'completion', label: 'Tamamlanma', render: (r) => `${r.completion ?? 0}%` },
              { key: 'average_score', label: 'Orta', render: (r) => (r.average_score == null ? '—' : `${r.average_score}%`) },
              { key: 'available_from', label: 'Tarix', render: (r) => fmtWhen(r.available_from || r.start_time) },
              {
                key: 'lifecycle',
                label: 'Status',
                render: (r) => <StatusBadge variant={badge(r.lifecycle)}>{r.lifecycle}</StatusBadge>,
              },
            ]}
            rows={rows}
            empty={
              <OrgEmpty>
                Təşkilat müəllimlərinin imtahanları burada görünür. Yeni imtahanı müəllim öz panelindən yaradır.
              </OrgEmpty>
            }
          />
        )}
      </OrgPanel>
    </OrgPage>
  )
}
