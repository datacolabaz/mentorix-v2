import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ListSkeleton from '../../components/common/ListSkeleton'
import PhoneInput from '../../components/auth/PhoneInput'
import { useToast } from '../../components/common/Toast'
import { useOrgWorkspace } from '../../hooks/useOrgWorkspace'
import OrgPage, { OrgPanel, OrgEmpty, OrgTable } from '../../components/org/OrgPage'
import StatusBadge from '../../components/common/StatusBadge'
import { formatOrgDateTime, orgAssessmentStatus } from '../../lib/orgI18n'

export default function OrgParticipants() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { can } = useOrgWorkspace()
  const [rows, setRows] = useState([])
  const [teams, setTeams] = useState([])
  const [groups, setGroups] = useState([])
  const [exams, setExams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState([])
  const [filters, setFilters] = useState({
    q: '',
    team_id: '',
    group_id: '',
    status: '',
    assessment_status: '',
  })
  const [addOpen, setAddOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [bulkTeam, setBulkTeam] = useState('')
  const [bulkExam, setBulkExam] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v)
    })
    return Promise.all([
      api.get(`/course/participants?${params.toString()}`),
      can('teams.view') ? api.get('/course/teams') : Promise.resolve({ teams: [] }),
      can('groups.view') ? api.get('/course/groups') : Promise.resolve({ groups: [] }),
      can('assessments.view') ? api.get('/course/exams') : Promise.resolve({ exams: [] }),
    ])
      .then(([p, tRes, gRes, eRes]) => {
        setRows(Array.isArray(p.participants) ? p.participants : [])
        setTeams(Array.isArray(tRes.teams) ? tRes.teams : [])
        setGroups(Array.isArray(gRes.groups) ? gRes.groups : [])
        setExams(Array.isArray(eRes.exams) ? eRes.exams : [])
        setError(null)
      })
      .catch((err) => {
        setError(err?.message || t('org.common.loadFailed'))
        setRows([])
      })
      .finally(() => setLoading(false))
  }, [filters, can, t])

  useEffect(() => {
    load()
  }, [load])

  const allSelected = rows.length > 0 && selected.length === rows.length

  function toggleAll() {
    setSelected(allSelected ? [] : rows.map((r) => r.id))
  }

  async function addParticipant(e) {
    e.preventDefault()
    const digits = String(phone || '').replace(/\D/g, '')
    if (digits.length < 9) {
      toast(t('org.common.phoneInvalid'), 'error')
      return
    }
    setBusy(true)
    try {
      await api.post('/course/students', { phone: digits })
      toast(t('org.participants.added'))
      setAddOpen(false)
      setPhone('')
      load()
    } catch (err) {
      toast(err?.message || t('org.participants.addFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function bulk(action, extra = {}) {
    if (!selected.length) {
      toast(t('org.participants.select'), 'error')
      return
    }
    setBusy(true)
    try {
      await api.post('/course/participants/bulk', { action, participant_ids: selected, ...extra })
      toast(t('org.common.done'))
      setSelected([])
      load()
    } catch (err) {
      toast(err?.message || t('org.common.failed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  function exportCsv() {
    const token = localStorage.getItem('mx_token')
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params.set(k, v)
    })
    fetch(`/api/course/participants/export?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'istirakcilar.csv'
        a.click()
        URL.revokeObjectURL(url)
      })
  }

  const filteredHint = useMemo(
    () => t('org.participants.count', { count: rows.length }),
    [rows.length, t],
  )

  return (
    <OrgPage
      title={t('org.participants.title')}
      description={t('org.participants.desc')}
      actions={
        <>
          {can('reports.export') ? (
            <Button variant="secondary" onClick={exportCsv}>
              {t('org.common.export')}
            </Button>
          ) : null}
          {can('users.create') ? <Button onClick={() => setAddOpen(true)}>+ {t('org.participants.add')}</Button> : null}
        </>
      }
    >
      {error ? <p className="text-sm text-red-300/90">{error}</p> : null}

      <OrgPanel>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
          <input
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            placeholder={t('org.common.search')}
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
          <select
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            value={filters.team_id}
            onChange={(e) => setFilters((f) => ({ ...f, team_id: e.target.value }))}
          >
            <option value="">{t('org.participants.allTeams')}</option>
            {teams.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            value={filters.group_id}
            onChange={(e) => setFilters((f) => ({ ...f, group_id: e.target.value }))}
          >
            <option value="">{t('org.participants.allGroups')}</option>
            {groups.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">{t('org.participants.allStatuses')}</option>
            <option value="active">{t('org.participants.active')}</option>
            <option value="inactive">{t('org.participants.inactive')}</option>
          </select>
          <select
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            value={filters.assessment_status}
            onChange={(e) => setFilters((f) => ({ ...f, assessment_status: e.target.value }))}
          >
            <option value="">{t('org.participants.allAssessments')}</option>
            <option value="none">{t('org.assessmentStatus.none')}</option>
            <option value="assigned">{t('org.assessmentStatus.assigned')}</option>
            <option value="in_progress">{t('org.assessmentStatus.in_progress')}</option>
            <option value="completed">{t('org.assessmentStatus.completed')}</option>
          </select>
        </div>
        <p className="text-[11px] text-token-textMuted mb-3">{filteredHint}</p>

        {can('users.edit') && selected.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-3">
            <select
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              value={bulkTeam}
              onChange={(e) => setBulkTeam(e.target.value)}
            >
              <option value="">{t('org.participants.addToTeam')}</option>
              {teams.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              disabled={!bulkTeam || busy}
              onClick={() => bulk('add_to_team', { team_id: bulkTeam })}
            >
              {t('org.participants.addToTeam')}
            </Button>
            <select
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              value={bulkExam}
              onChange={(e) => setBulkExam(e.target.value)}
            >
              <option value="">{t('org.participants.assignAssessment')}</option>
              {exams.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.title}
                </option>
              ))}
            </select>
            <Button
              variant="secondary"
              disabled={!bulkExam || busy}
              onClick={() => bulk('assign_assessment', { exam_id: bulkExam })}
            >
              {t('org.participants.assign')}
            </Button>
            {can('users.delete') ? (
              <Button variant="ghost" disabled={busy} onClick={() => bulk('archive')}>
                {t('org.participants.archive')}
              </Button>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <ListSkeleton />
        ) : (
          <OrgTable
            columns={[
              {
                key: 'select',
                label: (
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                ),
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
              { key: 'full_name', label: t('org.participants.name') },
              { key: 'team_name', label: t('org.participants.team'), render: (r) => r.team_name || '—' },
              { key: 'group_name', label: t('org.participants.group'), render: (r) => r.group_name || '—' },
              {
                key: 'is_active',
                label: t('org.participants.status'),
                render: (r) => (
                  <StatusBadge variant={r.is_active ? 'paid' : 'neutral'}>
                    {r.is_active ? t('org.participants.active') : t('org.participants.inactive')}
                  </StatusBadge>
                ),
              },
              {
                key: 'assessment_status',
                label: t('org.participants.assessment'),
                render: (r) => orgAssessmentStatus(t, r.assessment_status),
              },
              { key: 'avg_score', label: t('org.participants.score'), render: (r) => (r.avg_score == null ? '—' : `${r.avg_score}%`) },
              {
                key: 'last_activity_at',
                label: t('org.participants.lastActivity'),
                render: (r) => formatOrgDateTime(r.last_activity_at, i18n.language),
              },
            ]}
            rows={rows}
            empty={<OrgEmpty>{t('org.participants.empty')}</OrgEmpty>}
          />
        )}
      </OrgPanel>

      <p className="text-xs text-token-textMuted">{t('org.participants.inviteHint')}</p>

      <Modal open={addOpen} onClose={() => !busy && setAddOpen(false)} title={t('org.participants.add')} size="md">
        <form onSubmit={(e) => void addParticipant(e)} className="space-y-5">
          <p className="text-sm text-token-textMuted">{t('org.participants.modalHint')}</p>
          <PhoneInput value={phone} onChange={setPhone} required autoFocus />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setAddOpen(false)}>
              {t('org.common.cancel')}
            </Button>
            <Button type="submit" loading={busy}>
              {t('org.participants.searchAdd')}
            </Button>
          </div>
        </form>
      </Modal>
    </OrgPage>
  )
}
