import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Modal from '../common/Modal'
import Button from '../common/Button'
import ConfirmDialog from '../common/ConfirmDialog'
import { useToast } from '../common/Toast'
import { fmtAzBakuYmdHm } from '../../lib/azDatetime'

export const INVITE_DURATIONS = [
  { id: '24h', label: '24 saat' },
  { id: '7d', label: '7 gün' },
  { id: '30d', label: '30 gün' },
  { id: 'custom', label: 'Xüsusi tarix' },
]

export const INVITE_STATUS = {
  active: { label: 'Aktiv', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  expired: { label: 'Müddəti bitib', cls: 'bg-black/5 dark:bg-white/10 text-token-textMuted' },
  exhausted: { label: 'Limit dolub', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  revoked: { label: 'Ləğv edilib', cls: 'bg-red-500/15 text-red-600 dark:text-red-300' },
}

/** datetime-local value (Baku wall clock) → ISO instant. Baku is UTC+4 without DST. */
export function bakuLocalToIso(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/)
  if (!m) return null
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - 4 * 3600 * 1000
  return new Date(ms).toISOString()
}

/**
 * Expiring, use-limited group invite links. Every rule (limit, expiry, one use per person) is enforced by
 * the server inside the join transaction; this modal only creates, lists and revokes the teacher's own links.
 */
export default function GroupInvitesModal({ open, onClose, group }) {
  const toast = useToast()
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [duration, setDuration] = useState('7d')
  const [customAt, setCustomAt] = useState('')
  const [maxUses, setMaxUses] = useState('30')
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState(null)
  const [revokeBusy, setRevokeBusy] = useState(false)
  const [logFor, setLogFor] = useState(null)
  const [log, setLog] = useState([])
  const [logLoading, setLogLoading] = useState(false)

  const load = useCallback(async () => {
    if (!group?.id) return
    setLoading(true)
    setError('')
    try {
      const d = await api.get(`/instructor/invites?group_id=${encodeURIComponent(group.id)}`)
      setInvites(Array.isArray(d?.invites) ? d.invites : [])
    } catch (e) {
      setError(e?.message || 'Linklər yüklənmədi')
    } finally {
      setLoading(false)
    }
  }, [group?.id])

  useEffect(() => {
    if (open) {
      setLogFor(null)
      void load()
    }
  }, [open, load])

  const create = async (e) => {
    e?.preventDefault?.()
    const body = { duration, max_uses: Number(maxUses), label: label.trim() || undefined }
    if (duration === 'custom') {
      const iso = bakuLocalToIso(customAt)
      if (!iso) {
        toast('Bitmə tarixini seçin', 'error')
        return
      }
      body.expires_at = iso
    }
    setCreating(true)
    try {
      const d = await api.post(`/instructor/groups/${encodeURIComponent(group.id)}/invites`, body)
      setLabel('')
      toast('Dəvət linki yaradıldı', 'success')
      if (d?.invite?.link) {
        try {
          await navigator.clipboard.writeText(d.invite.link)
          toast('Link kopyalandı', 'success')
        } catch {
          /* clipboard may be blocked — link stays visible in the list */
        }
      }
      await load()
    } catch (err) {
      toast(err?.message || 'Link yaradılmadı', 'error')
    } finally {
      setCreating(false)
    }
  }

  const copy = async (link) => {
    try {
      await navigator.clipboard.writeText(link)
      toast('Link kopyalandı', 'success')
    } catch {
      toast('Kopyalamaq alınmadı', 'error')
    }
  }

  const confirmRevoke = async () => {
    if (!revoking) return
    setRevokeBusy(true)
    try {
      await api.post(`/instructor/invites/${revoking.id}/revoke`, {})
      toast('Link ləğv edildi', 'success')
      setRevoking(null)
      await load()
    } catch (err) {
      toast(err?.message || 'Ləğv alınmadı', 'error')
    } finally {
      setRevokeBusy(false)
    }
  }

  const openLog = async (inv) => {
    if (logFor?.id === inv.id) {
      setLogFor(null)
      return
    }
    setLogFor(inv)
    setLogLoading(true)
    try {
      const d = await api.get(`/instructor/invites/${inv.id}/redemptions`)
      setLog(Array.isArray(d?.redemptions) ? d.redemptions : [])
    } catch (err) {
      toast(err?.message || 'Jurnal yüklənmədi', 'error')
      setLog([])
    } finally {
      setLogLoading(false)
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={`Dəvət linkləri — ${group?.name || 'Qrup'}`} size="lg" scrollBody>
        <form onSubmit={create} className="space-y-3" data-testid="invite-create-form">
          <p className="text-sm text-token-textMuted">
            Müddətli və limitli link. Müddət bitəndə, limit dolanda və ya ləğv edəndə link açılır, amma qoşulma olmur —
            «Bu dəvət linki artıq aktiv deyil» yazılır. Hər şəxs bir linkdən yalnız bir dəfə istifadə edə bilər.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-sm">
              <span className="block text-token-textMuted mb-1">Müddət</span>
              <select
                className="w-full rounded-xl border border-token-border bg-token-bg px-3 py-2 text-sm"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                aria-label="Müddət"
              >
                {INVITE_DURATIONS.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="block text-token-textMuted mb-1">İstifadə limiti (nəfər)</span>
              <input
                type="number"
                min={1}
                max={10000}
                step={1}
                required
                className="w-full rounded-xl border border-token-border bg-token-bg px-3 py-2 text-sm"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                aria-label="İstifadə limiti"
              />
            </label>
            <label className="text-sm">
              <span className="block text-token-textMuted mb-1">Ad (istəyə bağlı)</span>
              <input
                type="text"
                maxLength={120}
                placeholder="məs. Sentyabr axını"
                className="w-full rounded-xl border border-token-border bg-token-bg px-3 py-2 text-sm"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
          </div>
          {duration === 'custom' ? (
            <label className="text-sm block">
              <span className="block text-token-textMuted mb-1">Bitmə tarixi və saatı (Bakı vaxtı)</span>
              <input
                type="datetime-local"
                required
                className="w-full sm:w-auto rounded-xl border border-token-border bg-token-bg px-3 py-2 text-sm"
                value={customAt}
                onChange={(e) => setCustomAt(e.target.value)}
                aria-label="Bitmə tarixi"
              />
            </label>
          ) : null}
          <Button type="submit" loading={creating}>
            Link yarat
          </Button>
        </form>

        <div className="mt-6 space-y-2">
          <h3 className="font-semibold text-token-textMain">Linklər</h3>
          {error ? <p className="text-sm text-red-500">{error}</p> : null}
          {loading && !invites.length ? (
            <div className="h-14 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" role="status" />
          ) : invites.length === 0 ? (
            <p className="text-sm text-token-textMuted">Bu qrup üçün hələ müddətli link yoxdur.</p>
          ) : (
            <ul className="space-y-2">
              {invites.map((inv) => {
                const st = INVITE_STATUS[inv.status] || INVITE_STATUS.expired
                return (
                  <li key={inv.id} className="rounded-xl border border-token-border p-3 space-y-2" data-testid="invite-row">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{inv.token}</span>
                      <span className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
                      {inv.label ? <span className="text-xs text-token-textMuted">{inv.label}</span> : null}
                    </div>
                    <p className="text-xs text-token-textMuted">
                      {inv.used_count} / {inv.max_uses} istifadə · bitir: {fmtAzBakuYmdHm(inv.expires_at)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {inv.status === 'active' ? (
                        <Button size="sm" variant="secondary" onClick={() => void copy(inv.link)}>
                          Linki kopyala
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={() => void openLog(inv)}>
                        {logFor?.id === inv.id ? 'Jurnalı gizlət' : `Kim qoşulub (${inv.used_count})`}
                      </Button>
                      {inv.status !== 'revoked' ? (
                        <Button size="sm" variant="ghost" className="text-red-500" onClick={() => setRevoking(inv)}>
                          Ləğv et
                        </Button>
                      ) : null}
                    </div>
                    {logFor?.id === inv.id ? (
                      logLoading ? (
                        <div className="h-8 rounded-lg bg-black/5 dark:bg-white/5 animate-pulse" role="status" />
                      ) : log.length === 0 ? (
                        <p className="text-xs text-token-textMuted">Bu linklə hələ heç kim qoşulmayıb.</p>
                      ) : (
                        <ul className="text-xs divide-y divide-[color:var(--border-subtle)]" data-testid="invite-log">
                          {log.map((r) => (
                            <li key={r.id} className="py-1.5 flex justify-between gap-3">
                              <span className="truncate">
                                {r.full_name}
                                {r.email ? ` · ${r.email}` : ''}
                              </span>
                              <span className="text-token-textMuted shrink-0">{fmtAzBakuYmdHm(r.redeemed_at)}</span>
                            </li>
                          ))}
                        </ul>
                      )
                    ) : null}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </Modal>
      <ConfirmDialog
        open={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        onConfirm={() => void confirmRevoke()}
        title="Linki ləğv et"
        message="Bu linklə artıq heç kim qoşula bilməyəcək. Qoşulmuş tələbələr qrupda qalır."
        confirmLabel="Ləğv et"
        cancelLabel="Bağla"
        loading={revokeBusy}
        danger
      />
    </>
  )
}
