import { useCallback, useEffect, useState } from 'react'
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

export default function OrgTrainers() {
  const toast = useToast()
  const { can } = useOrgWorkspace()
  const [rows, setRows] = useState([])
  const [teams, setTeams] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [activity, setActivity] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    return Promise.all([
      api.get('/course/teachers'),
      can('teams.view') ? api.get('/course/teams') : Promise.resolve({ teams: [] }),
      can('roles.manage') ? api.get('/course/roles') : Promise.resolve({ roles: [] }),
    ])
      .then(([t, tm, r]) => {
        setRows(t.teachers || [])
        setTeams(tm.teams || [])
        setRoles(r.roles || [])
      })
      .finally(() => setLoading(false))
  }, [can])

  useEffect(() => {
    load()
  }, [load])

  async function invite(e) {
    e.preventDefault()
    const digits = String(phone || '').replace(/\D/g, '')
    if (digits.length < 9) {
      toast('Telefon nömrəsini düzgün daxil edin', 'error')
      return
    }
    setBusy(true)
    try {
      await api.post('/course/teachers', { phone: digits })
      toast('Müəllim heyətə əlavə edildi')
      setOpen(false)
      setPhone('')
      load()
    } catch (err) {
      toast(err?.message || 'Əlavə edilmədi', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function act(id, body) {
    try {
      await api.patch(`/course/teachers/${id}`, body)
      load()
    } catch (err) {
      toast(err?.message || 'Alınmadı', 'error')
    }
  }

  async function remove(id) {
    if (!window.confirm('Müəllimi təşkilat heyətindən silmək?')) return
    try {
      await api.delete(`/course/teachers/${id}`)
      load()
    } catch (err) {
      toast(err?.message || 'Silinmədi', 'error')
    }
  }

  async function viewActivity(id) {
    try {
      const res = await api.get(`/course/teachers/${id}/activity`)
      setActivity(res)
    } catch (err) {
      toast(err?.message || 'Yüklənmədi', 'error')
    }
  }

  return (
    <OrgPage
      title="Müəllimlər / Təlimçilər"
      description="Təşkilat heyətindəki instructor və trainer-lər. Onların şəxsi dərs paneli ayrı qalır — burada yalnız təşkilat idarəetməsi var."
      actions={can('trainers.invite') ? <Button onClick={() => setOpen(true)}>+ Müəllim dəvət et</Button> : null}
    >
      {loading ? (
        <ListSkeleton />
      ) : (
        <OrgPanel>
          <OrgTable
            columns={[
              { key: 'full_name', label: 'Ad' },
              { key: 'phone', label: 'Telefon', render: (r) => r.phone || '—' },
              {
                key: 'is_active',
                label: 'Status',
                render: (r) => (
                  <StatusBadge variant={r.is_active ? 'paid' : 'neutral'}>
                    {r.is_active ? 'Aktiv' : 'Dayandırılıb'}
                  </StatusBadge>
                ),
              },
              { key: 'team_name', label: 'Komanda', render: (r) => r.team_name || '—' },
              { key: 'role_key', label: 'Rol', render: (r) => r.role_key || 'instructor' },
              { key: 'created_assessments_count', label: 'Qiymətləndirmələr' },
              { key: 'last_activity_at', label: 'Aktivlik', render: (r) => fmtWhen(r.last_activity_at) },
              {
                key: 'actions',
                label: '',
                render: (r) =>
                  can('trainers.manage') ? (
                    <div className="flex flex-wrap gap-1">
                      <Button variant="ghost" onClick={() => viewActivity(r.id)}>
                        Aktivlik
                      </Button>
                      {can('teams.edit') ? (
                        <select
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs"
                          value={r.team_id || ''}
                          onChange={(e) => act(r.id, { team_id: e.target.value || null })}
                        >
                          <option value="">Komanda</option>
                          {teams.map((x) => (
                            <option key={x.id} value={x.id}>
                              {x.name}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      {can('roles.manage') ? (
                        <select
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs"
                          value={r.role_key || 'instructor'}
                          onChange={(e) => act(r.id, { role_key: e.target.value })}
                        >
                          {roles.filter((x) => x.key !== 'owner').map((x) => (
                            <option key={x.key} value={x.key}>
                              {x.name_az}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      <Button
                        variant="ghost"
                        onClick={() => act(r.id, { action: r.is_active ? 'suspend' : 'activate' })}
                      >
                        {r.is_active ? 'Dayandır' : 'Aktiv et'}
                      </Button>
                      <Button variant="ghost" onClick={() => remove(r.id)}>
                        Sil
                      </Button>
                    </div>
                  ) : null,
              },
            ]}
            rows={rows}
            empty={<OrgEmpty>Hələ təşkilat müəllimi yoxdur. Platformada qeydiyyatlı təlimçini telefon ilə dəvət edin.</OrgEmpty>}
          />
        </OrgPanel>
      )}

      <Modal open={!!activity} onClose={() => setActivity(null)} title="Yaradılan qiymətləndirmələr" size="lg">
        <OrgTable
          columns={[
            { key: 'title', label: 'İmtahan' },
            { key: 'lifecycle', label: 'Status' },
          ]}
          rows={activity?.created_assessments || []}
          empty={<OrgEmpty>Bu təlimçinin təşkilat imtahanı yoxdur.</OrgEmpty>}
        />
      </Modal>

      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Müəllim dəvət et" size="md">
        <form onSubmit={(e) => void invite(e)} className="space-y-5">
          <p className="text-sm text-token-textMuted">
            Müəllimin platformada qeydiyyatdan keçdiyi telefon nömrəsini daxil edin.
          </p>
          <PhoneInput value={phone} onChange={setPhone} required autoFocus />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
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
