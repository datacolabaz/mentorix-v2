import { useEffect, useState } from 'react'

const HOVER_LIFT =
  'motion-safe:transition motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_16px_40px_-20px_rgba(0,229,176,0.45)]'

export function LandingHoverCard({ className = '', children }) {
  return <div className={`${HOVER_LIFT} ${className}`}>{children}</div>
}

/** Niyə Mentorix — yalnız başlıq; klikdə bir kart açılır. */
export function LandingWhyAccordion({ heading, cards }) {
  const [open, setOpen] = useState(0)

  useEffect(() => {
    setOpen(0)
  }, [cards])

  return (
    <section id="mx-why" className="space-y-4 scroll-mt-8">
      <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{heading}</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {cards.map((x, i) => {
          const isOpen = open === i
          return (
            <div
              key={`why-${i}-${String(x.title).slice(0, 24)}`}
              className={`rounded-2xl border bg-[#121212]/90 ${isOpen ? 'border-primary/35' : 'border-white/10'} ${HOVER_LIFT}`}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? -1 : i)}
                className="w-full text-left px-4 py-3.5 min-h-[48px] flex items-start justify-between gap-3"
              >
                <span className="text-sm font-semibold text-white leading-snug">{x.title}</span>
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold leading-none transition-transform ${
                    isOpen
                      ? 'rotate-45 border-primary/45 bg-primary/15 text-primary'
                      : 'border-white/15 text-gray-400'
                  }`}
                  aria-hidden
                >
                  +
                </span>
              </button>
              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                  isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-4 pb-4 text-xs text-gray-400 leading-relaxed">{x.body}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Xüsusiyyətlər — tab/filter: eyni anda bir kart. */
export function LandingFeatureTabs({ heading, items }) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    setActive(0)
  }, [items])

  const current = items[active] || items[0]
  if (!current) return null

  return (
    <section id="mx-features" className="space-y-4 scroll-mt-24">
      <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{heading}</h2>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={heading}>
        {items.map((x, i) => {
          const on = i === active
          return (
            <button
              key={`feat-tab-${i}`}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActive(i)}
              className={`rounded-full px-3 py-2 min-h-[40px] text-xs sm:text-sm font-semibold transition-colors ${
                on
                  ? 'bg-primary text-[#041018] shadow-lg shadow-primary/20'
                  : 'border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              {x.title}
            </button>
          )
        })}
      </div>
      <div
        key={`feat-panel-${active}`}
        role="tabpanel"
        className={`rounded-2xl border border-white/10 bg-gradient-to-br ${current.accent || 'from-sky-500/15'} to-[#101010] p-5 sm:p-6 space-y-2 min-h-[7.5rem] motion-safe:animate-demo-enter`}
      >
        <h3 className="text-base sm:text-lg font-semibold text-white leading-snug">{current.title}</h3>
        <p className="text-sm text-gray-300 leading-relaxed max-w-2xl">{current.body}</p>
      </div>
    </section>
  )
}
