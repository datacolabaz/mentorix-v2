import { useEffect, useState } from 'react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { formatAzn } from '../../lib/pricing'
import { formatBankCardDisplay } from '../../lib/billingPaymentLabels'

export default function PaymentMethodModal({
  open,
  onClose,
  title = 'Ödəniş üsulu',
  subtitle,
  amountAzn,
  onConfirm,
  busy = false,
  manualAccount = '',
  payriffEnabled = false,
}) {
  const defaultMethod = 'cash'
  const [method, setMethod] = useState(defaultMethod)

  useEffect(() => {
    if (open) setMethod(defaultMethod)
  }, [open, defaultMethod])

  async function handleConfirm() {
    await onConfirm?.(method)
  }

  const amountLabel =
    amountAzn != null && Number.isFinite(Number(amountAzn))
      ? `${formatAzn(Number(amountAzn))} AZN`
      : null

  return (
    <Modal open={open} onClose={onClose} title={title} size="md">
      <div className="space-y-4">
        {subtitle ? <p className="text-sm text-token-textMuted leading-relaxed">{subtitle}</p> : null}
        {amountLabel ? (
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <div className="text-xs uppercase tracking-wider text-token-textMuted">Ödəniləcək məbləğ</div>
            <div className="text-xl font-display font-bold text-token-textMain mt-1">{amountLabel}</div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            disabled={!payriffEnabled}
            onClick={() => payriffEnabled && setMethod('card')}
            className={[
              'rounded-2xl border p-4 text-left transition-colors',
              !payriffEnabled ? 'opacity-50 cursor-not-allowed' : '',
              method === 'card'
                ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/30'
                : 'border-[color:var(--border-subtle)] hover:border-primary/25',
            ].join(' ')}
          >
            <div className="text-sm font-bold text-token-textMain">Onlayn kart</div>
            <p className="mt-1 text-[11px] leading-relaxed text-token-textMuted">
              {payriffEnabled
                ? 'Payriff ilə təhlükəsiz ödəniş. Uğurlu ödənişdən sonra avtomatik aktivləşir.'
                : 'Hazırda aktiv deyil — köçürmə ilə ödəyin.'}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setMethod('cash')}
            className={[
              'rounded-2xl border p-4 text-left transition-colors',
              method === 'cash'
                ? 'border-amber-500/50 bg-amber-500/10 ring-1 ring-amber-500/30'
                : 'border-[color:var(--border-subtle)] hover:border-amber-500/25',
            ].join(' ')}
          >
            <div className="text-sm font-bold text-token-textMain">Nağd / köçürmə</div>
            <p className="mt-1 text-[11px] leading-relaxed text-token-textMuted">
              Əl ilə köçürmə edin, admin təsdiqlədikdən sonra aktivləşəcək.
            </p>
          </button>
        </div>

        {method === 'cash' && manualAccount ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 space-y-2">
            <p className="text-xs text-token-textMuted">
              Aşağıdakı 16 rəqəmli bank kartına köçürün və adminə müraciət edin. Təsdiq gözləyən statusda qalacaq.
            </p>
            <div className="font-mono text-lg tracking-widest font-bold text-token-textMain select-all">
              {formatBankCardDisplay(manualAccount)}
            </div>
          </div>
        ) : null}

        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end pt-2">
          <Button type="button" variant="secondary" className="w-full sm:w-auto justify-center" onClick={onClose} disabled={busy}>
            Ləğv et
          </Button>
          <Button
            type="button"
            variant="primary"
            className="w-full sm:w-auto justify-center"
            loading={busy}
            onClick={() => void handleConfirm()}
          >
            {method === 'card' ? 'Kartla ödə' : 'Köçürməni təsdiqlə'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
