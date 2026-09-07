import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Modal from '../common/Modal'
import Button from '../common/Button'

export default function LivePresentationPicker({ open, onClose, onPick }) {
  const { t } = useTranslation()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await api.get('/presentations')
        if (!cancelled && res?.success) setRows(res.presentations || [])
      } catch {
        if (!cancelled) setRows([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open])

  return (
    <Modal open={open} onClose={onClose} title={t('live.presentation.pickTitle')} size="md" scrollBody>
      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-gray-400">{t('live.loading')}</p>
        ) : !rows.length ? (
          <p className="text-sm text-gray-400">{t('live.presentation.empty')}</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => onPick(row)}
                className="w-full text-left rounded-xl border border-white/10 px-3 py-3 hover:border-primary/40 hover:bg-white/5"
              >
                <p className="text-sm font-semibold text-white truncate">{row.title}</p>
                <p className="text-[11px] text-gray-400 mt-1">
                  {t('presentations.slides', { count: row.slide_count || 0 })}
                </p>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            {t('presentations.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
