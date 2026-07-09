import { useTranslation } from 'react-i18next'
import {
  AZ_REGIONS,
  BAKU_DISTRICTS,
  isBakuRegion,
} from '@shared/azerbaijanRegions.mjs'

export default function RegionSearchFilter({
  region,
  bakuDistrict,
  includeNeighbors,
  onChange,
}) {
  const { t } = useTranslation()
  const showBakuDistricts = isBakuRegion(region)

  const patch = (partial) => onChange?.({ region, bakuDistrict, includeNeighbors, ...partial })

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1.5">
          {t('marketplace.filters.regionTitle')}
        </label>
        <select
          className="w-full rounded-xl border border-white/15 bg-[#13112e] px-3 py-2 text-sm text-white"
          value={region || ''}
          onChange={(e) => {
            const next = e.target.value
            patch({
              region: next,
              bakuDistrict: isBakuRegion(next) ? bakuDistrict : null,
            })
          }}
        >
          <option value="">{t('marketplace.filters.regionPlaceholder')}</option>
          {AZ_REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      {showBakuDistricts ? (
        <div>
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1.5">
            {t('marketplace.filters.bakuDistrictTitle')}
          </label>
          <select
            className="w-full rounded-xl border border-white/15 bg-[#13112e] px-3 py-2 text-sm text-white"
            value={bakuDistrict || ''}
            onChange={(e) => patch({ bakuDistrict: e.target.value || null })}
          >
            <option value="">{t('marketplace.filters.bakuDistrictPlaceholder')}</option>
            {BAKU_DISTRICTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {showBakuDistricts && bakuDistrict ? (
        <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-300">
          <input
            type="checkbox"
            checked={Boolean(includeNeighbors)}
            onChange={(e) => patch({ includeNeighbors: e.target.checked })}
            className="accent-primary rounded"
          />
          {t('marketplace.filters.includeNeighbors')}
        </label>
      ) : null}
    </div>
  )
}
