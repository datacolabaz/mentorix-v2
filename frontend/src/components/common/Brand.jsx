import logo from '../../assets/mentorix-logo.png'

export default function Brand({
  className = '',
  imgClassName = '',
  showText = false,
  textClassName = '',
  size = 'md', // md | sidebar | login
}) {
  const sizeClass =
    size === 'login'
      ? 'h-[180px] max-h-[220px]'
      : size === 'sidebar'
        ? 'h-[76px] max-h-[92px]'
        : 'h-10 max-h-[50px]'
  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      <img
        src={logo}
        alt="Mentorix"
        className={`${sizeClass} w-auto object-contain select-none ${imgClassName}`}
        draggable={false}
      />
      {showText ? (
        <div className={`font-display font-extrabold tracking-wide truncate ${textClassName}`}>Mentorix</div>
      ) : null}
    </div>
  )
}

