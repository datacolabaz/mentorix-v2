import Modal from '../common/Modal'
import Button from '../common/Button'
import { formatAzn } from '../../lib/pricing'
import { formatStorageBytesHuman, storagePackHeadline, storagePackPeriodLabel } from '../../lib/storageAddonDisplay'
import {
  extraStorageBytes,
  planStorageByteLimit,
  storageUsageFromBilling,
} from '../../lib/billingUsageDisplay'

export default function StorageAddonModal({
  open,
  onClose,
  packs = [],
  billing = null,
  busy = false,
  onSelectPack,
}) {
  const usage = storageUsageFromBilling(billing)
  const planBase = planStorageByteLimit(billing)
  const extraB = extraStorageBytes(billing)
  const effectiveB = billing?.limits?.storage_limit_bytes

  return (
    <Modal open={open} onClose={() => !busy && onClose()} title="Əlavə yaddaş al" size="md">
      <div className="space-y-4">
        <p className="text-sm text-token-textMuted leading-relaxed">
          Seçdiyiniz həcm cari paket limitinizə <strong className="text-token-textMain">əlavə olunur</strong> (məs.
          PRO 256 MB + 1 GB = ~1,3 GB aktiv limit). Ödəniş təsdiqlənəndən sonra fayl yükləmələri yeni limitə görə
          yoxlanır.
        </p>

        {effectiveB != null ? (
          <div className="rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain/50 px-3 py-2.5 text-xs space-y-1">
            <div className="flex justify-between gap-2">
              <span className="text-token-textMuted">Paket limiti</span>
              <span className="text-token-textMain font-medium tabular-nums">
                {planBase != null ? formatStorageBytesHuman(planBase) : '—'}
              </span>
            </div>
            {extraB > 0 ? (
              <div className="flex justify-between gap-2">
                <span className="text-token-textMuted">Təsdiqlənmiş əlavə</span>
                <span className="text-emerald-600 dark:text-emerald-300 font-medium tabular-nums">
                  +{formatStorageBytesHuman(extraB)}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between gap-2 border-t border-[color:var(--border-subtle)]/60 pt-1">
              <span className="text-token-textMuted">Cari aktiv limit</span>
              <span className="text-token-textMain font-semibold tabular-nums">
                {formatStorageBytesHuman(effectiveB)}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-token-textMuted">İstifadə</span>
              <span className="text-token-textMain tabular-nums">{usage.label}</span>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          {packs.filter(Boolean).map((pack) => {
            const headline = storagePackHeadline(pack)
            const period = storagePackPeriodLabel(pack)
            const afterB =
              effectiveB != null && Number.isFinite(Number(effectiveB))
                ? Number(effectiveB) + (Number(pack.quantity_mb) || 0) * 1024 * 1024
                : null
            return (
              <button
                key={pack.quantity_mb}
                type="button"
                disabled={busy}
                onClick={() => onSelectPack?.(pack)}
                className={[
                  'w-full text-left rounded-2xl border p-4 transition-colors',
                  'border-[color:var(--border-subtle)] hover:border-primary/40 hover:bg-primary/5',
                  'disabled:opacity-50 disabled:pointer-events-none',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display font-bold text-token-textMain">{headline}</div>
                    {afterB != null ? (
                      <p className="text-[11px] text-token-textMuted mt-1">
                        Yeni limit təxminən:{' '}
                        <span className="text-token-textMain font-medium">{formatStorageBytesHuman(afterB)}</span>
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-bold text-token-textMain tabular-nums">
                      {formatAzn(pack.price_azn)} AZN
                    </div>
                    {period ? (
                      <div className="text-[11px] font-medium text-token-textMuted">{period}</div>
                    ) : null}
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {!packs.length ? (
          <p className="text-sm text-token-textMuted text-center py-4">Əlavə yaddaş paketləri hazırda mövcud deyil.</p>
        ) : null}

        <Button type="button" variant="secondary" className="w-full justify-center" disabled={busy} onClick={onClose}>
          Bağla
        </Button>
      </div>
    </Modal>
  )
}
