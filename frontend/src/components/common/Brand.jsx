import logo from '../../assets/mentorix-logo.png'

/** Tünd fonda ağ loqo fonunu yumşatmaq (RGB PNG üçün) */
const imgOnDark =
  'object-contain select-none [mix-blend-mode:screen] contrast-[1.02]'

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
          src={logo}
          alt="Mentorix"
          className={`w-[180px] max-w-[min(180px,92vw)] h-auto bg-transparent ${imgOnDark} ${imgClassName}`}
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
      <div
        className={`flex w-4/5 max-w-full mx-auto min-w-0 justify-center items-center ${className}`}
      >
        <img
          src={logo}
          alt="Mentorix"
          className={`h-[48px] max-h-[50px] w-auto max-w-full bg-transparent ${imgOnDark} ${imgClassName}`}
          draggable={false}
        />
      </div>
    )
  }

  return (
    <div className={`flex items-center justify-center min-w-0 max-w-[min(280px,78vw)] mx-auto ${className}`}>
      <img
        src={logo}
        alt="Mentorix"
        className={`h-[46px] max-h-[50px] w-auto max-w-full bg-transparent ${imgOnDark} ${imgClassName}`}
        draggable={false}
      />
    </div>
  )
}
