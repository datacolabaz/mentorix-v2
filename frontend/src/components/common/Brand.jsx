import logoLogin from '../../assets/mentorix-login.png'
import logoSidebar from '../../assets/mentorix-sidebar.png'

const imgBase = 'object-contain select-none bg-transparent shrink-0'
const onDarkBoost = 'drop-shadow-[0_6px_18px_rgba(34,224,136,0.18)]'
const loginBoost = 'drop-shadow-[0_0_16px_rgba(34,224,136,0.22)]'

export default function Brand({
  className = '',
  imgClassName = '',
  showText = false,
  textClassName = '',
  size = 'md', // md | sidebar | login
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
    return (
      <div className={`mx-auto w-[92%] min-w-0 flex items-center justify-center gap-3 ${className}`}>
        <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          <span className="font-display font-extrabold text-white text-base leading-none">M</span>
        </div>
        <div
          className="min-w-0 text-lg font-extrabold tracking-wide whitespace-nowrap"
          style={{ textShadow: '0 0 10px rgba(0, 230, 118, 0.5)' }}
        >
          <span className="text-[#E5E7EB]">MENTORIX</span>
          <span className="text-[#00E676]">.IO</span>
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
        