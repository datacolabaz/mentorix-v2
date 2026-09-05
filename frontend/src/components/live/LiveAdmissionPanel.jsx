import { useTranslation } from 'react-i18next'
import Button from '../common/Button'

export default function LiveAdmissionPanel({ pending, busyId, onApprove, onDeny }) {
  const { t } = useTranslation()
  if (!pending?.length) return null
  return (
    <div className="absolute top-3 left-1/2 z-30 w-[min(100%-1.5rem,420px)] -translate-x-1/2 rounded-2xl border border-amber-400/30 bg-[#16120a]/95 p-3 shadow-xl backdrop-blur">
      <p className="text-xs font-bold uppercase tracking-wider text-amber-300 mb-2">
        {t('live.admissionPendingTitle')}
      </p>
      <ul className="space-y-2">
        {pending.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{row.display_name}</p>
              <p className="text-[11px] text-gray-400 truncate">
                {row.requester_kind === 'guest' ? t('live.guestLabel') : t('live.studentJoin')}
                {row.email ? ` · ${row.email}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <Button size="sm" loading={busyId === row.id} onClick={() => void onApprove(row.id)}>
                {t('live.approveJoin')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                loading={busyId === row.id}
                onClick={() => void onDeny(row.id)}
              >
                {t('live.denyJoin')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
