import { useTranslation } from 'react-i18next'
import Button from '../common/Button'

export default function LiveWaitingRoom({ title, denied, onLeave }) {
  const { t } = useTranslation()
  return (
    <div className="min-h-[100svh] bg-[#0b0b0b] text-white flex flex-col items-center justify-center gap-5 p-6 text-center">
      <div>
        <p className="text-xs uppercase tracking-wider text-primary font-bold">Mentorix Live</p>
        {title ? <h1 className="font-display font-bold text-xl mt-2">{title}</h1> : null}
        <p className="text-sm text-gray-400 mt-3 max-w-md">
          {denied ? t('live.joinDeniedHint') : t('live.waitingForTeacherHint')}
        </p>
      </div>
      <p className="text-base font-semibold text-white">
        {denied ? t('live.joinDenied') : t('live.waitingForTeacher')}
      </p>
      {onLeave ? (
        <Button variant="secondary" onClick={onLeave}>
          {t('live.leaveWaiting')}
        </Button>
      ) : null}
    </div>
  )
}
