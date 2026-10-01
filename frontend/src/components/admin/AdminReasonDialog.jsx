import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../common/Modal'
import Button from '../common/Button'
import {
  ADMIN_REASON_MAX_LENGTH,
  ADMIN_REASON_MIN_LENGTH,
  isValidAdminReason,
  normalizeAdminReason,
} from '../../lib/adminActivityAccess'

export default function AdminReasonDialog({ open, instructorName, initialReason = '', onConfirm, onCancel }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState(initialReason)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (open) {
      setReason(initialReason)
      setTouched(false)
    }
  }, [open, initialReason])

  const valid = isValidAdminReason(reason)
  const submit = (e) => {
    e?.preventDefault()
    setTouched(true)
    if (valid) onConfirm(normalizeAdminReason(reason))
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={t('adminActivity.reasonTitle')}
      closeLabel={t('adminActivity.cancel')}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel}>
            {t('adminActivity.cancel')}
          </Button>
          <Button onClick={submit} disabled={touched && !valid}>
            {t('adminActivity.continue')}
          </Button>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm">
          {t('adminActivity.reasonHelp', { name: instructorName || t('adminActivity.thisInstructor') })}
        </p>
        <label className="block text-sm font-semibold" htmlFor="admin-access-reason">
          {t('adminActivity.reasonLabel')}
        </label>
        <textarea
          id="admin-access-reason"
          autoFocus
          rows={3}
          maxLength={ADMIN_REASON_MAX_LENGTH}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={t('adminActivity.reasonPlaceholder')}
          aria-invalid={touched && !valid}
          aria-describedby="admin-access-reason-hint"
          className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard px-3 py-2 text-sm text-token-textMain"
        />
        <p
          id="admin-access-reason-hint"
          className={`text-xs ${touched && !valid ? 'text-red-600 dark:text-red-400' : 'text-token-textMuted'}`}
        >
          {touched && !valid
            ? t('adminActivity.reasonTooShort', { min: ADMIN_REASON_MIN_LENGTH })
            : t('adminActivity.reasonAuditNote')}
        </p>
      </form>
    </Modal>
  )
}
