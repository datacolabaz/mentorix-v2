import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '../common/Button'
import ConfirmDialog from '../common/ConfirmDialog'
import { useToast } from '../common/Toast'
import api, { AUTH_REQUEST_TIMEOUT_MS } from '../../lib/api'
import { formatDateTime } from '../../lib/formatDateTime'

/** Recordings made with the retired internal video room — export or delete only. Hidden when there are none. */
export default function LegacyRecordings() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState('')
  const [confirm, setConfirm] = useState(null)

  useEffect(() => {
    let alive = true
    api
      .get('/live/history')
      .then((res) => {
        if (!alive) return
        setItems((res.sessions || []).filter((s) => s.provider === 'mentorix_live' && s.has_recording && s.recording_url))
      })
      .catch(() => alive && setItems([]))
    return () => {
      alive = false
    }
  }, [])

  if (!items.length) return null

  const download = async (s) => {
    setBusy(s.id)
    try {
      const blob = await api.get(s.recording_url, { responseType: 'blob', timeout: AUTH_REQUEST_TIMEOUT_MS })
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = `mentorix-${s.room_code || 'ders'}.webm`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(href), 1000)
    } catch (e) {
      toast(e?.message || t('liveLessons.legacy.downloadFailed'), 'error')
    } finally {
      setBusy('')
    }
  }

  const remove = async () => {
    const s = confirm
    setBusy(s.id)
    try {
      await api.delete(`/live/history/${encodeURIComponent(s.room_code)}`)
      setItems((list) => list.filter((x) => x.id !== s.id))
      setConfirm(null)
    } catch (e) {
      toast(e?.message || t('liveLessons.saveFailed'), 'error')
    } finally {
      setBusy('')
    }
  }

  return (
    <section className="rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceMain p-4 sm:p-5" aria-labelledby="ll-legacy-title">
      <h2 id="ll-legacy-title" className="text-sm font-semibold text-token-textMain">
        {t('liveLessons.legacy.title')}
      </h2>
      <p className="mt-1 text-xs text-token-textMuted">{t('liveLessons.legacy.hint')}</p>
      <ul className="mt-3 divide-y divide-[color:var(--border-subtle)]">
        {items.map((s) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span className="min-w-0 text-sm text-token-textMain">
              <span className="block truncate">{s.title || t('liveLessons.untitled')}</span>
              <span className="text-xs text-token-textMuted">{formatDateTime(s.started_at || s.scheduled_at, i18n.language)}</span>
            </span>
            <span className="flex gap-1">
              <Button type="button" size="sm" variant="secondary" loading={busy === s.id} onClick={() => void download(s)}>
                {t('liveLessons.legacy.download')}
              </Button>
              <Button type="button" size="sm" variant="ghost" disabled={busy === s.id} onClick={() => setConfirm(s)}>
                {t('liveLessons.legacy.delete')}
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => !busy && setConfirm(null)}
        onConfirm={() => void remove()}
        title={t('liveLessons.legacy.deleteTitle')}
        message={t('liveLessons.legacy.deleteText')}
        confirmLabel={t('liveLessons.legacy.delete')}
        cancelLabel={t('common.cancel')}
        loading={Boolean(busy)}
        danger
      />
    </section>
  )
}
