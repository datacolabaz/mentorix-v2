export default function Card({ children, className = '', hover = false }) {
  return (
    <div
      className={`
        bg-[#1a1740] border border-indigo-500/20 rounded-2xl
        ${hover ? 'transition-all hover:-translate-y-0.5 hover:border-indigo-500/40' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
