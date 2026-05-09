/** Global monthly vs yearly toggle for pricing section */

export default function PricingBillingIntervalToggle({ value, onChange, theme = 'dark' }) {
  const yearly = value === 'yearly'
  const track =
    theme === 'dark'
      ? 'rounded-full border border-indigo-500/25 bg-[#13112e]/90 p-1'
      : 'rounded-full border border-[color:var(--border-subtle)] bg-token-surfaceMain p-1'

  const inactive =
    theme === 'dark'
      ? 'bg-transparent text-gray-400 hover:text-gray-300'
      : 'bg-transparent text-token-textMuted hover:text-token-textMain'
  const sel =
    theme === 'dark'
      ? 'bg-indigo-500/40 text-white shadow-[0_8px_20px_rgba(99,102,241,0.25)]'
      : 'bg-primary/15 text-token-textMain shadow-[0_4px_14px_rgba(0,0,0,0.08)]'

  return (
    <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
      <div className={`inline-flex gap-1 ${track} transition-colors duration-300`} role="tablist" aria-label="Ödəniş dövrü">
        <button
          type="button"
          role="tab"
          aria-selected={!yearly}
          className={[
            'rounded-full px-5 py-2 text-xs font-semibold transition-[transform,color,background] duration-300 ease-out',
            !yearly ? sel : inactive,
          ].join(' ')}
          onClick={() => onChange('monthly')}
        >
          Aylıq
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={yearly}
          className={[
            'rounded-full px-5 py-2 text-xs font-semibold transition-[transform,color,background] duration-300 ease-out',
            yearly ? sel : inactive,
          ].join(' ')}
          onClick={() => onChange('yearly')}
        >
          İllik
          <span className="ml-1 inline-block rounded-full bg-emerald-500/22 px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-emerald-100">
            −20%
          </span>
        </button>
      </div>
      {yearly ? (
        <span className="rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-200">
          Ən sərfəli seçim
        </span>
      ) : (
        <span className="text-[11px] text-token-textMuted text-center sm:text-right">İllik seçərək 20% qənaət edin</span>
      )}
    </div>
  )
}
