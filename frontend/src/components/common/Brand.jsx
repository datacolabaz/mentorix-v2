import logo from '../../assets/mentorix-logo.png'

export default function Brand({ className = '', imgClassName = '', showText = false, textClassName = '' }) {
  return (
    <div className={`flex items-center gap-3 min-w-0 ${className}`}>
      <img
        src={logo}
        alt="Mentorix"
        className={`h-9 w-auto select-none ${imgClassName}`}
        draggable={false}
      />
      {showText ? (
        <div className={`font-display font-extrabold tracking-wide truncate ${textClassName}`}>Mentorix</div>
      ) : null}
    </div>
  )
}

