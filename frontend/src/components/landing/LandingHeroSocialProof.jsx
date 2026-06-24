import { useEffect, useMemo, useState } from 'react'

const FEED_VISIBLE = 3
const FEED_INTERVAL_MS = 3000

const HERO_FEED_EVENTS = [
  { actor: 'Telman müəllim', action: 'imtahan yaratdı', time: 'indi' },
  { actor: 'Arzu tələbə', action: 'ödəniş etdi (45 AZN)', time: '2 dəq əvvəl' },
  { actor: 'Valideyni', action: 'SMS aldı: "Qiymət: 8/10"', time: '5 dəq əvvəl' },
  { actor: 'Leyla müəllim', action: 'tapşırıq təyin etdi', time: '1 dəq əvvəl' },
  { actor: 'Rəşad tələbə', action: 'imtahana qoşuldu', time: '3 dəq əvvəl' },
  { actor: 'Valideyni', action: 'davamiyyət bildirişi aldı', time: '7 dəq əvvəl' },
  { actor: 'Nərgiz müəllim', action: 'yeni tələbə qəbul etdi', time: '4 dəq əvvəl' },
  { actor: 'Kamran tələbə', action: 'tapşırıq təslim etdi', time: '6 dəq əvvəl' },
]

function FeedRow({ actor, action, time, animate }) {
  return (
    <div
      className={[
        'flex items-center gap-2 min-h-[2.25rem] text-[11px] leading-tight',
        animate ? 'mx-hero-feed-row-enter' : '',
      ].join(' ')}
    >
      <span
        className="mx-hero-live-dot h-1.5 w-1.5 shrink-0 rounded-full bg-primary shadow-[0_0_8px_rgba(0,230,118,0.75)]"
        aria-hidden
      />
      <span className="shrink-0 font-medium text-gray-200 truncate max-w-[5.5rem] sm:max-w-[6.5rem]">
        {actor}
      </span>
      <span className="flex-1 text-gray-400 truncate">{action}</span>
      <span className="shrink-0 text-[10px] text-gray-500 tabular-nums whitespace-nowrap">{time}</span>
    </div>
  )
}

/** Hero sağ sütun — canlı feed, statistika və rəy */
export default function LandingHeroSocialProof({ onPrimaryCta }) {
  const [offset, setOffset] = useState(0)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setOffset((o) => (o + 1) % HERO_FEED_EVENTS.length)
      setTick((t) => t + 1)
    }, FEED_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [])

  const visibleRows = useMemo(() => {
    const n = HERO_FEED_EVENTS.length
    return Array.from({ length: FEED_VISIBLE }, (_, i) => HERO_FEED_EVENTS[(offset + i) % n])
  }, [offset])

  return (
    <div
      id="mx-demo-mini"
      className="relative w-full sm:w-[340px] shrink-0 rounded-2xl border border-white/10 bg-gradient-to-br from-[#131313] to-[#0a0f12] p-4 shadow-[0_0_80px_-20px_rgba(0,229,176,0.35)] overflow-hidden"
    >
      <div className="absolute inset-x-8 -top-16 h-32 rounded-full bg-primary/25 blur-3xl" aria-hidden />
      <div className="relative space-y-3">
        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 space-y-0.5 overflow-hidden">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
              Canlı fəaliyyət
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] text-primary">
              <span className="mx-hero-live-dot h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
              indi
            </span>
          </div>
          <div className="space-y-0.5" key={tick}>
            {visibleRows.map((row, i) => (
              <FeedRow key={`${tick}-${row.actor}-${row.action}`} {...row} animate={i === 0} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 space-y-0.5">
            <div className="text-lg font-semibold text-white tabular-nums leading-none">340+</div>
            <div className="text-[10px] text-gray-500">müəllim</div>
            <div className="text-[10px] text-gray-400">bu ay</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 space-y-0.5">
            <div className="text-lg font-semibold text-primary tabular-nums leading-none">6 saat</div>
            <div className="text-[10px] text-gray-500">həftəlik</div>
            <div className="text-[10px] text-gray-400">vaxt qənaəti</div>
          </div>
          <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 space-y-0.5">
            <div className="text-lg font-semibold text-white tabular-nums leading-none">
              4.8 <span className="text-primary text-sm">★</span>
            </div>
            <div className="text-[10px] text-gray-500">orta reytinq</div>
          </div>
          <button
            type="button"
            onClick={onPrimaryCta}
            className="rounded-xl border border-primary/40 bg-primary/15 px-3 py-2.5 text-left hover:bg-primary/25 transition-colors min-h-[4.5rem] flex flex-col justify-center gap-0.5"
          >
            <span className="text-sm font-bold text-primary leading-tight">Pulsuz başla</span>
            <span className="text-base text-primary leading-none" aria-hidden>
              →
            </span>
          </button>
        </div>

        <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 flex gap-3">
          <div
            className="h-9 w-9 shrink-0 rounded-full bg-primary/20 border border-primary/35 flex items-center justify-center text-[11px] font-bold text-primary"
            aria-hidden
          >
            TA
          </div>
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] text-gray-300 leading-relaxed italic">
              &ldquo;Mentorix olmadan bu qədər tələbəni idarə edə bilməzdim.&rdquo;
            </p>
            <p className="text-[10px] text-gray-500">
              — Telman A., riyaziyyat müəllimi · Bakı
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
