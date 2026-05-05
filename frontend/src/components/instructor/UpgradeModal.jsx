import { useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import api from '../../lib/api'
import { SUBSCRIPTION_PLANS } from '../../constants/subscriptionPlans'

export default function UpgradeModal({ open, onClose, onSelectPlan }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  return (
    <Modal open={open} onClose={onClose} title="Upgrade" size="lg">
      <div className="space-y-4">
        {err ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-100 px-4 py-3 text-sm">
            {err}
          </div>
        ) : null}
        <p className="text-sm text-token-textMuted">
          Plan seçin və Payriff ilə ödəniş edin. Ödəniş uğurlu olarsa plan dərhal aktivləşəcək.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SUBSCRIPTION_PLANS.map((p) => (
            <div
              key={p.id}
              className={[
                'rounded-2xl border p-4',
                p.highlight
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-[color:var(--border-subtle)] bg-token-surfaceCard/40',
              ].join(' ')}
            >
              <div className="text-sm font-bold text-token-textMain">{p.title}</div>
              <div className="text-xs text-token-textMuted mt-1">{p.price}</div>
              <ul className="mt-3 space-y-1 text-xs text-token-textMain">
                {p.items.map((x) => (
                  <li key={x} className="flex items-center gap-2">
                    <span className="text-token-textMuted">•</span>
                    <span>{x}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4">
                <Button
                  className="w-full justify-center"
                  variant={p.highlight ? 'primary' : 'secondary'}
                  loading={busy}
                  disabled={busy}
                  onClick={async () => {
                    setErr(null)
                    setBusy(true)
                    try {
                      const r = await api.post('/billing/create-payment', { plan: p.id })
                      const url = r?.payment?.payment_url
                      if (!url) throw new Error('Ödəniş linki alınmadı')
                      onSelectPlan?.(p.id)
                      window.location.href = url
                    } catch (e) {
                      setErr(e?.message || 'Ödəniş yaradılmadı')
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  {p.highlight ? 'Upgrade to PRO' : 'Choose'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  )
}

