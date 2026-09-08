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

function fmtWhen(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('az-AZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

const ASSESSMENT_LABEL = {
  none: 'Təyin olunmayıb',
  assigned: 'Təyin edilib',
  in_progress: 'Davam edir',
  completed: 'Tamamlanıb',
}

export default function OrgParticipants() {
  const { t } = useTranslation()
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
        setError(err?.message || 'Yüklənmədi')
        setRows([])
      })
      .finally(() => setLoading(false))
  }, [filters, can])

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
      toast('Telefon nömrəsini düzgün daxil edin', 'error')
      return
    }
    setBusy(true)
    try {
      await api.post('/course/students', { phone: digits })
      toast(t('org.participants.added', { defaultValue: 'İştirakçı əlavə edildi' }))
      setAddOpen(false)
      setPhone('')
      load()
    } catch (err) {
      toast(err?.message || 'Əlavə edilmədi', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function bulk(action, extra = {}) {
    if (!selected.length) {
      toast('İştirakçı seçin', 'error')
      return
    }
    setBusy(true)
    try {
      await api.post('/course/participants/bulk', { action, participant_ids: selected, ...extra })
      toast('Əməliyyat tamamlandı')
      setSelected([])
      load()
    } catch (err) {
      toast(err?.message || 'Alınmadı', 'error')
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

  const filteredHint = useMemo(() => `${rows.length} iştirakçı`, [rows.length])

  return (
    <OrgPage
      title={t('org.participants.title', { defaultValue: 'İştirakçılar' })}
      description={t('org.participants.desc', {
        defaultValue: 'Təşkilat üzrə bütün iştirakçılar. Tələbə, namizəd və ya əməkdaş eyni siyahıda idarə olunur.',
      })}
      actions={
        <>
          {can('reports.export') ? (
            <Button variant="secondary" onClick={exportCsv}>
              Export
            </Button>
          ) : null}
          {can('users.create') ? <Button onClick={() => setAddOpen(true)}>+ İştirakçı əlavə et</Button> : null}
        </>
      }
    >
      {error ? <p className="text-sm text-red-300/90">{error}</p> : null}

      <OrgPanel>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 mb-4">
          <input
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            placeholder="Axtarış"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
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
            value={filters.group_id}
            onChange={(e) => setFilters((f) => ({ ...f, group_id: e.target.value }))}
          >
            <option value="">Qrup</option>
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
            <option value="">Status</option>
            <option value="active">Aktiv</option>
            <option value="inactive">Deaktiv</option>
          </select>
          <select
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            value={filters.assessment_status}
            onChange={(e) => setFilters((f) => ({ ...f, assessment_status: e.target.value }))}
          >
            <option value="">Qiymətləndirmə</option>
            <option value="none">Təyin olunmayıb</option>
            <option value="assigned">Təyin edilib</option>
            <option value="in_progress">Davam edir</option>
            <option value="completed">Tamamlanıb</option>
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
              <option value="">Komandaya əlavə et</option>
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
              Komandaya əlavə et
            </Button>
            <select
              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
              value={bulkExam}
              onChange={(e) => setBulkExam(e.target.value)}
            >
              <option value="">Assessment təyin et</option>
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
              Təyin et
            </Button>
            {can('users.delete') ? (
              <Button variant="ghost" disabled={busy} onClick={() => bulk('archive')}>
                Archive
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
              { key: 'full_name', label: 'Ad' },
              { key: 'team_name', label: 'Komanda', render: (r) => r.team_name || '—' },
              { key: 'group_name', label: 'Qrup', render: (r) => r.group_name || '—' },
              {
                key: 'is_active',
                label: 'Status',
                render: (r) => (
                  <StatusBadge variant={r.is_active ? 'paid' : 'neutral'}>{r.is_active ? 'Aktiv' : 'Deaktiv'}</StatusBadge>
                ),
              },
              {
                key: 'assessment_status',
                label: 'Qiymətləndirmə',
                render: (r) => ASSESSMENT_LABEL[r.assessment_status] || r.assessment_status,
              },
              { key: 'avg_score', label: 'Nəticə', render: (r) => (r.avg_score == null ? '—' : `${r.avg_score}%`) },
              { key: 'last_activity_at', label: 'Son aktivlik', render: (r) => fmtWhen(r.last_activity_at) },
            ]}
            rows={rows}
            empty={<OrgEmpty>Hələ iştirakçı yoxdur. Platformada qeydiyyatlı şəxsi telefon ilə əlavə edin.</OrgEmpty>}
          />
        )}
      </OrgPanel>

      <p className="text-xs text-token-textMuted">
        Dəvət e-poçtu ayrıca göndərilmir — iştirakçı artıq platformada qeydiyyatda olmalıdır.
      </p>

      <Modal open={addOpen} onClose={() => !busy && setAddOpen(false)} title="İştirakçı əlavə et" size="md">
        <form onSubmit={(e) => void addParticipant(e)} className="space-y-5">
          <p className="text-sm text-token-textMuted">İştirakçının platformada qeydiyyatdan keçdiyi telefon nömrəsini daxil edin.</p>
          <PhoneInput value={phone} onChange={setPhone} required autoFocus />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setAddOpen(false)}>
              Ləğv
            </Button>
            <Button type="submit" loading={busy}>
              Axtar və əlavə et
            </Button>
          </div>
        </form>
      </Modal>
    </OrgPage>
  )
}
