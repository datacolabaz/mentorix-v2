import logoLogin from '../../assets/mentorix-login.svg'
import logoSidebar from '../../assets/mentorix-sidebar.svg'

const imgBase = 'object-contain select-none bg-transparent shrink-0'
const onDarkBoost =
  'drop-shadow-[0_6px_18px_rgba(34,224,136,0.25)] brightness-[1.12] saturate-[1.12]'
const loginBoost =
  '[mix-blend-mode:screen] [filter:brightness(1.2)_contrast(1.1)] drop-shadow-[0_0_15px_rgba(34,224,136,0.4)]'

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
          className={`mentorix-logo w-[220px] max-w-[min(220px,92vw)] h-auto ${imgBase} ${loginBoost} ${imgClassName}`}
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
      <div className={`mx-auto w-[90%] min-w-0 flex justify-center items-center ${className}`}>
        <img
          src={logoSidebar}
          alt="Mentorix"
          className={`mentorix-logo h-[54px] max-h-[60px] w-auto max-w-full block mx-auto ${imgBase} ${onDarkBoost} ${imgClassName}`}
          draggable={false}
        />
      </div>
    )
  }

  return (
    <div
      className={`flex items-center justify-start min-w-0 max-w-[min(260px,82vw)] overflow-visible ${className}`}
    >
      <img
        src={logoSidebar}
        alt="Mentorix"
        className={`mentorix-logo h-[50px] max-h-[56px] w-auto max-w-full sm:h-[52px] sm:max-h-[60px] ${imgBase} ${onDark