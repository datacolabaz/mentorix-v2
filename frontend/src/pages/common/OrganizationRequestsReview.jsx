import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import FilterTabs from '../../components/common/FilterTabs'
import { useToast } from '../../components/common/Toast'
import { fmtAzBakuYmdHm } from '../../lib/azDatetime'
import { ORG_TYPE_OPTIONS } from '../../components/common/CreateOrganizationModal'

const STATUS_TABS = [
  { id: 'pending', label: 'Gözləyən' },
  { id: 'approved', label: 'Təsdiqlənən' },
  { id: 'rejected', label: 'Rədd edilən' },
  { id: 'all', label: 'Hamısı' },
]
const STATUS_LABELS = { pending: 'Gözləyir', approved: 'Təsdiqlənib', rejected: 'Rədd edilib', cancelled: 'Ləğv edilib' }
const STATUS_STYLE = {
  pending: 'bg-warning-subtle text-warning',
  approved: 'bg-success-subtle text-success',
  rejected: 'bg-error-subtle text-error',
  cancelled: 'bg-token-surfaceCardHover text-token-textMuted',
}
const TYPE_LABELS = Object.fromEntries(ORG_TYPE_OPTIONS.map((o) => [o.id, o.label]))
const SOURCE_LABELS = { workspace: 'Kabinetlərim', onboarding: 'Qeydiyyat' }

/** Platform admin only — the API refuses everyone else; approval creates the organization atomically. */
export default function OrganizationRequestsReview() {
  const toast = useToast()
  const [status, setStatus] = useState('pending')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [rejecting, setRejecting] = useState(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const d = await api.get(`/organization-requests?status=${encodeURIComponent(status)}`)
      setRequests(Array.isArray(d?.requests) ? d.requests : [])
    } catch (e) {
      setError(e?.message || 'Sorğular yüklənmədi')
      setRequests([])
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    void load()
  }, [load])

  const approve = async (r) => {
    setBusyId(r.id)
    try {
      await api.post(`/organization-requests/${r.id}/approve`, {})
      toast(`«${r.name}» təşkilatı yaradıldı`, 'success')
      await load()
    } catch (e) {
      toast(e?.message || 'Təsdiq alınmadı', 'error')
      if (e?.code === 'ALREADY_RESOLVED') await load()
    } finally {
      setBusyId(null)
    }
  }

  const confirmReject = async () => {
    if (!rejecting) return
    setBusyId(rejecting.id)
    try {
      await api.post(`/organization-requests/${rejecting.id}/reject`, { reason: reason.trim() || undefined })
      toast('Sorğu rədd edildi', 'success')
      setRejecting(null)
      setReason('')
      await load()
    } catch (e) {
      toast(e?.message || 'Rədd alınmadı', 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-5 min-w-0">
      <p className="text-token-textMuted text-sm max-w-2xl">
        Təşkilat yalnız buradan təsdiqlə yaranır. Təsdiqlənəndə sorğu sahibi təşkilatın sahibi olur və «Kabinetlərim»
        bölməsində təşkilat kabineti açılır. Müəllim rolu təşkilata giriş vermir.
      </p>

      <FilterTabs tabs={STATUS_TABS} activeId={status} onChange={setStatus} />

      {error ? (
        <Card className="p-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-error">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            Yenidən cəhd et
          </Button>
        </Card>
      ) : null}

      <Card className="divide-y divide-[color:var(--border-subtle)]">
        {loading && requests.length === 0 ? (
          <div className="p-5 space-y-3" role="status">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-token-surfaceCardHover animate-pulse" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <p className="p-6 text-sm text-token-textMuted text-center">
            {status === 'pending' ? 'Gözləyən təşkilat sorğusu yoxdur.' : 'Sorğu tapılmadı.'}
          </p>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6" data-testid="org-request-row">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-token-textMain break-words">{r.name}</span>
                  <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-info-subtle text-info">
                    {TYPE_LABELS[r.org_type] || r.org_type}
                  </span>
                  <span className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold ${STATUS_STYLE[r.status] || ''}`}>
                    {STATUS_LABELS[r.status] || r.status}
                  </span>
                </div>
                <p className="text-xs text-token-textMuted break-words">
                  {r.user?.full_name || 'İstifadəçi'} · {r.user?.email || '—'} · {SOURCE_LABELS[r.source] || r.source} ·{' '}
                  {fmtAzBakuYmdHm(r.created_at)}
                </p>
                {r.description ? <p className="text-sm text-token-textMain whitespace-pre-wrap">«{r.description}»</p> : null}
                {r.status !== 'pending' && r.reviewed_at ? (
                  <p className="text-xs text-token-textMuted">
                    {r.reviewed_by_name || 'Admin'} · {fmtAzBakuYmdHm(r.reviewed_at)}
                    {r.review_reason ? ` · ${r.review_reason}` : ''}
                  </p>
                ) : null}
              </div>
              {r.status === 'pending' ? (
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" loading={busyId === r.id} onClick={() => void approve(r)}>
                    Təsdiqlə
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busyId === r.id}
                    onClick={() => {
                      setRejecting(r)
                      setReason('')
                    }}
                  >
                    Rədd et
                  </Button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </Card>

      <Modal
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title="Təşkilat sorğusunu rədd et"
        size="sm"
        closeLabel="Bağla"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Bağla
            </Button>
            <Button variant="danger" loading={busyId === rejecting?.id} onClick={() => void confirmReject()}>
              Rədd et
            </Button>
          </div>
        }
      >
        <label className="block text-sm text-token-textMain">
          Səbəb (istifadəçiyə göstərilir, istəyə bağlı)
          <textarea
            className="mt-1 w-full rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard px-3 py-2 text-sm"
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </Modal>
    </div>
  )
}
