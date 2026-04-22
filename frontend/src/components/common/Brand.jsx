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
      ? 'h-[200px] max-h-[248px]'
      : size === 'sidebar'
        ? 'h-[88px] max-h-[104px]'
        : 'h-11 max-h-[56px]'
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

