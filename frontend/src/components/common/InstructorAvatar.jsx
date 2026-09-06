import { useEffect, useState } from 'react'
import { resolveApiAssetUrl } from '../../lib/apiAssetUrl'
import { instructorInitials } from '../../lib/instructorInitials'
import { resolveOnlineStatus } from '../../lib/userPresence'
import PresenceDot from './PresenceDot'

const SIZE = {
  xs: 'h-8 w-8 text-[10px]',
  sm: 'h-10 w-10 text-xs',
  md: 'h-14 w-14 text-sm',
  lg: 'h-24 w-24 text-xl',
  xl: 'h-32 w-32 text-2xl',
}

/**
 * Müəllim profil şəkli və ya ad baş hərfləri (tələbələr üçün avatar yoxdur).
 */
export default function InstructorAvatar({
  fullName,
  avatarUrl,
  size = 'md',
  className = '',
  ringClassName = 'ring-2 ring-white/20',
  kind,
  isOnline,
  lastActivityAt,
  showPresence = false,
}) {
  const sz = SIZE[size] || SIZE.md
  const src = avatarUrl ? resolveApiAssetUrl(avatarUrl) : ''
  const [imgError, setImgError] = useState(false)
  const showPhoto = Boolean(src) && !imgError
  const initials = instructorInitials(fullName)
  const accent =
    kind === 'trainer'
      ? 'bg-gradient-to-br from-amber-500 to-amber-700'
      : 'bg-gradient-to-br from-emerald-500 to-emerald-700'

  useEffect(() => {
    setImgError(false)
  }, [src])

  const online = resolveOnlineStatus({ is_online: isOnline, last_activity_at: lastActivityAt })
  const face = showPhoto ? (
    <img
      src={src}
      alt=""
      className={[sz, 'rounded-full object-cover shrink-0', ringClassName, className].join(' ')}
      onError={() => setImgError(true)}
    />
  ) : (
    <span
      className={[
        sz,
        'rounded-full shrink-0 inline-flex items-center justify-center font-bold text-white',
        accent,
        ringClassName,
        className,
      ].join(' ')}
      aria-hidden
    >
      {initials}
    </span>
  )

  if (!showPresence || !online) return face

  return (
    <span className="relative inline-block shrink-0">
      {face}
      <PresenceDot
        isOnline
        lastActivityAt={lastActivityAt}
        size="md"
        className="absolute -bottom-0.5 -right-0.5 ring-2 ring-[#0b0b0b]"
      />
    </span>
  )
}
