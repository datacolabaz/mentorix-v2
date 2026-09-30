import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import NavIcon from '../../components/common/NavIcon'
import {
  fetchNotificationPreferences,
  saveNotificationPreferences,
} from '../../components/notifications/notificationsApi'
import { categoryIconName } from '../../lib/notificationPresentation'

const selectClass =
  'min-h-[40px] w-full sm:w-44 rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard px-3 text-sm text-token-textMain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 disabled:cursor-not-allowed'

function toDraft(categories) {
  const out = {}
  for (const c of categories || []) {
    out[c.category] = {
      in_app: c.channels?.in_app?.frequency || 'immediate',
      email: c.channels?.email?.frequency || 'off',
    }
  }
  return out
}

function Switch({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--surface-card))]',
        checked ? 'bg-primary border-primary' : 'bg-token-surfaceMain border-[color:var(--border-subtle)]',
        disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={[
          'inline-block h-5 w-5 rounded-full shadow transition-transform',
          checked ? 'translate-x-6 bg-[#041018]' : 'translate-x-1 bg-token-textMuted',
        ].join(' ')}
      />
    </button>
  )
}

export default function NotificationSettings() {
  const { t } = useTranslation()
  const [matrix, setMatrix] = useState([])
  const [draft, setDraft] = useState({})
  const [saved, setSaved] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState({ kind: '', text: '' })

  const apply = (d) => {
    const cats = Array.isArray(d?.categories) ? d.categories : []
    setMatrix(cats)
    const next = toDraft(cats)
    setDraft(next)
    setSaved(next)
  }

  const load = async () => {
    setLoading(true)
    setLoadError('')
    try {
      apply(await fetchNotificationPreferences())
    } catch {
      setLoadError(t('notificationCenter.settings.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const dirty = useMemo(
    () =>
      matrix.some(
        (c) => !c.locked && (draft[c.category]?.in_app !== saved[c.category]?.in_app || draft[c.category]?.email !== saved[c.category]?.email),
      ),
    [matrix, draft, saved],
  )

  const setValue = (category, channel, frequency) => {
    setStatus({ kind: '', text: '' })
    setDraft((prev) => ({ ...prev, [category]: { ...prev[category], [channel]: frequency } }))
  }

  const resetDefaults = () => {
    setStatus({ kind: '', text: '' })
    const next = {}
    for (const c of matrix) {
      next[c.category] = {
        in_app: c.channels?.in_app?.default_frequency || 'immediate',
        email: c.channels?.email?.default_frequency || 'off',
      }
    }
    setDraft(next)
  }

  const save = async () => {
    const preferences = []
    for (const c of matrix) {
      if (c.locked) continue
      for (const channel of ['in_app', 'email']) {
        preferences.push({ category: c.category, channel, frequency: draft[c.category]?.[channel] })
      }
    }
    if (!preferences.length) return
    setSaving(true)
    setStatus({ kind: '', text: '' })
    try {
      apply(await saveNotificationPreferences(preferences))
      setStatus({ kind: 'ok', text: t('notificationCenter.settings.saved') })
    } catch {
      setStatus({ kind: 'error', text: t('notificationCenter.settings.saveError') })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-3xl w-full mx-auto">
      <div className="mb-5">
        <Link
          to="/notifications"
          className="inline-flex min-h-[36px] items-center text-sm font-medium text-token-textMuted hover:text-token-textMain rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          ← {t('notificationCenter.title')}
        </Link>
        <h1 className="mt-1 font-display font-bold text-2xl break-words text-token-textMain">
          {t('notificationCenter.settings.title')}
        </h1>
        <p className="text-token-textMuted text-sm mt-1">{t('notificationCenter.settings.subtitle')}</p>
      </div>

      <Card className="p-4 mb-4">
        <p className="text-sm text-token-textMain">{t('notificationCenter.settings.emailNotice')}</p>
      </Card>

      {loading ? (
        <p className="text-center py-12 text-token-textMuted">{t('notificationCenter.loading')}</p>
      ) : loadError ? (
        <Card className="p-6 text-center">
          <p className="text-token-textMain">{loadError}</p>
          <Button className="mt-4" size="sm" variant="secondary" onClick={() => void load()}>
            {t('notificationCenter.actions.retry')}
          </Button>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="hidden sm:grid grid-cols-[1fr_5rem_11rem] gap-4 px-4 py-3 border-b border-[color:var(--border-subtle)] text-xs font-semibold uppercase tracking-wider text-token-textMuted">
            <span>{t('notificationCenter.settings.columns.category')}</span>
            <span className="text-center">{t('notificationCenter.settings.columns.inApp')}</span>
            <span>{t('notificationCenter.settings.columns.email')}</span>
          </div>
          <ul>
            {matrix.map((c) => {
              const label = t(`notificationCenter.categories.${c.category}`, { defaultValue: c.category })
              const row = draft[c.category] || {}
              const emailOptions = c.channels?.email?.allowed_frequencies || ['immediate', 'daily', 'weekly', 'off']
              const selectId = `notif-email-${c.category}`
              const descId = `notif-desc-${c.category}`
              return (
                <li
                  key={c.category}
                  className="grid grid-cols-1 sm:grid-cols-[1fr_5rem_11rem] gap-3 sm:gap-4 sm:items-center px-4 py-4 border-b last:border-b-0 border-[color:var(--border-subtle)]"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="mt-0.5 w-9 h-9 shrink-0 rounded-lg flex items-center justify-center border border-[color:var(--border-subtle)] text-token-textMuted" aria-hidden>
                      <NavIcon name={categoryIconName(c.category)} className="w-[18px] h-[18px]" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-token-textMain">{label}</span>
                        {c.locked ? (
                          <span className="inline-flex items-center rounded-full border border-[color:var(--border-subtle)] px-2 py-0.5 text-[11px] font-semibold text-token-textMain">
                            {t('notificationCenter.settings.lockedBadge')}
                          </span>
                        ) : null}
                      </div>
                      <p id={descId} className="text-xs text-token-textMuted mt-0.5">
                        {c.locked
                          ? t('notificationCenter.settings.lockedHelp')
                          : t(`notificationCenter.categoryHelp.${c.category}`, { defaultValue: '' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:justify-center gap-3">
                    <span className="sm:hidden text-sm text-token-textMain">{t('notificationCenter.settings.columns.inApp')}</span>
                    <Switch
                      checked={row.in_app !== 'off'}
                      disabled={c.locked || saving}
                      onChange={(on) => setValue(c.category, 'in_app', on ? 'immediate' : 'off')}
                      label={t('notificationCenter.settings.inAppFor', { category: label })}
                    />
                  </div>
                  <div className="flex items-center justify-between sm:block gap-3">
                    <label htmlFor={selectId} className="sm:sr-only text-sm text-token-textMain">
                      {t('notificationCenter.settings.emailFor', { category: label })}
                    </label>
                    <select
                      id={selectId}
                      value={row.email || 'off'}
                      disabled={c.locked || saving}
                      aria-describedby={c.locked ? descId : undefined}
                      onChange={(e) => setValue(c.category, 'email', e.target.value)}
                      className={selectClass}
                    >
                      {emailOptions.map((f) => (
                        <option key={f} value={f}>
                          {t(`notificationCenter.frequency.${f}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {!loading && !loadError ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button loading={saving} disabled={!dirty} onClick={() => void save()}>
            {t('notificationCenter.settings.save')}
          </Button>
          <Button variant="ghost" disabled={saving} onClick={resetDefaults}>
            {t('notificationCenter.settings.resetDefaults')}
          </Button>
          <p
            role="status"
            aria-live="polite"
            className={status.kind === 'error' ? 'text-sm text-rose-700 [.theme-dark_&]:text-rose-300' : 'text-sm text-token-textMuted'}
          >
            {status.text}
          </p>
        </div>
      ) : null}
    </div>
  )
}
