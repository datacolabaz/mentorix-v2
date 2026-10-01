import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import useUiStore from '../../hooks/useUi'
import NavIcon from '../common/NavIcon'
import NotificationItem from './NotificationItem'
import { fetchNotifications, markAllNotificationsRead } from './notificationsApi'
import { useOpenNotification } from './useOpenNotification'
import { notifyNotificationsChanged, useNotificationUnread } from '../../hooks/useNotificationUnread'
import { badgeLabel } from '../../lib/notificationPresentation'

const PANEL_MAX_WIDTH = 384
const RECENT_LIMIT = 8

function panelPosition(button) {
  const r = button.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.min(PANEL_MAX_WIDTH, vw - 16)
  const alignRight = r.left + r.width / 2 > vw / 2
  let left = alignRight ? r.right - width : r.left
  left = Math.max(8, Math.min(left, vw - width - 8))
  const top = Math.round(r.bottom + 8)
  return { top, left: Math.round(left), width, maxHeight: Math.max(240, vh - top - 16) }
}

/**
 * Header/sidebar bell with unread badge and a recent-notifications panel.
 * The panel is portalled above the fixed mobile headers (z 1100).
 */
export default function NotificationBell({ className = '' }) {
  const { t } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  const { unreadCount } = useNotificationUnread()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [notice, setNotice] = useState('')
  const [markingAll, setMarkingAll] = useState(false)
  const buttonRef = useRef(null)
  const panelRef = useRef(null)
  const panelId = useId()
  const titleId = useId()

  const close = useCallback((returnFocus = true) => {
    setOpen(false)
    setNotice('')
    if (returnFocus) buttonRef.current?.focus()
  }, [])

  const { open: openItem, openingId } = useOpenNotification({ onBeforeNavigate: () => close(false) })

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const d = await fetchNotifications({ limit: RECENT_LIMIT })
      setItems(Array.isArray(d?.notifications) ? d.notifications : [])
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return undefined
    const update = () => buttonRef.current && setPos(panelPosition(buttonRef.current))
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  useEffect(() => {
    if (open && pos) panelRef.current?.focus()
  }, [open, pos])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        close(true)
      }
    }
    const onPointer = (e) => {
      if (panelRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return
      close(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('touchstart', onPointer, { passive: true })
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('touchstart', onPointer)
    }
  }, [open, close])

  const onPanelBlur = (e) => {
    const next = e.relatedTarget
    if (!next) return
    if (panelRef.current?.contains(next) || buttonRef.current?.contains(next)) return
    close(false)
  }

  const handleOpenItem = async (n) => {
    setNotice('')
    const { status } = await openItem(n)
    if (status === 'ok') return
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)))
    if (status !== 'none') setNotice(t(`notificationCenter.open.${status}`, { defaultValue: t('notificationCenter.open.error') }))
  }

  const handleMarkAll = async () => {
    setMarkingAll(true)
    try {
      await markAllNotificationsRead()
      setItems((prev) => prev.map((x) => ({ ...x, is_read: true })))
      notifyNotificationsChanged()
    } catch {
      setNotice(t('notificationCenter.errors.markAll'))
    } finally {
      setMarkingAll(false)
    }
  }

  const badge = badgeLabel(unreadCount)
  const buttonLabel = unreadCount
    ? t('notificationCenter.bell.labelUnread', { count: unreadCount })
    : t('notificationCenter.bell.label')

  const panel =
    open && pos ? (
      <div
        ref={panelRef}
        id={panelId}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        tabIndex={-1}
        onBlur={onPanelBlur}
        style={{ top: pos.top, left: pos.left, width: pos.width, maxHeight: pos.maxHeight }}
        className={[
          `theme-${theme}`,
          'fixed z-[1200] flex flex-col overflow-hidden rounded-2xl border border-[color:var(--border-subtle)]',
          'bg-token-surfaceCard text-token-textMain shadow-[0_18px_48px_rgba(0,0,0,0.28)] focus:outline-none',
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[color:var(--border-subtle)]">
          <h2 id={titleId} className="text-sm font-semibold text-token-textMain">
            {t('notificationCenter.title')}
          </h2>
          <div className="flex items-center gap-1">
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void handleMarkAll()}
                disabled={markingAll}
                className="min-h-[36px] px-2 rounded-lg text-xs font-semibold text-token-textMain hover:bg-token-surfaceCardHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60"
              >
                {t('notificationCenter.actions.markAllRead')}
              </button>
            ) : null}
            <Link
              to="/settings/notifications"
              onClick={() => close(false)}
              aria-label={t('notificationCenter.actions.settings')}
              title={t('notificationCenter.actions.settings')}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-token-textMuted hover:text-token-textMain hover:bg-token-surfaceCardHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <NavIcon name="settings" className="w-[18px] h-[18px]" />
            </Link>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <p role="status" aria-live="polite" className={notice ? 'mx-2 mb-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-token-textMain' : 'sr-only'}>
            {notice}
          </p>
          {loading && items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-token-textMuted">{t('notificationCenter.loading')}</p>
          ) : error ? (
            <div className="px-3 py-6 text-center text-sm text-token-textMuted">
              <p>{t('notificationCenter.errors.load')}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="mt-2 min-h-[36px] px-3 rounded-lg border border-[color:var(--border-subtle)] text-xs font-semibold text-token-textMain hover:bg-token-surfaceCardHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                {t('notificationCenter.actions.retry')}
              </button>
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-token-textMuted">{t('notificationCenter.empty.all')}</p>
          ) : (
            <ul className="space-y-1.5">
              {items.map((n) => (
                <li key={n.id}>
                  <NotificationItem notification={n} compact busy={openingId === n.id} onOpen={handleOpenItem} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-[color:var(--border-subtle)] p-2">
          <Link
            to="/notifications"
            onClick={() => close(false)}
            className="flex min-h-[40px] items-center justify-center rounded-lg text-sm font-semibold text-token-textMain hover:bg-token-surfaceCardHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t('notificationCenter.actions.viewAll')}
          </Link>
        </div>
      </div>
    ) : null

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? close(false) : setOpen(true))}
        aria-label={buttonLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={[
          'relative w-11 h-11 shrink-0 rounded-2xl flex items-center justify-center border-2 transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          theme === 'dark'
            ? 'text-white bg-white/10 hover:bg-white/15 border-white/20 focus-visible:ring-offset-black'
            : 'text-[#003366] bg-white hover:bg-gray-50 border-[#003366]/25 focus-visible:ring-offset-white',
          className,
        ].join(' ')}
      >
        <NavIcon name="notifications" className="w-5 h-5" />
        {badge ? (
          <span
            aria-hidden
            className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold leading-5 text-center tabular-nums ring-2 ring-[rgb(var(--surface-main))]"
          >
            {badge}
          </span>
        ) : null}
      </button>
      {panel && typeof document !== 'undefined' ? createPortal(panel, document.body) : null}
    </>
  )
}
