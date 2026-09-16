import { useTranslation } from 'react-i18next'
import useActiveLocale from '../../hooks/useActiveLocale'
import { fieldOptionLabel } from '../../lib/universityFieldI18n'
import { resolveFieldFromQuery } from '../../lib/universitySearch'
import FieldOptionList from './FieldOptionList'
import useUiStore from '../../hooks/useUi'

const inputCls = (light) =>
  light
    ? 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary/50'
    : 'w-full rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50'

function parseFields(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((s) => s.trim()).filter(Boolean)
  }
  return []
}

export default function FieldSearchPicker({ value, onChange, label }) {
  const { t } = useTranslation()
  const locale = useActiveLocale()
  const theme = useUiStore((s) => s.theme)
  const light = theme !== 'dark'
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
    <div className="space-y-2" key={`field-picker-${locale}`}>
      {label ? (
        <label className={['text-[10px] font-bold uppercase tracking-wide', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>{label}</label>
      ) : null}

      {selected.length ? (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => toggleField(slug)}
              className={['inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs', light ? 'text-slate-900' : 'text-white'].join(' ')}
            >
              {fieldOptionLabel(slug, locale)}
              <span className={light ? 'text-slate-500' : 'text-gray-400'}>×</span>
            </button>
          ))}
        </div>
      ) : null}

      <input
        onKeyDown={handleQueryKeyDown}
        className={inputCls(light)}
        placeholder={t('universitySearch.picker.fieldQueryPlaceholder')}
      />

      <div className={['rounded-xl border p-2', light ? 'border-slate-200 bg-slate-50' : 'border-white/10 bg-[#1c1c1c]'].join(' ')}>
        <p className={['text-[10px] font-bold uppercase tracking-wide mb-2 px-0.5', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>
          {t('universitySearch.picker.addField')}
        </p>
        <FieldOptionList
          locale={locale}
          values={selected}
          mode="multi"
          maxHeight="max-h-52"
          onChange={(next) => onChange?.(next)}
        />
      </div>
      <p className={['text-[11px]', light ? 'text-slate-500' : 'text-gray-500'].join(' ')}>{t('universitySearch.picker.fieldsOrHint')}</p>
    </div>
  )
}
