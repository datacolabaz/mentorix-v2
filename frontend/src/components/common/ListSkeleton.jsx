/**
 * Siyahı yüklənərkən boş ekran / “yoxdur” flaşını əvəz edir.
 * Saxta kartlar əvəzinə yüngül spinner — daha az diqqət çəkir.
 */
export default function ListSkeleton({ message = 'Yüklənir…' }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 gap-4 text-gray-400"
      aria-busy="true"
      aria-live="polite"
    >
      <div
        className="h-9 w-9 rounded-full border-2 border-white/10 border-t-primary animate-spin shrink-0"
        aria-hidden
      />
      <p className="text-sm">{message}</p>
    </div>
  )
}
