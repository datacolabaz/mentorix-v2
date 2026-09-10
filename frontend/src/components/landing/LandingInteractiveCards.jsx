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
      <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{heading}</h2>
      {lead ? <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">{lead}</p> : null}
      <div className="grid sm:grid-cols-2 gap-3">
        {(cards || []).map((x, i) => (
          <div
            key={`why-${i}-${String(x.title).slice(0, 24)}`}
            className={`rounded-2xl border bg-white p-5 space-y-2 shadow-sm ${
              i === 1 ? 'border-emerald-200' : 'border-slate-200'
            } ${HOVER_LIFT}`}
          >
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-700">{x.title}</div>
            <p className="text-base text-slate-700 leading-relaxed">{x.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function LandingAudienceGrid({ heading, items }) {
  return (
    <section id="mx-audiences" className="space-y-4 scroll-mt-24">
      <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{heading}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-3xl">
        {(items || []).map((item, i) => (
          <LandingHoverCard
            key={`audience-${i}-${String(item.title).slice(0, 24)}`}
            className={`rounded-2xl border p-5 space-y-2 shadow-sm ${
              item.highlight
                ? 'border-emerald-200 bg-emerald-50/70'
                : 'border-slate-200 bg-white'
            }`}
          >
            {item.emoji ? (
              <div className="text-2xl leading-none" aria-hidden>
                {item.emoji}
              </div>
            ) : null}
            <div className="text-base font-semibold text-slate-900 leading-snug">{item.title}</div>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">{item.body}</p>
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
      <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold">{heading}</h2>
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
              className={`rounded-lg px-3 py-2 min-h-[44px] text-sm font-semibold transition-colors ${
                on
                  ? 'bg-primary text-[#041018] shadow-lg shadow-primary/20'
                  : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
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
        className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-2 min-h-[7.5rem] shadow-sm motion-safe:animate-demo-enter"
      >
        <h3 className="text-lg sm:text-xl font-semibold text-slate-900 leading-snug">{current.title}</h3>
        <p className="text-base text-slate-600 leading-relaxed max-w-2xl">{current.body}</p>
      </div>
    </section>
  )
}
