import { useEffect, useState } from 'react'
import { resolveApiAssetUrl } from '../../lib/apiAssetUrl'
import { instructorInitials } from '../../lib/instructorInitials'

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

  if (showPhoto) {
    return (
      <img
        src={src}
        alt=""
        className={[sz, 'rounded-full object-cover shrink-0', ringClassName, className].join(' ')}
        onError={() => setImgError(true)}
      />
    )
  }

  return (
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
}
