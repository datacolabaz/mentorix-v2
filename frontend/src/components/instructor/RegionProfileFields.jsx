import { useTranslation } from 'react-i18next'
import { AZ_REGIONS, BAKU_DISTRICTS, isBakuRegion } from '@shared/azerbaijanRegions.mjs'

export default function RegionProfileFields({
  region,
  bakuDistrict,
  onChange,
  inputClassName = '',
  labelClassName = 'text-xs block mb-1.5 text-token-textMuted',
}) {
  const { t } = useTranslation()
  const showBakuDistricts = isBakuRegion(region)

  return (
    <div className="space-y-3">
      <div>
        <label className={labelClassName}>{t('marketplace.filters.regionTitle')}</label>
        <select
          className={inputClassName}
          value={region || ''}
          onChange={(e) => {
            const next = e.target.value
            onChange?.({
              region: next,
              bakuDistrict: isBakuRegion(next) ? bakuDistrict : '',
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
          <label className={labelClassName}>{t('marketplace.filters.bakuDistrictTitle')}</label>
          <select
            className={inputClassName}
            value={bakuDistrict || ''}
            onChange={(e) => onChange?.({ region, bakuDistrict: e.target.value })}
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
    </div>
  )
}
