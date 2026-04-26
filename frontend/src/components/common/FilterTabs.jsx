export default function FilterTabs({ tabs = [], activeId, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const active = t.id === activeId
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange?.(t.id)}
            className={[
              'inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold',
              'border transition-[background-color,border-color,color,transform,box-shadow] duration-200',
              active
                ? 'bg-primary/12 border-primary/25 text-primary shadow-[0_10px_26px_rgba(34,224,136,0.12)]'
                : 'bg-token-surfaceCard/50 border-[color:var(--border-subtle)] text-token-textMuted hover:text-token-textMain hover:bg-token-surfaceCard/70',
              'active:translate-y-[1px]',
            ].join(' ')}
          >
            {t.label}
            {typeof t.count === 'number' ? (
              <span
                className={[
                  'ml-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
                  active ? 'bg-primary/15 text-primary' : 'bg-white/5 text-token-textMuted',
                ].join(' ')}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

