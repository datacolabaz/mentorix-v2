import { useTranslation } from 'react-i18next'
import GoogleMapPinPicker from './GoogleMapPinPicker'

/**
 * Müəllim mövqeyini Google Maps-də pin ilə seçmək.
 */
export default function InstructorMapPinPicker(props) {
  const { t } = useTranslation()

  return (
    <div className="space-y-2">
      <p className="text-xs text-token-textMuted leading-relaxed">
        <span className="font-medium text-token-textMain">{t('settings.pinStep1Label')}</span>{' '}
        {t('settings.pinStep1')}
        <span className="block mt-1">
          <span className="font-medium text-token-textMain">{t('settings.pinStep2Label')}</span>{' '}
          {t('settings.pinStep2')}
        </span>
        <span className="block mt-1 text-[10px]">{t('settings.pinGoogleHint')}</span>
      </p>
      <GoogleMapPinPicker
        latitude={props.latitude}
        longitude={props.longitude}
        mapKind={props.mapKind}
        flyKey={props.flyKey}
        radiusKm={props.radiusKm}
        onChange={props.onChange}
      />
    </div>
  )
}
