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
      toast('Komanda yaradıldı')
      setOpen(false)
      setForm({ name: '', description: '' })
      load()
    } catch (err) {
      toast(err?.message || 'Yaradılmadı', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <OrgPage
      title={t('org.teams.title', { defaultValue: 'Komandalar' })}
      description={t('org.teams.desc', {
        defaultValue: 'Təşkilati struktur (məs. Sales, Marketing). Qruplar komandanın altındakı cohort / assessment toplusudur.',
      })}
      actions={can('teams.create') ? <Button onClick={() => setOpen(true)}>+ Komanda yarat</Button> : null}
    >
      {loading ? (
        <ListSkeleton />
      ) : (
        <OrgPanel>
          <OrgTable
            columns={[
              {
                key: 'name',
                label: 'Komanda',
                render: (r) => (
                  <Link to={`/org/teams/${r.id}`} className="text-emerald-300 hover:underline font-medium">
                    {r.name}
                  </Link>
                ),
              },
              { key: 'member_count', label: 'İştirakçılar' },
              { key: 'trainer_count', label: 'Təlimçilər' },
              { key: 'average_score', label: 'Orta', render: (r) => (r.average_score == null ? '—' : `${r.average_score}%`) },
              { key: 'completion_rate', label: 'Tamamlanma', render: (r) => `${r.completion_rate ?? 0}%` },
            ]}
            rows={teams}
            empty={<OrgEmpty>Hələ komanda yoxdur.</OrgEmpty>}
          />
        </OrgPanel>
      )}
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Yeni komanda" size="md">
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
            placeholder="Təsvir (istəyə bağlı)"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
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

export function OrgTeamDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [team, setTeam] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    api
      .get(`/course/teams/${id}`)
      .then((res) => setTeam(res.team))
      .catch((err) => setError(err?.message || 'Tapılmadı'))
  }, [id])

  if (error) {
    return (
      <OrgPage title="Komanda">
        <OrgEmpty>{error}</OrgEmpty>
      </OrgPage>
    )
  }
  if (!team) {
    return (
      <OrgPage title="Komanda">
        <ListSkeleton />
      </OrgPage>
    )
  }

  return (
    <OrgPage
      title={team.name}
      description={team.description || 'Komanda detalları'}
      actions={
        <Button variant="secondary" onClick={() => navigate('/org/teams')}>
          Geri
        </Button>
      }
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard title="İştirakçılar" value={String(team.participant_count ?? team.members?.length ?? 0)} />
        <KpiCard title="Orta nəticə" value={team.average_score == null ? '—' : `${team.average_score}%`} />
        <KpiCard title="Tamamlanma" value={`${team.completion_rate ?? 0}%`} />
        <KpiCard title="Qruplar" value={String(team.groups?.length ?? 0)} />
      </div>
      <OrgPanel title="Üzvlər">
        <OrgTable
          columns={[
            { key: 'full_name', label: 'Ad' },
            { key: 'member_kind', label: 'Növ' },
            { key: 'phone', label: 'Telefon', render: (r) => r.phone || '—' },
          ]}
          rows={team.members || []}
          empty={<OrgEmpty>Üzv yoxdur.</OrgEmpty>}
        />
      </OrgPanel>
      <OrgPanel title="Qruplar">
        <OrgTable
          columns={[{ key: 'name', label: 'Qrup' }]}
          rows={team.groups || []}
          empty={<OrgEmpty>Bu komandaya bağlı qrup yoxdur.</OrgEmpty>}
        />
      </OrgPanel>
    </OrgPage>
  )
}

export default OrgTeams
