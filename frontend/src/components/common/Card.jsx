export default function Card({ children, className = '', hover = false }) {
  return (
    <div
      className={`
        rounded-2xl
        bg-token-surfaceCard/75 backdrop-blur-[10px]
        text-token-textMain
        border border-[color:var(--border-subtle)]
        shadow-[0_10px_30px_rgba(0,0,0,0.18)]
        [box-shadow:0_10px_30px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.06)]
        ${hover ? 'transition-all hover:-translate-y-0.5 hover:bg-token-surfaceCardHover/80 hover:border-primary/25 hover:shadow-[0_16px_44px_rgba(0,0,0,0.24)]' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
