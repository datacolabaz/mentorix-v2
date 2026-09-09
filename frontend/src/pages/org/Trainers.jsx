import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import ListSkeleton from '../../components/common/ListSkeleton'
import PhoneInput from '../../components/auth/PhoneInput'
import { useToast } from '../../components/common/Toast'
import { useOrgWorkspace } from '../../hooks/useOrgWorkspace'
import OrgPage, { OrgPanel, OrgEmpty, OrgTable } from '../../components/org/OrgPage'
import StatusBadge from '../../components/common/StatusBadge'
import { formatOrgDateTime, orgLifecycleLabel, orgRoleName } from '../../lib/orgI18n'

export default function OrgTrainers() {
  const { t, i18n } = useTranslation()
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
  const [removeTarget, setRemoveTarget] = useState(null)
  const [removeBusy, setRemoveBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    return Promise.all([
      api.get('/course/teachers'),
      can('teams.view') ? api.get('/course/teams') : Promise.resolve({ teams: [] }),
      can('roles.manage') ? api.get('/course/roles') : Promise.resolve({ roles: [] }),
    ])
      .then(([te, tm, r]) => {
        setRows(te.teachers || [])
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
      toast(t('org.common.phoneInvalid'), 'error')
      return
    }
    setBusy(true)
    try {
      await api.post('/course/teachers', { phone: digits })
      toast(t('org.trainers.invited'))
      setOpen(false)
      setPhone('')
      load()
    } catch (err) {
      toast(err?.message || t('org.trainers.addFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function act(id, body) {
    try {
      await api.patch(`/course/teachers/${id}`, body)
      load()
    } catch (err) {
      toast(err?.message || t('org.common.failed'), 'error')
    }
  }

  async function remove() {
    const id = removeTarget
    if (!id) return
    setRemoveBusy(true)
    try {
      await api.delete(`/course/teachers/${id}`)
      setRemoveTarget(null)
      load()
    } catch (err) {
      toast(err?.message || t('org.trainers.deleted'), 'error')
    } finally {
      setRemoveBusy(false)
    }
  }

  async function viewActivity(id) {
    try {
      const res = await api.get(`/course/teachers/${id}/activity`)
      setActivity(res)
    } catch (err) {
      toast(err?.message || t('org.common.loadFailed'), 'error')
    }
  }

  return (
    <OrgPage
      title={t('org.trainers.title')}
      description={t('org.trainers.desc')}
      actions={can('trainers.invite') ? <Button onClick={() => setOpen(true)}>+ {t('org.trainers.invite')}</Button> : null}
    >
      {loading ? (
        <ListSkeleton />
      ) : (
        <OrgPanel>
          <OrgTable
            columns={[
              { key: 'full_name', label: t('org.trainers.name') },
              { key: 'phone', label: t('org.trainers.phone'), render: (r) => r.phone || '—' },
              {
                key: 'is_active',
                label: t('org.trainers.status'),
                render: (r) => (
                  <StatusBadge variant={r.is_active ? 'paid' : 'neutral'}>
                    {r.is_active ? t('org.trainers.active') : t('org.trainers.suspended')}
                  </StatusBadge>
                ),
              },
              { key: 'team_name', label: t('org.trainers.team'), render: (r) => r.team_name || '—' },
              {
                key: 'role_key',
                label: t('org.trainers.role'),
                render: (r) => orgRoleName(t, r.role_key, r.role_key || 'instructor'),
              },
              { key: 'created_assessments_count', label: t('org.trainers.assessments') },
              {
                key: 'last_activity_at',
                label: t('org.trainers.activity'),
                render: (r) => formatOrgDateTime(r.last_activity_at, i18n.language),
              },
              {
                key: 'actions',
                label: '',
                render: (r) =>
                  can('trainers.manage') ? (
                    <div className="flex flex-wrap gap-1">
                      <Button variant="ghost" onClick={() => viewActivity(r.id)}>
                        {t('org.trainers.viewActivity')}
                      </Button>
                      {can('teams.edit') ? (
                        <select
                          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs"
                          value={r.team_id || ''}
                          onChange={(e) => act(r.id, { team_id: e.target.value || null })}
                        >
                          <option value="">{t('org.trainers.team')}</option>
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
                              {orgRoleName(t, x.key, x.name_az)}
                            </option>
                          ))}
                        </select>
                      ) : null}
                      <Button
                        variant="ghost"
                        onClick={() => act(r.id, { action: r.is_active ? 'suspend' : 'activate' })}
                      >
                        {r.is_active ? t('org.trainers.suspend') : t('org.trainers.activate')}
                      </Button>
                      <Button variant="ghost" onClick={() => setRemoveTarget(r.id)}>
                        {t('org.trainers.remove')}
                      </Button>
                    </div>
                  ) : null,
              },
            ]}
            rows={rows}
            empty={<OrgEmpty>{t('org.trainers.empty')}</OrgEmpty>}
          />
        </OrgPanel>
      )}

      <Modal open={!!activity} onClose={() => setActivity(null)} title={t('org.trainers.activityTitle')} size="lg">
        <OrgTable
          columns={[
            { key: 'title', label: t('org.trainers.exam') },
            {
              key: 'lifecycle',
              label: t('org.trainers.status'),
              render: (r) => orgLifecycleLabel(t, r.lifecycle),
            },
          ]}
          rows={activity?.created_assessments || []}
          empty={<OrgEmpty>{t('org.trainers.noExams')}</OrgEmpty>}
        />
      </Modal>

      <Modal open={open} onClose={() => !busy && setOpen(false)} title={t('org.trainers.invite')} size="md">
        <form onSubmit={(e) => void invite(e)} className="space-y-5">
          <p className="text-sm text-token-textMuted">{t('org.trainers.modalHint')}</p>
          <PhoneInput value={phone} onChange={setPhone} required autoFocus />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              {t('org.common.cancel')}
            </Button>
            <Button type="submit" loading={busy}>
              {t('org.trainers.searchAdd')}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onClose={() => !removeBusy && setRemoveTarget(null)}
        onConfirm={() => void remove()}
        title={t('org.trainers.remove')}
        message={t('org.trainers.removeConfirm')}
        confirmLabel={t('org.trainers.remove')}
        cancelLabel={t('org.common.cancel')}
        loading={removeBusy}
        danger
      />
    </OrgPage>
  )
}
