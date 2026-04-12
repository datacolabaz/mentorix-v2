/** Siyahı API-dən gələnə qədər boş vəziyyət flaşını əngəlləmək üçün */
export default function ListSkeleton({ rows = 4, className = 'h-20' }) {
  return (
    <div className="space-y-3 animate-pulse" aria-busy="true" aria-label="Yüklənir">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className={`rounded-xl border border-indigo-500/20 bg-[#13112e]/90 ${className}`}
        />
      ))}
    </div>
  )
}
