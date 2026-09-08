import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ListSkeleton from '../../components/common/ListSkeleton'
import { useToast } from '../../components/common/Toast'
import { useOrgWorkspace } from '../../hooks/useOrgWorkspace'
import OrgPage, { OrgPanel, OrgEmpty, OrgTable } from '../../components/org/OrgPage'

export default function OrgGroups() {
  const toast = useToast()
  const { can } = useOrgWorkspace()
  const [groups, setGroups] = useState([])
  const [teachers, setTeachers] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', instructor_user_id: '', team_id: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    return Promise.all([
      api.get('/course/groups'),
      api.get('/course/teachers').catch(() => ({ teachers: [] })),
      api.get('/course/teams').catch(() => ({ teams: [] })),
    ])
      .then(([g, t, tm]) => {
        setGroups(g.groups || [])
        setTeachers(t.teachers || [])
        setTeams(tm.teams || [])
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post('/course/groups', {
        name: form.name,
        instructor_user_id: form.instructor_user_id || null,
        team_id: form.team_id || null,
      })
      toast('Qrup yaradıldı')
      setOpen(false)
      setForm({ name: '', instructor_user_id: '', team_id: '' })
      load()
    } catch (err) {
      toast(err?.message || 'Yaradılmadı', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <OrgPage
      title="Qruplar"
      description="Qrup — assessment, cohort və ya müəyyən iştirakçı toplusu. Komanda isə daha böyük təşkilati strukturdur."
      actions={can('groups.create') ? <Button onClick={() => setOpen(true)}>+ Qrup yarat</Button> : null}
    >
      {loading ? (
        <ListSkeleton />
      ) : (
        <OrgPanel>
          <OrgTable
            columns={[
              { key: 'name', label: 'Qrup' },
              { key: 'team_name', label: 'Komanda', render: (r) => r.team_name || '—' },
              { key: 'instructor_name', label: 'Təlimçi', render: (r) => r.instructor_name || '—' },
              { key: 'member_count', label: 'İştirakçılar' },
            ]}
            rows={groups}
            empty={<OrgEmpty>Hələ qrup yoxdur. Məsələn: “New Employees” və ya “Assessment Group”.</OrgEmpty>}
          />
        </OrgPanel>
      )}
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Yeni qrup" size="md">
        <form onSubmit={(e) => void create(e)} className="space-y-4">
          <input
            required
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            placeholder="New Employees"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <select
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            value={form.team_id}
            onChange={(e) => setForm((f) => ({ ...f, team_id: e.target.value }))}
          >
            <option value="">Komanda (istəyə bağlı)</option>
            {teams.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
          <select
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            value={form.instructor_user_id}
            onChange={(e) => setForm((f) => ({ ...f, instructor_user_id: e.target.value }))}
          >
            <option value="">Təlimçi (istəyə bağlı)</option>
            {teachers.filter((x) => x.is_active !== false).map((x) => (
              <option key={x.id} value={x.id}>
                {x.full_name}
              </option>
            ))}
          </select>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Ləğv
            </Button>
            <Button type="submit" loading={busy}>
              Saxla
            </Button>
          </div>
        </form>
      </Modal>
    </OrgPage>
  )
}
