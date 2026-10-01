import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'

/**
 * Landing for the signed one-click link in notification emails. Requires an explicit click so that
 * mail scanners prefetching the URL do not unsubscribe anyone.
 */
export default function EmailUnsubscribe() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [state, setState] = useState(token ? 'idle' : 'invalid')
  const [category, setCategory] = useState('')

  const confirm = async () => {
    setState('loading')
    try {
      const res = await api.post('/notifications/unsubscribe', { token })
      setCategory(res.category || '')
      setState('done')
    } catch (e) {
      setState(e?.status === 400 ? 'invalid' : 'error')
    }
  }

  const categoryLabel = category ? t(`notificationCenter.categories.${category}`, { defaultValue: category }) : ''

  return (
    <main className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[color:var(--border-subtle)] bg-token-surfaceMain p-6 text-center sm:p-8">
        <h1 className="font-display text-lg font-bold text-token-textMain">{t('emailUnsubscribe.title')}</h1>
        {state === 'idle' || state === 'loading' ? (
          <>
            <p className="mt-2 text-sm text-token-textMuted">{t('emailUnsubscribe.question')}</p>
            <button
              type="button"
              disabled={state === 'loading'}
              onClick={() => void confirm()}
              className="mt-5 inline-flex rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-[#041018] disabled:opacity-60"
            >
              {state === 'loading' ? t('emailUnsubscribe.loading') : t('emailUnsubscribe.confirm')}
            </button>
          </>
        ) : null}
        {state === 'done' ? (
          <p role="status" className="mt-2 text-sm text-token-textMain">
            {categoryLabel ? t('emailUnsubscribe.doneCategory', { category: categoryLabel }) : t('emailUnsubscribe.done')}
          </p>
        ) : null}
        {state === 'invalid' ? <p role="alert" className="mt-2 text-sm text-red-500">{t('emailUnsubscribe.invalid')}</p> : null}
        {state === 'error' ? <p role="alert" className="mt-2 text-sm text-red-500">{t('emailUnsubscribe.error')}</p> : null}
        <p className="mt-4 text-xs text-token-textMuted">{t('emailUnsubscribe.settingsHint')}</p>
        <Link to="/settings/notifications" className="mt-2 inline-block text-sm font-medium text-primary hover:underline">
          {t('emailUnsubscribe.settingsCta')}
        </Link>
      </div>
    </main>
  )
}
