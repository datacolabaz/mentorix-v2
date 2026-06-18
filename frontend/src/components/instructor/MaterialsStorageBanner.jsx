import { Link } from 'react-router-dom'
import {
  MATERIALS_STORAGE_LIMIT_MESSAGE,
  formatMaterialsBytes,
  materialsUsagePercent,
} from '../../lib/materialsPlanLimits'

export default function MaterialsStorageBanner({ quota, onUpgrade }) {
  if (!quota?.limit_reached) return null

  const pct = materialsUsagePercent(quota)

  return (
    <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-sm font-semibold text-amber-100">{MATERIALS_STORAGE_LIMIT_MESSAGE}</p>
          <p className="text-xs text-amber-200/80">
            İstifadə: {quota.labels?.used || formatMaterialsBytes(quota.usage?.used_bytes)} /{' '}
            {quota.labels?.limit || '—'}
            {quota.limits?.max_files != null ? ` · ${quota.usage?.file_count || 0}/${quota.limits.max_files} fayl` : ''}
          </p>
          {quota.limits?.storage_bytes != null ? (
            <div className="h-1.5 rounded-full bg-black/30 overflow-hidden max-w-md">
              <div
                className="h-full rounded-full bg-amber-400 transition-all"
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
          ) : null}
        </div>
        <div className="shrink-0 flex gap-2">
          {onUpgrade ? (
            <button
              type="button"
              onClick={onUpgrade}
              className="px-4 py-2 rounded-xl bg-primary text-[#041018] text-sm font-semibold hover:brightness-110"
            >
              Paketi yenilə
            </button>
          ) : (
            <Link
              to="/instructor/settings?tab=plans"
              className="px-4 py-2 rounded-xl bg-primary text-[#041018] text-sm font-semibold hover:brightness-110"
            >
              Paketlərə bax
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
