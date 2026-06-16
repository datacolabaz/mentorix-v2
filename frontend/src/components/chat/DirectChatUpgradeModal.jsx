import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { ChatBubbleIcon, LockMiniIcon } from './ChatIcons'
import { useSubscriptionPlans } from '../../hooks/useSubscriptionPlans'
import { higherPaidPlansLabel } from '../../lib/subscriptionPlanGuards'

export default function DirectChatUpgradeModal({ open, onClose, studentName }) {
  const navigate = useNavigate()
  const plansQ = useSubscriptionPlans()
  const plans = Array.isArray(plansQ.data) ? plansQ.data : []

  const upgradeTier = useMemo(() => {
    const hint = higherPaidPlansLabel(plans, 'basic')
    return String(hint).replace(/\s+və ya daha yüksək paket$/i, '').trim() || 'STANDART'
  }, [plans])

  const studentLabel = String(studentName || '').trim()

  return (
    <Modal open={open} onClose={onClose} title="Fərdi çat kilidlidir" size="sm">
      <div className="space-y-5 py-1 text-center">
        <div className="mx-auto relative flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/20 via-violet-500/10 to-transparent">
          <ChatBubbleIcon className="w-7 h-7 text-amber-200/90" />
          <span className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-amber-300/60 bg-amber-500 text-amber-950 shadow-md">
            <LockMiniIcon className="w-3 h-3" />
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-sm text-gray-400 leading-relaxed max-w-sm mx-auto">
            Fərdi çat funksiyası yalnız{' '}
            <span className="font-semibold text-gray-200">{upgradeTier}</span> və daha yüksək paketlərdə
            aktivdir.
            {studentLabel ? (
              <>
                {' '}
                <span className="text-gray-300">{studentLabel}</span> ilə şəxsi yazışmaq üçün paketinizi
                yeniləyin.
              </>
            ) : (
              ' Zəhmət olmasa paketinizi yeniləyin.'
            )}
          </p>
        </div>

        <div className="flex flex-col gap-2 pt-1">
          <Button
            className="w-full justify-center"
            onClick={() => {
              onClose?.()
              navigate('/instructor/settings')
            }}
          >
            Paketlərə bax
          </Button>
          <Button type="button" variant="secondary" className="w-full justify-center" onClick={onClose}>
            Bağla
          </Button>
        </div>
      </div>
    </Modal>
  )
}
