export default function Card({ children, className = '', hover = false }) {
  return (
    <div
      className={`
        bg-surface-2 border border-white/10 rounded-2xl
        ${hover ? 'transition-all hover:-translate-y-0.5 hover:border-primary/25' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
