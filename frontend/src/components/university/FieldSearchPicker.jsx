import { useTranslation } from 'react-i18next'
import { FIELD_GROUPS } from '../../lib/universityFieldCatalog'
import { fieldGroupLabel, fieldOptionLabel } from '../../lib/universityFieldI18n'
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

export default function FieldSearchPicker({ value, onChange, label }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
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

  const fieldLabel = (slug) => fieldOptionLabel(slug, lang)

  return (
    <div className="space-y-2">
      {label ? (
        <label className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{label}</label>
      ) : null}

      {selected.length ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => toggleField(slug)}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs text-white"
            >
              {fieldLabel(slug)}
              <span className="text-gray-400">×</span>
            </button>
          ))}
        </div>
      ) : null}

      <input
        onKeyDown={handleQueryKeyDown}
        className={inputCls}
        placeholder={t('universitySearch.picker.fieldQueryPlaceholder')}
      />

      <select
        value=""
        onChange={(e) => toggleField(e.target.value)}
        className={inputCls}
      >
        <option value="">{t('universitySearch.picker.addField')}</option>
        {FIELD_GROUPS.map((group) => (
          <optgroup key={group.id} label={fieldGroupLabel(group.id, lang)}>
            {group.options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {fieldOptionLabel(opt.value, lang)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <p className="text-[11px] text-gray-500">{t('universitySearch.picker.fieldsOrHint')}</p>
    </div>
  )
}
