import { presenceTitle, resolveOnlineStatus } from '../../lib/userPresence'

/**
 * Slack-style presence dot for teachers/students.
 * Pass `is_online` and/or `last_activity_at` from API.
 */
export default function PresenceDot({
  isOnline,
  lastActivityAt,
  user,
  className = '',
  size = 'sm',
}) {
  const online =
    isOnline != null ? Boolean(isOnline) : resolveOnlineStatus(user || { last_activity_at: lastActivityAt })
  const ts = lastActivityAt ?? user?.last_activity_at ?? null
  const title = presenceTitle(online, ts)
  const dim = size === 'md' ? 'h-2.5 w-2.5' : 'h-2 w-2'

  return (
    <span
      className={[
        'inline-block rounded-full shrink-0',
        dim,
        online ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.65)]' : 'bg-gray-500/45',
        className,
      ].join(' ')}
      title={title}
      aria-label={title}
    />
  )
}
