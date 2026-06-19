import { FIELD_GROUPS } from '../../lib/universityFieldCatalog'
import { resolveFieldFromQuery } from '../../lib/universitySearch'

const inputCls =
  'w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50'

function parseFields(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

export default function FieldSearchPicker({ value, onChange, label = 'İxtisas' }) {
  const selected = parseFields(value)

  const toggleField = (slug) => {
    if (!slug) return
    const next = selected.includes(slug)
      ? selected.filter((f) => f !== slug)
      : [...selected, slug]
    onChange?.(next)
  }

  const handleQueryKeyDown = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const resolved = resolveFieldFromQuery(e.currentTarget.value)
    if (resolved) {
      toggleField(resolved)
      e.currentTarget.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</label>

      {selected.length ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((slug) => {
            const labelText =
              FIELD_GROUPS.flatMap((g) => g.options).find((o) => o.value === slug)?.label || slug
            return (
              <button
                key={slug}
                type="button"
                onClick={() => toggleField(slug)}
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-white"
              >
                {labelText}
                <span className="text-gray-400">×</span>
              </button>
            )
          })}
        </div>
      ) : null}

      <input
        onKeyDown={handleQueryKeyDown}
        className={inputCls}
        placeholder="Computer Science + Enter (bir neçə ixtisas — OR)"
      />

      <select
        value=""
        onChange={(e) => toggleField(e.target.value)}
        className={inputCls}
      >
        <option value="">+ İxtisas əlavə et</option>
        {FIELD_GROUPS.map((group) => (
          <optgroup key={group.id} label={group.label}>
          