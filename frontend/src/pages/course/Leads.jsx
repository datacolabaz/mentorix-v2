import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ListSkeleton from '../../components/common/ListSkeleton'
import StatusBadge from '../../components/common/StatusBadge'

const STATUS_LABELS = {
  new: 'Yeni',
  contacted: 'Əlaqə saxlanıldı',
  trial_scheduled: 'Sınaq planlaşdırılıb',
  trial_done: 'Sınaq keçib',
  thinking: 'Düşünür',
  won: 'Qazanıldı',
  lost: 'İmtina',
}

const STATUS_OPTIONS = Object.entries(STATUS_LABELS)

const emptyLead = {
  full_name: '',
  phone: '',
  source: 'manual',
  status: 'new',
  notes: '',
}

export default function CourseLeads() {
  const [leads, setLeads] = useState([])
  const [statuses, setStatuses] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyLead)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    const q = filter ? `?status=${encodeURIComponent(filter)}` : ''
    api
      .get(`/course/leads${q}`)
      .then((res) => {
        setLeads(res.leads || [])
        setStatuses(res.statuses || [])
      })
      .catch((err) => {
        setError(err?.message || 'Yüklənmədi')
        setLeads([])
      })
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  async function saveLead(e) {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post('/course/leads', form)
      setModalOpen(false)
      setForm(emptyLead)
      load()
    } catch (err) {
      setError(err?.message || 'Saxlanılmadı')
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(lead, status) {
    try {
      await api.patch(`/course/leads/${lead.id}`, { status })
      load()
    } catch (err) {
      setError(err?.message || 'Status yenilənmədi')
    }
  }

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-6xl mx-auto w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain">Lidlər</h1>
          <p className="text-token-textMuted text-sm mt-1 max-w-xl">
            Yalnız bu kursa aid maraqlananlar. Fərdi müəllim tələbələriniz burada görünmür — qeydiyyatdan sonra
            &quot;Tələbələr&quot; bölməsinə köçürülür.
          </p>
        </div>
        <Button onClick={() => setModalOpen(true)}>+ Lead əlavə et</Button>
      </div>

      {error ? (
        <p className="text-sm text-red-300/90" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter('')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
            !filter ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200' : 'border-white/10 text-token-textMuted'
          }`}
        >
          Hamısı
        </button>
        {STATUS_OPTIONS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${
              filter === value
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                : 'border-white/10 text-token-textMuted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <ListSkeleton />
      ) : leads.length === 0 ? (
        <Card className="p-8 border border-white/10 text-center">
          <p className="text-token-textMuted text-sm">Bu filtrdə lead yoxdur. İlk maraqlananı əlavə edin.</p>
        </Card>
      ) : (
        <Card className="border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase text-token-textMuted">
                  <th className="p-3 font-semibold">Ad</th>
                  <th className="p-3 font-semibold">Telefon</th>
                  <th className="p-3 font-semibold">Mənbə</th>
                  <th className="p-3 font-semibold">Status</th>
                  <th className="p-3 font-semibold">Əməl</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-3 text-white font-medium">{lead.full_name}</td>
                    <td className="p-3 text-token-textMuted tabular-nums">{lead.phone || '—'}</td>
                    <td className="p-3 text-token-textMuted">{lead.source || '—'}</td>
                    <td className="p-3">
                      <StatusBadge variant="pending">{STATUS_LABELS[lead.status] || lead.status}</StatusBadge>
                    </td>
                    <td className="p-3">
                      <select
                        className="bg-surface-1 border border-white/10 rounded-lg px-2 py-1 text-xs text-white"
                        value={lead.status}
                        onChange={(e) => changeStatus(lead, e.target.value)}
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABELS[s] || s}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Yeni lead" size="md">
        <form onSubmit={saveLead} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-xs text-token-textMuted uppercase">Ad *</span>
            <input
              required
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-token-textMuted uppercase">Telefon</span>
            <input
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-token-textMuted uppercase">Mənbə</span>
            <select
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              value={form.source}
              onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
            >
              <option value="manual">Əl ilə</option>
              <option value="website">Sayt</option>
              <option value="instagram">Instagram</option>
              <option value="referral">Tövsiyə</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-token-textMuted uppercase">Qeyd</span>
            <textarea
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
              Ləğv
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Saxlanır…' : 'Saxla'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
