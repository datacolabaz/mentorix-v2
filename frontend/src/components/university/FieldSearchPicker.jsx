import { useMemo, useState } from 'react'
import { FIELD_GROUPS } from '../../lib/universityFieldCatalog'
import { resolveFieldFromQuery } from '../../lib/universitySearch'

const inputCls =
  'w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50'

export default function FieldSearchPicker({ value, onChange, label = 'İxtisas' }) {
  const [query, setQuery] = useState('')

  const options = useMemo(() => {
    const q = query.trim().toLowerCase()
    const flat = FIELD_GROUPS.flatMap((group) =>
      group.options.map((opt) => ({ ...opt, groupLabel: group.label })),
    )
    if (!q) return flat
    return flat.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        opt.value.replace(/_/g, ' ').toLowerCase().includes(q) ||
        opt.groupLabel.toLowerCase().includes(q),
    )
  }, [query])

  const handleQueryChange = (nextQuery) => {
    setQuery(nextQuery)
    const resolved = resolveFieldFromQuery(nextQuery)
    if (resolved && nextQuery.trim().length >= 3) {
      onChange?.(resolved)
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</label>
      <input
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        className={inputCls}
        placeholder="Computer Science, Data Science, AI…"
      />
      <select
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        className={inputCls}
      >
        <option value="">— Bütün ixtisaslar —</option>
        {FIELD_GROUPS.map((group) => (
          <optgroup key={group.id} label={group.label}>
            {(query.trim()
              ? options.filter((o) => o.groupLabel === group.label)
              : group.options
            ).map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      {value ? (
        <button
          type="button"
          onClick={() => {
            onChange?.('')
            setQuery('')
          }}
          className="text-xs text-gray-400 hover:text-white underline"
        >
          İxtisas filtrini təmizlə
        </button>
      ) : null}
    </div>
  )
}
