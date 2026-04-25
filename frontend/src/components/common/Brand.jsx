import logoLogin from '../../assets/mentorix-login.png'
import logoSidebar from '../../assets/mentorix-sidebar.png'
import logoSidebarLight from '../../assets/mentorix-sidebar-light.png'

const imgBase = 'object-contain select-none bg-transparent shrink-0'
const onDarkBoost = 'drop-shadow-[0_6px_18px_rgba(34,224,136,0.18)]'
const loginBoost = 'drop-shadow-[0_0_16px_rgba(34,224,136,0.22)]'

export default function Brand({
  className = '',
  imgClassName = '',
  showText = false,
  textClassName = '',
  size = 'md', // md | sidebar | login
  tone = 'dark', // dark | light (for readability on sidebar)
}) {
  if (size === 'login') {
    return (
      <div className={`flex flex-col items-center justify-center min-w-0 ${className}`}>
        <img
          src={logoLogin}
          alt="Mentorix"
          className={`mentorix-logo w-[320px] max-w-[min(320px,92vw)] h-auto ${imgBase} ${loginBoost} ${imgClassName}`}
          draggable={false}
        />
        {showText ? (
          <div
            className={`mt-2 font-display font-extrabold tracking-wide text-[#003366] ${textClassName}`}
          >
            Mentorix
          </div>
        ) : null}
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
        