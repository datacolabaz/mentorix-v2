import { useEffect, useState } from 'react'

const HOVER_LIFT =
  'motion-safe:transition motion-safe:duration-300 motion-safe:ease-out motion-safe:hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_16px_40px_-20px_rgba(0,229,176,0.45)]'

export function LandingHoverCard({ className = '', children }) {
  return <div className={`${HOVER_LIFT} ${className}`}>{children}</div>
}

/** Problem → həll — hər iki tərəf açıq qalır, klik tələb olunmur. */
export function LandingProblemSolution({ heading, lead, cards }) {
  return (
    <section id="mx-why" className="space-y-4 scroll-mt-24">
      <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{heading}</h2>
      {lead ? <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-2xl">{lead}</p> : null}
      <div className="grid sm:grid-cols-2 gap-3">
        {(cards || []).map((x, i) => (
          <div
            key={`why-${i}-${String(x.title).slice(0, 24)}`}
            className={`rounded-2xl border bg-[#121212]/90 p-4 sm:p-5 space-y-2 ${
              i === 1 ? 'border-primary/35' : 'border-white/10'
            } ${HOVER_LIFT}`}
          >
            <div className="text-[11px] font-bold uppercase tracking-wider text-primary">{x.title}</div>
            <p className="text-sm text-gray-300 leading-relaxed">{x.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function LandingAudienceGrid({ heading, items }) {
  return (
    <section id="mx-audiences" className="space-y-4 scroll-mt-24">
      <h2 className="text-xs uppercase tracking-wider text-gray-500 font-semibold">{heading}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {(items || []).map((item, i) => (
          <LandingHoverCard
            key={`audience-${i}-${String(item.title).slice(0, 24)}`}
            className={`rounded-2xl border p-4 sm:p-5 space-y-2 ${
              item.highlight
                ? 'border-primary/40 bg-primary/5'
                : 'border-white/10 bg-[#121212]/90'
            }`}
          >
            {item.emoji ? (
              <div className="text-2xl leading-none" aria-hidden>
                {item.emoji}
              </div>
            ) : null}
            <div className="text-sm font-semibold text-white leading-snug">{item.title}</div>
            <p className="text-xs text-gray-400 leading-relaxed">{item.body}</p>
          </LandingHoverCard>
        ))}
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
