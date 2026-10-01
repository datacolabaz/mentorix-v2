import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '../common/Modal'
import Button from '../common/Button'
import { useToast } from '../common/Toast'
import api from '../../lib/api'

export default function LiveLessonCancelModal({ open, lesson, onClose, onCancelled }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [reason, setReason] = useState('')
  const [scope, setScope] = useState('single')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setReason('')
      setScope('single')
    }
  }, [open])

  const submit = async () => {
    setSaving(true)
    try {
      const res = await api.post(`/live-lessons/${encodeURIComponent(lesson.id)}/cancel`, { reason: reason.trim(), scope })
      toast(t('liveLessons.cancelled'))
      onCancelled?.(res)
      onClose?.()
    } catch (e) {
      toast(e?.message || t('liveLessons.saveFailed'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && onClose?.()}
      title={t('liveLessons.cancelTitle')}
      size="md"
      closeLabel={t('common.close')}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            {t('liveLessons.keep')}
          </Button>
          <Button type="button" variant="danger" loading={saving} onClick={() => void submit()}>
            {t('liveLessons.cancelConfirm')}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-token-textMain">{t('liveLessons.cancelText', { title: lesson?.title || '' })}</p>
        <label className="block space-y-1">
          <span className="text-xs font-medium text-token-textMuted">{t('liveLessons.cancelReasonLabel')}</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceMain px-3 py-2 text-sm text-token-textMain outline-none focus:border-primary/50"
          />
        </label>
        {lesson?.series_id ? (
          <div className="space-y-1.5 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="ll-cancel-scope" checked={scope === 'single'} onChange={() => setScope('single')} />
              {t('liveLessons.scope.single')}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="ll-cancel-scope" checked={scope === 'following'} onChange={() => setScope('following')} />
              {t('liveLessons.scope.following')}
            </label>
          </div>
        ) : null}
        <p className="text-[11px] text-token-textMuted">{t('liveLessons.cancelNotifyHint')}</p>
      </div>
    </Modal>
  )
}
