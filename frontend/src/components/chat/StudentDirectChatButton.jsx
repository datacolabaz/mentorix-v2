import { ChatBubbleIcon, LockMiniIcon } from './ChatIcons'

/**
 * Visible DM trigger on student cards — active (paid) or locked (SADƏ).
 */
export default function StudentDirectChatButton({
  active = false,
  locked = false,
  disabled = false,
  onClick,
  title = 'Fərdi çat',
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={[
        'relative shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center transition-all duration-200',
        disabled
          ? 'opacity-30 cursor-not-allowed border-[color:var(--border-subtle)] bg-token-surfaceCard/20 text-token-textMuted'
          : active
            ? 'border-emerald-500/40 bg-emerald-500/12 text-emerald-300 hover:bg-emerald-500/20 hover:border-emerald-400/55 hover:shadow-[0_0_16px_-4px_rgba(52,211,153,0.45)]'
            : 'border-[color:var(--border-subtle)] bg-token-surfaceCard/25 text-token-textMuted opacity-45 hover:opacity-70 hover:bg-token-surfaceCard/45',
      ].join(' ')}
    >
      <ChatBubbleIcon />
      {locked && !disabled ? (
        <span
          className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-amber-400/50 bg-amber-500 text-amber-950 shadow-sm"
          aria-hidden
        >
          <LockMiniIcon />
        </span>
      ) : null}
    </button>
  )
}
