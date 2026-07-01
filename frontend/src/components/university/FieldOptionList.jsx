import { FIELD_GROUPS } from '../../lib/universityFieldCatalog'
import { fieldGroupLabel, fieldOptionLabel } from '../../lib/universityFieldI18n'

/**
 * Custom ixtisas siyahısı — native <select> macOS-da dil dəyişəndə AZ saxlayır.
 * @param {'single' | 'multi'} mode
 */
export default function FieldOptionList({
  locale,
  value,
  values = [],
  onChange,
  mode = 'single',
  maxHeight = 'max-h-72',
}) {
  const selectedSet = mode === 'multi' ? new Set(values) : new Set(value ? [value] : [])

  const pick = (slug) => {
    if (mode === 'multi') {
      const next = selectedSet.has(slug)
        ? values.filter((v) => v !== slug)
        : [...values, slug]
      onChange?.(next)
      return
    }
    onChange?.(slug)
  }

  return (
    <div className={`overflow-y-auto space-y-4 pr-1 ${maxHeight}`}>
      {FIELD_GROUPS.map((group) => (
        <section key={group.id}>
          <p className="text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5 px-0.5">
            {fieldGroupLabel(group.id, locale)}
          </p>
          <div className="space-y-0.5">
            {group.options.map((opt) => {
              const active = selectedSet.has(opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => pick(opt.value)}
                  className={[
                    'w-full text-left rounded-lg px-2.5 py-2 text-sm transition-colors',
                    active
                      ? 'bg-primary/15 text-white border border-primary/30'
                      : 'text-gray-300 hover:bg-white/5 border border-transparent',
                  ].join(' ')}
                >
                  {fieldOptionLabel(opt.value, locale)}
                </button>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
