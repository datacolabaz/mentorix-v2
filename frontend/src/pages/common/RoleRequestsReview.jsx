import { useCallback, useEffect, useState } from 'react'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import FilterTabs from '../../components/common/FilterTabs'
import { useToast } from '../../components/common/Toast'
import { fmtAzBakuYmdHm } from '../../lib/azDatetime'
import { ROLE_REQUEST_STATUS_LABELS } from '../../lib/roleAccess'
import OrganizationRequestsReview from './OrganizationRequestsReview'

const STATUS_TABS = [
  { id: 'pending', label: 'Gözləyən' },
  { id: 'approved', label: 'Təsdiqlənən' },
  { id: 'rejected', label: 'Rədd edilən' },
  { id: 'all', label: 'Hamısı' },
]

const STATUS_STYLE = {
  pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  approved: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  rejected: 'bg-red-500/15 text-red-600 dark:text-red-300',
  cancelled: 'bg-black/5 dark:bg-white/10 text-token-textMuted',
}

const SOURCE_LABELS = {
  onboarding: 'Qeydiyyat',
  settings: 'Profil',
  workspace_switch: 'Kabinet keçidi',
  organization: 'Təşkilat',
}

/**
 * Teacher permission requests. Platform admins see every request; organization admins see only requests
 * addressed to their organization (the API enforces the scope — this page only renders what it gets).
 */
const KIND_TABS = [
  { id: 'teachers', label: 'Müəllim icazələri' },
  { id: 'organizations', label: 'Təşkilat sorğuları' },
]

function initialKind() {
  try {
    return new URLSearchParams(window.location.search).get('tab') === 'organizations' ? 'organizations' : 'teachers'
  } catch {
    return 'teachers'
  }
}

/** Platform admins also review «Təşkilat yarat» requests here (?tab=organizations). */
export default function RoleRequestsReview({ scopeHint = 'platform' }) {
  const [kind, setKind] = useState(scopeHint === 'platform' ? initialKind : 'teachers')
  const changeKind = (next) => {
    setKind(next)
    try {
      const url = new URL(window.location.href)
      if (next === 'organizations') url.searchParams.set('tab', 'organizations')
      else url.searchParams.delete('tab')
      window.history.replaceState(window.history.state, '', url)
    } catch {
      /* ignore */
    }
  }
  if (scopeHint !== 'platform') return <TeacherRequestsReview scopeHint={scopeHint} />
  return (
    <div className="p-4 sm:p-6 space-y-5 min-w-0">
      <div>
        <h1 className="font-display font-bold text-2xl text-token-textMain">İcazə sorğuları</h1>
      </div>
      <div className="inline-flex rounded-xl border border-[color:var(--border-subtle)] p-1 gap-1" role="tablist" aria-label="Sorğu növü">
        {KIND_TABS.map((k) => (
          <button
            key={k.id}
            type="button"
            role="tab"
            aria-selected={kind === k.id}
            onClick={() => changeKind(k.id)}
            className={[
              'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors min-h-[36px]',
              kind === k.id ? 'bg-primary/12 text-brand-text' : 'text-token-textMuted hover:text-token-textMain',
            ].join(' ')}
          >
            {k.label}
          </button>
        ))}
      </div>
      {kind === 'organizations' ? <OrganizationRequestsReview /> : <TeacherRequestsReview scopeHint={scopeHint} embedded />}
    </div>
  )
}

function TeacherRequestsReview({ scopeHint = 'platform', embedded = false }) {
  const toast = useToast()
  const [status, setStatus] = useState('pending')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rejecting, setRejecting] = useState(null)
  const [reason, setReason] = useState('')
  const [busyId, setBusyId] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const d = await api.get(`/role-requests?status=${encodeURIComponent(status)}`)
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
      await api.post(`/role-requests/${r.id}/approve`, {})
      toast(`${r.user?.full_name || 'İstifadəçi'}: müəllim icazəsi verildi`, 'success')
      await load()
    } catch (e) {
      toast(e?.message || 'Təsdiq alınmadı', 'error')
    } finally {
      setBusyId(null)
    }
  }

  const confirmReject = async () => {
    if (!rejecting) return
    setBusyId(rejecting.id)
    try {
      await api.post(`/role-requests/${rejecting.id}/reject`, { reason: reason.trim() || undefined })
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
    <div className={embedded ? 'space-y-5 min-w-0' : 'p-4 sm:p-6 space-y-5 min-w-0'}>
      <div>
        {embedded ? null : <h1 className="font-display font-bold text-2xl text-token-textMain">Müəllim icazəsi sorğuları</h1>}
        <p className="text-token-textMuted text-sm mt-1 max-w-2xl">
          {scopeHint === 'organization'
            ? 'Təşkilatınıza müəllim kimi qoşulmaq istəyənlər. Təsdiqlənən istifadəçi müəllim kabinetinə keçə bilir və təşkilata müəllim kimi əlavə olunur.'
            : 'İstifadəçilər profildə müəllim kabinetinə sərbəst keçə bilmir — müəllim icazəsi buradan verilir. Təsdiqdən sonra istifadəçi özü müəllim kabinetinə keçir.'}
        </p>
      </div>

      <FilterTabs tabs={STATUS_TABS} activeId={status} onChange={setStatus} />

      {error ? (
        <Card className="p-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-red-500">{error}</p>
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            Yenidən cəhd et
          </Button>
        </Card>
      ) : null}

      <Card className="divide-y divide-[color:var(--border-subtle)]">
        {loading ? (
          <div className="p-5 space-y-3" role="status">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-black/5 dark:bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : requests.length === 0 ? (
          <p className="p-6 text-sm text-token-textMuted text-center">
            {status === 'pending' ? 'Gözləyən sorğu yoxdur.' : 'Sorğu tapılmadı.'}
          </p>
        ) : (
          requests.map((r) => (
            <div key={r.id} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6" data-testid="role-request-row">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-token-textMain">{r.user?.full_name || 'İstifadəçi'}</span>
                  <span className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold ${STATUS_STYLE[r.status] || ''}`}>
                    {ROLE_REQUEST_STATUS_LABELS[r.status] || r.status}
                  </span>
                  {r.organization_name ? (
                    <span className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300">
                      {r.organization_name}
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-token-textMuted break-all">
                  {r.user?.email || '—'} · {SOURCE_LABELS[r.source] || r.source} · {fmtAzBakuYmdHm(r.created_at)}
                </p>
                {r.note ? <p className="text-sm text-token-textMain whitespace-pre-wrap">«{r.note}»</p> : null}
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
        title="Sorğunu rədd et"
        size="sm"
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
            className="mt-1 w-full rounded-xl border border-token-border bg-token-bg px-3 py-2 text-sm"
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
