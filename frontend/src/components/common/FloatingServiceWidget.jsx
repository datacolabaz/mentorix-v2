import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const SERVICES = [
  {
    tag: '⚡ MÜƏLLİMLƏR ÜÇÜN',
    title: '1 Dəqiqəyə AI İmtahanı',
    desc: 'Sual bankınızı sıfırdan deyil, AI ilə saniyələr içində formalaşdırın.',
    linkText: 'Sınaq Yarat',
    linkTo: '/login',
    icon: '⚡',
  },
  {
    tag: '🎯 YENİ MODUL',
    title: '1-ə-1 Peşəkar Mentorluq',
    desc: 'Karyera, İT və biznes sahəsində təcrübəli mentorlarla görüş təyin edin.',
    linkText: 'Mentor Tap',
    linkTo: '/mentorship',
    icon: '👥',
  },
  {
    tag: '📲 TƏLƏBƏ RAHATLIĞI',
    title: 'Qeydiyyatsız QR Girişi',
    desc: 'Tələbələriniz proqram yükləmədən tək kliklə imtahana başlasın.',
    linkText: 'Ətraflı Bax',
    linkTo: '/imtahanlar',
    icon: '📱',
  },
  {
    tag: '🎓 SERTİFİKAT',
    title: 'Biliyini Rəsmi Təsdiqlə',
    desc: 'İT, Data və Cloud üzrə sınaqlardan keçib rəsmi QR-sertifikat qazanın.',
    linkText: 'Sınaq İmtahanları',
    linkTo: '/imtahanlar',
    icon: '🎓',
  },
  {
    tag: '🔍 MARKETPLACE',
    title: 'Müəllim və Proqram Tapın',
    desc: 'Bakıda və regionlarda fənninizə uyğun repetitorları müqayisə edin.',
    linkText: 'Axtarışa Başla',
    linkTo: '/search',
    icon: '🔍',
  },
]

export default function FloatingServiceWidget() {
  const [index, setIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isOpen, setIsOpen] = useState(true)

  useEffect(() => {
    if (isPaused || !isOpen) return undefined
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % SERVICES.length)
    }, 3500)
    return () => clearInterval(interval)
  }, [isPaused, isOpen])

  if (!isOpen) return null

  const current = SERVICES[index]

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="fixed bottom-6 right-6 z-40 w-80 max-w-[calc(100vw-3rem)] bg-white border border-slate-200/90 rounded-2xl shadow-xl shadow-slate-200/60 p-4 transition-all duration-300"
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full tracking-wide">
          {current.tag}
        </span>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-slate-600 p-1 transition-colors rounded-lg hover:bg-slate-100"
          aria-label="Bağla"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="flex items-start gap-3 my-2.5">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center text-lg shrink-0">
          {current.icon}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-slate-900 leading-snug truncate">{current.title}</h4>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed line-clamp-2">{current.desc}</p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100">
        {/* Pagination Dots */}
        <div className="flex gap-1.5 items-center">
          {SERVICES.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Slide ${i + 1}`}
              className={`h-1.5 transition-all rounded-full ${
                i === index ? 'w-5 bg-emerald-500' : 'w-1.5 bg-slate-200 hover:bg-slate-300'
              }`}
            />
          ))}
        </div>

        <Link
          to={current.linkTo}
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition-colors"
        >
          <span>{current.linkText}</span>
          <span>→</span>
        </Link>
      </div>
    </div>
  )
}
