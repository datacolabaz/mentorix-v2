export default function Card({ children, className = '', hover = false }) {
  return (
    <div
      className={`
        flex flex-col rounded-2xl overflow-hidden
        bg-surface-2 border border-white/10
        ${hover ? 'transition-all hover:-translate-y-0.5 hover:border-primary/25' : ''}
        ${className}
      `}
    >
      <div
        aria-hidden
        className="h-0.5 w-full shrink-0 bg-gradient-to-r from-[#003366] to-[#22e088]"
      />
      <div className="relative">{children}</div>
    </div>
  )
}
