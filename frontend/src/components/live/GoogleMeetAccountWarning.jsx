import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../common/Modal'
import Button from '../common/Button'

export default function GoogleMeetAccountWarning({ open, onClose, onProceed, ownerEmail }) {
  const { t } = useTranslation()
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const handleProceed = () => {
    if (dontShowAgain) {
      localStorage.setItem('meet_account_warning_dismissed', 'true')
    }
    onProceed()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('live.meetAccountWarningTitle')}
      size="sm"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={handleProceed}>
            {t('live.meetAccountWarningProceed')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-token-textMain">
          {t('live.meetAccountWarningText', { ownerEmail })}
        </p>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm">
          <p className="text-amber-700 [.theme-dark_&]:text-amber-300">
            {t('live.meetAccountWarningHint')}
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-token-textMuted">
          <input
            type="checkbox"
            checked={dontShowAgain}
            onChange={(e) => setDontShowAgain(e.target.checked)}
            className="rounded border-[color:var(--border-subtle)]"
          />
          {t('live.meetAccountWarningDontShow')}
        </label>
      </div>
    </Modal>
  )
}
