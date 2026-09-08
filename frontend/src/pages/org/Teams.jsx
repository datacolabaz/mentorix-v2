import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ListSkeleton from '../../components/common/ListSkeleton'
import { useToast } from '../../components/common/Toast'
import { useOrgWorkspace } from '../../hooks/useOrgWorkspace'
import OrgPage, { OrgPanel, OrgEmpty, OrgTable } from '../../components/org/OrgPage'
import KpiCard from '../../components/common/KpiCard'
import { orgMemberKind } from '../../lib/orgI18n'

export function OrgTeams() {
  const { t } = useTranslation()
  const toast = useToast()
  const { can } = useOrgWorkspace()
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    return api
      .get('/course/teams')
      .then((res) => setTeams(Array.isArray(res.teams) ? res.teams : []))
      .catch(() => setTeams([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post('/course/teams', form)
      toast(t('org.teams.created'))
      setOpen(false)
      setForm({ name: '', description: '' })
      load()
    } catch (err) {
      toast(err?.message || t('org.common.createFailed'), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <OrgPage
      title={t('org.teams.title')}
      description={t('org.teams.desc')}
      actions={can('teams.create') ? <Button onClick={() => setOpen(true)}>+ {t('org.teams.create')}</Button> : null}
    >
      {loading ? (
        <ListSkeleton />
      ) : (
        <OrgPanel>
          <OrgTable
            columns={[
              {
                key: 'name',
                label: t('org.teams.name'),
                render: (r) => (
                  <Link to={`/org/teams/${r.id}`} className="text-emerald-300 hover:underline font-medium">
                    {r.name}
                  </Link>
                ),
              },
              { key: 'member_count', label: t('org.teams.participantsKpi') },
              { key: 'trainer_count', label: t('org.teams.trainers') },
              { key: 'average_score', label: t('org.teams.avg'), render: (r) => (r.average_score == null ? '—' : `${r.average_score}%`) },
              { key: 'completion_rate', label: t('org.teams.completion'), render: (r) => `${r.completion_rate ?? 0}%` },
            ]}
            rows={teams}
            empty={<OrgEmpty>{t('org.teams.empty')}</OrgEmpty>}
          />
        </OrgPanel>
      )}
      <Modal open={open} onClose={() => !busy && setOpen(false)} title={t('org.teams.newTitle')} size="md">
        <form onSubmit={(e) => void create(e)} className="space-y-4">
          <input
            required
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
            placeholder="Sales"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <textarea
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm min-h-[88px]"
            placeholder={t('org.teams.descPlaceholder')}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t('org.common.cancel')}
            </Button>
            <Button type="submit" loading={busy}>
              {t('org.common.save')}
            </Button>
          </div>
        </form>
      </Modal>
    </OrgPage>
  )
}

export function OrgTeamDetail() {
  const { t } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const [team, setTeam] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .get(`/course/teams/${id}`)
      .then((res) => setTeam(res.team))
      .catch((err) => setError(err?.message || t('org.common.notFound')))
  }, [id, t])

  if (error) {
    return (
      <OrgPage title={t('org.teams.title')}>
        <OrgEmpty>{error}</OrgEmpty>
      </OrgPage>
    )
  }
  if (!team) {
    return (
      <OrgPage title={t('org.teams.title')}>
        <ListSkeleton />
      </OrgPage>
    )
  }

  return (
    <OrgPage
      title={team.name}
      description={team.description || t('org.teams.detailFallback')}
      actions={
        <Button variant="secondary" onClick={() => navigate('/org/teams')}>
          {t('org.common.back')}
        </Button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title={t('org.teams.participantsKpi')} value={String(team.participant_count ?? team.members?.length ?? 0)} />
        <KpiCard title={t('org.teams.avgKpi')} value={team.average_score == null ? '—' : `${team.average_score}%`} />
        <KpiCard title={t('org.teams.completionKpi')} value={`${team.completion_rate ?? 0}%`} />
        <KpiCard title={t('org.teams.groupsKpi')} value={String(team.groups?.length ?? 0)} />
      </div>
      <OrgPanel title={t('org.teams.membersPanel')}>
        <OrgTable
          columns={[
            { key: 'full_name', label: t('org.participants.name') },
            { key: 'member_kind', label: t('org.trainers.role'), render: (r) => orgMemberKind(t, r.member_kind) },
            { key: 'phone', label: t('org.trainers.phone'), render: (r) => r.phone || '—' },
          ]}
          rows={team.members || []}
          empty={<OrgEmpty>{t('org.teams.noMembers')}</OrgEmpty>}
        />
      </OrgPanel>
      <OrgPanel title={t('org.teams.groupsPanel')}>
        <OrgTable
          columns={[{ key: 'name', label: t('org.groups.name') }]}
          rows={team.groups || []}
          empty={<OrgEmpty>{t('org.teams.noGroups')}</OrgEmpty>}
        />
      </OrgPanel>
    </OrgPage>
  )
}

export default OrgTeams
