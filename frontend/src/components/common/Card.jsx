export default function Card({ children, className = '', hover = false }) {
  return (
    <div
      className={`
        bg-[#F4F7FA] text-[#1A1D21] border border-primary/10 shadow-[0_10px_30px_rgba(34,224,136,0.1)] rounded-2xl
        ${hover ? 'transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_16px_40px_rgba(34,224,136,0.14)]' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  )
}
