import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import NotificationItem from '../../components/notifications/NotificationItem'
import {
  fetchNotificationPreferences,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../components/notifications/notificationsApi'
import { useOpenNotification } from '../../components/notifications/useOpenNotification'
import {
  NOTIFICATIONS_CHANGED_EVENT,
  notifyNotificationsChanged,
  useNotificationUnread,
} from '../../hooks/useNotificationUnread'
import { NOTIFICATION_CATEGORIES } from '../../lib/notificationPresentation'

const PAGE_SIZE = 20
const CENTER_SOURCE = 'center'

const selectClass =
  'min-h-[40px] rounded-xl border border-[color:var(--border-subtle)] bg-token-surfaceCard px-3 text-sm text-token-textMain focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary'

export default function NotificationCenter() {
  const { t } = useTranslation()
  const { unreadCount } = useNotificationUnread()
  const [categories, setCategories] = useState(NOTIFICATION_CATEGORIES)
  const [category, setCategory] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [markingAll, setMarkingAll] = useState(false)
  const requestSeq = useRef(0)
  const categoryId = useId()
  const unreadId = useId()
  const { open, openingId } = useOpenNotification({ source: CENTER_SOURCE })

  useEffect(() => {
    let cancelled = false
    fetchNotificationPreferences()
      .then((d) => {
        const visible = Array.isArray(d?.categories) ? d.categories.map((c) => c.category) : []
        if (!cancelled && visible.length) setCategories(NOTIFICATION_CATEGORIES.filter((c) => visible.includes(c)))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async () => {
    const seq = ++requestSeq.current
    setLoading(true)
    setError('')
    try {
      const d = await fetchNotifications({ limit: PAGE_SIZE, category, unread: unreadOnly })
      if (seq !== requestSeq.current) return
      setItems(Array.isArray(d?.notifications) ? d.notifications : [])
      setCursor(d?.next_cursor || null)
    } catch {
      if (seq === requestSeq.current) setError(t('notificationCenter.errors.load'))
    } finally {
      if (seq === requestSeq.current) setLoading(false)
    }
  }, [category, unreadOnly, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onChanged = (e) => {
      if (e?.detail?.source !== CENTER_SOURCE) void load()
    }
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, onChanged)
  }, [load])

  const loadMore = async () => {
    if (!cursor) return
    const seq = requestSeq.current
    setLoadingMore(true)
    try {
      const d = await fetchNotifications({ limit: PAGE_SIZE, cursor, category, unread: unreadOnly })
      if (seq !== requestSeq.current) return
      const next = Array.isArray(d?.notifications) ? d.notifications : []
      setItems((prev) => {
        const seen = new Set(prev.map((x) => x.id))
        return [...prev, ...next.filter((x) => !seen.has(x.id))]
      })
      setCursor(d?.next_cursor || null)
    } catch {
      setNotice(t('notificationCenter.errors.load'))
    } finally {
      setLoadingMore(false)
    }
  }

  const markLocalRead = (id) =>
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, is_read: true, read_at: x.read_at || new Date().toISOString() } : x)))

  const handleOpen = async (n) => {
    setNotice('')
    const { status } = await open(n)
    if (status === 'ok') return
    markLocalRead(n.id)
    if (status !== 'none') setNotice(t(`notificationCenter.open.${status}`, { defaultValue: t('notificationCenter.open.error') }))
  }

  const handleMarkRead = async (n) => {
    try {
      await markNotificationRead(n.id)
      markLocalRead(n.id)
      notifyNotificationsChanged(CENTER_SOURCE)
    } catch {
      setNotice(t('notificationCenter.errors.markRead'))
    }
  }

  const handleMarkAll = async () => {
    setMarkingAll(true)
    setNotice('')
    try {
      await markAllNotificationsRead(category || undefined)
      notifyNotificationsChanged(CENTER_SOURCE)
      if (unreadOnly) await load()
      else setItems((prev) => prev.map((x) => ({ ...x, is_read: true })))
    } catch {
      setNotice(t('notificationCenter.errors.markAll'))
    } finally {
      setMarkingAll(false)
    }
  }

  const hasUnreadVisible = items.some((x) => !x.is_read)
  const emptyKey = unreadOnly ? 'notificationCenter.empty.unread' : category ? 'notificationCenter.empty.category' : 'notificationCenter.empty.all'

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-3xl w-full mx-auto">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display font-bold text-2xl break-words text-token-textMain">{t('notificationCenter.title')}</h1>
          <p className="text-token-textMuted text-sm mt-1">
            {unreadCount > 0
              ? t('notificationCenter.summaryUnread', { count: unreadCount })
              : t('notificationCenter.summaryAllRead')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/settings/notifications"
            className="inline-flex min-h-[40px] items-center rounded-xl px-3 text-sm font-semibold text-token-textMain border border-[color:var(--border-subtle)] hover:bg-token-surfaceCardHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('notificationCenter.actions.settings')}
          </Link>
          {hasUnreadVisible || unreadCount > 0 ? (
            <Button size="md" variant="secondary" loading={markingAll} onClick={() => void handleMarkAll()}>
              {category ? t('notificationCenter.actions.markCategoryRead') : t('notificationCenter.actions.markAllRead')}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={categoryId} className="text-xs font-medium text-token-textMuted">
            {t('notificationCenter.filters.category')}
          </label>
          <select id={categoryId} value={category} onChange={(e) => setCategory(e.target.value)} className={selectClass}>
            <option value="">{t('notificationCenter.filters.allCategories')}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {t(`notificationCenter.categories.${c}`)}
              </option>
            ))}
          </select>
        </div>
        <label htmlFor={unreadId} className="inline-flex min-h-[40px] items-center gap-2 text-sm text-token-textMain cursor-pointer">
          <input
            id={unreadId}
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => setUnreadOnly(e.target.checked)}
            className="w-4 h-4 accent-[rgb(var(--primary-accent))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          {t('notificationCenter.filters.unreadOnly')}
        </label>
      </div>

      <p
        role="status"
        aria-live="polite"
        className={notice ? 'mb-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-token-textMain' : 'sr-only'}
      >
        {notice}
      </p>

      {loading ? (
        <p className="text-center py-12 text-token-textMuted">{t('notificationCenter.loading')}</p>
      ) : error ? (
        <Card className="p-6 text-center">
          <p className="text-token-textMain">{error}</p>
          <Button className="mt-4" size="sm" variant="secondary" onClick={() => void load()}>
            {t('notificationCenter.actions.retry')}
          </Button>
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-display font-bold text-lg text-token-textMain">{t(emptyKey)}</p>
          <p className="text-sm text-token-textMuted mt-2">{t('notificationCenter.empty.hint')}</p>
        </Card>
      ) : (
        <>
          <ul className="space-y-2">
            {items.map((n) => (
              <li key={n.id} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <NotificationItem notification={n} busy={openingId === n.id} onOpen={handleOpen} />
                </div>
                {!n.is_read ? (
                  <button
                    type="button"
                    onClick={() => void handleMarkRead(n)}
                    aria-label={t('notificationCenter.actions.markReadNamed', { title: n.title || t('notificationCenter.untitled') })}
                    title={t('notificationCenter.actions.markRead')}
                    className="mt-2 w-10 h-10 shrink-0 rounded-xl border border-[color:var(--border-subtle)] flex items-center justify-center text-token-textMuted hover:text-token-textMain hover:bg-token-surfaceCardHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <svg viewBox="0 0 24 24" fill="none" aria-hidden className="w-5 h-5">
                      <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                ) : (
                  <span className="w-10 shrink-0" aria-hidden />
                )}
              </li>
            ))}
          </ul>
          {cursor ? (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" loading={loadingMore} onClick={() => void loadMore()}>
                {t('notificationCenter.actions.loadMore')}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
