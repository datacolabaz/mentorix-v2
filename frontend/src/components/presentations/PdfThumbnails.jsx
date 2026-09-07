import { useEffect, useRef, useState } from 'react'
import PdfSlideCanvas from './PdfSlideCanvas'

function Thumb({ pdf, pageNumber, active, onClick, label }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(pageNumber <= 4)

  useEffect(() => {
    const el = ref.current
    if (!el || visible) return undefined
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true)
      },
      { rootMargin: '120px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className={[
        'w-full rounded-xl overflow-hidden border text-left transition-colors',
        active ? 'border-primary ring-1 ring-primary/40' : 'border-white/10 hover:border-white/25',
      ].join(' ')}
    >
      <div className="bg-white/5 aspect-[4/3] flex items-center justify-center">
        {visible ? (
          <PdfSlideCanvas pdf={pdf} pageNumber={pageNumber} cssWidth={148} cssHeight={111} />
        ) : (
          <span className="text-[10px] text-white/40">{pageNumber}</span>
        )}
      </div>
      <div className="px-2 py-1 text-[10px] text-white/70">{label}</div>
    </button>
  )
}

export default function PdfThumbnails({ pdf, pageCount, page, onSelect, title }) {
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1)
  return (
    <div className="w-[176px] shrink-0 hidden md:flex flex-col min-h-0">
      <p className="text-[10px] uppercase tracking-wider text-token-textMuted px-1 pb-2">{title}</p>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {pages.map((n) => (
          <Thumb
            key={n}
            pdf={pdf}
            pageNumber={n}
            active={n === page}
            onClick={() => onSelect(n)}
            label={`${n}`}
          />
        ))}
      </div>
    </div>
  )
}
