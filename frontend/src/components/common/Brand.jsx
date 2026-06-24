import logoSidebar from '../../assets/mentorix-sidebar.png'
import logoSidebarLight from '../../assets/mentorix-sidebar-light.png'

const imgBase = 'object-contain select-none bg-transparent shrink-0'
const onDarkBoost = 'drop-shadow-[0_6px_18px_rgba(34,224,136,0.18)]'

export default function Brand({
  className = '',
  imgClassName = '',
  showText = false,
  textClassName = '',
  size = 'md', // md | sidebar | login
  tone = 'dark', // dark | light (for readability on sidebar)
}) {
  if (size === 'nav') {
    return (
      <div className={`flex items-center gap-1.5 min-w-0 ${className}`}>
        <span
          className={`font-display font-bold tracking-[-0.02em] text-white text-lg sm:text-2xl leading-none ${textClassName}`}
        >
          Mentorix
          <span className="opacity-50 text-[0.75em] font-semibold">.io</span>
        </span>
        <span className="mx-nav-live-dot h-1.5 w-1.5 rounded-full bg-primary shrink-0" aria-hidden />
      </div>
    )
  }

  if (size === 'login') {
    return (
      <div className={`flex flex-col items-center justify-center min-w-0 ${className}`}>
        <span
          className={`font-display font-bold tracking-[-0.02em] text-white text-[1.65rem] sm:text-[1.85rem] leading-none ${textClassName}`}
        >
          Mentorix
          <span className="opacity-45 text-[0.72em] font-semibold">.io</span>
        </span>
      </div>
    )
  }

  if (size === 'sidebar') {
    const badge =
      tone === 'light'
        ? 'bg-white/70 backdrop-blur-[10px] border border-black/10 shadow-[0_14px_42px_rgba(0,0,0,0.12)]'
        : 'bg-white/0 border border-white/0'

    const markBoost =
      tone === 'light'
        ? 'drop-shadow-[0_3px_10px_rgba(0,0,0,0.30)]'
        : onDarkBoost
    return (
      <div className={`mx-auto w-[92%] min-w-0 flex items-center justify-center ${className}`}>
        <div className={`rounded-2xl px-3 py-2 ${badge}`}>
          <img
            src={tone === 'light' ? logoSidebarLight : logoSidebar}
            alt="Mentorix"
            className={[
              'mentorix-logo h-[52px] w-auto max-w-[240px]',
              imgBase,
              markBoost,
              imgClassName,
            ].join(' ')}
            draggable={false}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={`flex items-center justify-start min-w-0 max-w-[min(260px,82vw)] ${className}`}>
      <img
        src={logoSidebar}
        alt="Mentorix"
        className={`mentorix-logo h-[56px] max-h-[62px] w-auto max-w-full sm:h-[60px] sm:max-h-[66px] ${imgBase} ${onDarkBoost} ${imgClassName}`}
        draggable={false}
      />
    </div>
  )
}
        