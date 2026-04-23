import logo from '../../assets/mentorix-logo.png'

const imgBase = 'object-contain select-none bg-transparent shrink-0'

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
          className={`w-[180px] max-w-[min(180px,92vw)] h-auto ${imgBase} ${imgClassName}`}
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
          src={logo}
          alt="Mentorix"
          className={`h-[45px] max-h-[48px] w-auto max-w-full block mx-auto ${imgBase} ${imgClassName}`}
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
        src={logo}
        alt="Mentorix"
        className={`h-[48px] max-h-[50px] w-auto max-w-full sm:h-[50px] sm:max-h-[52px] ${imgBase} ${imgClassName}`}
        draggable={false}
      />
    </div>
  )
}
