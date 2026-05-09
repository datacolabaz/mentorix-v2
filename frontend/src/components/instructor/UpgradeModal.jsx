import { useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import api from '../../lib/api'
import { useSubscriptionPlans } from '../../hooks/useSubscriptionPlans'
import useUiStore from '../../hooks/useUi'
import PricingBillingIntervalToggle from './PricingBillingIntervalToggle'
import { formatAzn, yearlyTotalAzn, YEARLY_DISCOUNT } from '../../lib/pricing'

function planRank(s) {
  const v = String(s || '').toLowerCase()
  if (v === 'business') return 3
  if (v === 'pro') return 2
  return 1
}

export default function UpgradeModal({ open, onClose, onSelectPlan, currentPlan }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [billingInterval, setBillingInterval] = useState('yearly')
  const { theme } = useUiStore()
  const plansQ = useSubscriptionPlans()
  const plans = Array.isArray(plansQ.data) ? plansQ.data : []
  const curRank = planRank(currentPlan)

  function priceLines(p) {
    const pid = String(p?.id || '').toLowerCase()
    const monthly = Number(p?.price_azn)
    const isPaid = pid !== 'basic' && Number.isFinite(monthly) && monthly > 0
    if (!isPaid)
      return { line1: 'Pulsuz', line2: null, suffix: '', isPaid: false, amountLabel: '', periodLabel: '' }
    if (billingInterval === 'monthly') {
      return {
        line1: `${formatAzn(monthly)} AZN`,
        suffix: '/ay',
        line2: 'İllik seçərək 20% qənaət üçün Tənzimləmələr səhifəsində illik seçin.',
        isPaid: true,
        amountLabel: `${formatAzn(monthly)} AZN`,
        periodLabel: '(aylıq)',
      }
    }
    const y = yearlyTotalAzn(monthly, YEARLY_DISCOUNT)
    return {
      line1: `${formatAzn(y)} AZN`,
      suffix: '/il',
      line2: `≈ ${formatAzn(monthly)} AZN/ay qarşılığında (12 ay, −${Math.round(YEARLY_DISCOUNT * 100)}%)`,
      isPaid: true,
      amountLabel: `${formatAzn(y)} AZN`,
      periodLabel: '(illik)',
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Paket yüksəlt" size="lg">
      <div className="space-y-4">
        {err ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-100 px-4 py-3 text-sm">
            {err}
          </div>
        ) : null}
        <p className="text-sm text-token-textMuted">
          Plan seçin və ödənişi tamamlayın. Əməliyyat uğurlu olarsa paket dərhal aktivləşəcək.
        </p>
        <PricingBillingIntervalToggle value={billingInterval} onChange={setBillingInterval} theme={theme} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {plans.map((p) => {
            const pr = priceLines(p)
            const tgtRank = planRank(p.id)
            const canPay = pr.isPaid && tgtRank > curRank
            return (
              <div
                key={p.id}
                className={[
                  'rounded-2xl border p-4 transition-[opacity,transform] duration-200 ease-out',
                  p.highlight
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-[color:var(--border-subtle)] bg-token-surfaceCard/40',
                ].join(' ')}
              >
                <div className="text-sm font-bold text-token-textMain">{p.title}</div>
                <div className="mt-1 flex flex-wrap items-baseline gap-1">
                  <span className="text-base font-bold text-token-textMain">{pr.line1}</span>
                  {pr.suffix ? (
                    <span className="text-xs font-medium text-token-textMuted">{pr.suffix}</span>
                  ) : null}
                </div>
                {pr.line2 ? (
                  <p className="mt-1 text-[11px] leading-snug text-token-textMuted">{pr.line2}</p>
                ) : null}
                <div className="mt-4">
                  {tgtRank <= curRank ? (
                    <div className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                      Cari və ya daha aşağı paket
                    </div>
                  ) : null}
                  <Button
                    className="w-full justify-center"
                    variant={p.highlight ? 'primary' : 'secondary'}
                    loading={busy}
                    disabled={busy || !canPay}
                    onClick={async () => {
                      setErr(null)
                      setBusy(true)
                      try {
                        const r = await api.post('/billing/create-payment', {
                          plan: p.id,
                          interval: billingInterval,
                        })
                        const url = r?.payment?.payment_url
                        if (!url) throw new Error('Ödəniş linki alınmadı')
                        onSelectPlan?.(p.id)
                        window.location.href = url
                      } catch (e) {
                        const msg =
                          e?.message === 'PLAN_NOT_UPGRADE'
                            ? 'Bu paket yüksəltmə sayılmır. Ətraflı plan seçin.'
                            : e?.message || 'Ödəniş yaradılmadı'
                        setErr(msg)
                      } finally {
                        setBusy(false)
                      }
                    }}
                  >
                    {!pr.isPaid
                      ? '—'
                      : !canPay
                        ? 'Seçilə bilməz'
                        : tgtRank > curRank
                          ? `Upgrade et ${pr.periodLabel}`.trim()
                          : 'Seçilə bilməz'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
