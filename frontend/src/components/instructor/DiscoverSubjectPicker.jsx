import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'

export default function DiscoverSubjectPicker({
  categoryIds,
  pickedCats,
  onAdd,
  onRemove,
  inp,
  theme,
  sectionTitleCls,
  inputId,
}) {
  const { t } = useTranslation()
  const [catSearch, setCatSearch] = useState('')
  const [catSuggestions, setCatSuggestions] = useState([])

  useEffect(() => {
    const q = catSearch.trim()
    if (q.length < 2) {
      setCatSuggestions([])
      return
    }
    const timer = window.setTimeout(() => {
      void api.get('/public/categories/search', { params: { q, limit: 10 } }).then((res) => {
        setCatSuggestions(res?.success && Array.isArray(res.results) ? res.results : [])
      })
    }, 280)
    return () => window.clearTimeout(timer)
  }, [catSearch])

  const add = (cat) => {
    onAdd?.(cat)
    setCatSearch('')
    setCatSuggestions([])
  }

  return (
    <section id={inputId} className="scroll-mt-24">
      <p className={sectionTitleCls}>{t('settings.discover.subjectsTitle')}</p>
      <p className={['text-xs mb-2 leading-relaxed', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>
        {t('settings.mapSubjectsHint')}
      </p>
      <input
        type="search"
        value={catSearch}
        onChange={(e) => setCatSearch(e.target.value)}
        placeholder={t('settings.discover.subjectsPh')}
        autoComplete="off"
        className={inp}
      />
      {catSuggestions.length > 0 ? (
        <ul
          className={[
            'mt-2 rounded-xl border max-h-40 overflow-y-auto',
            theme === 'dark' ? 'border-white/10 bg-[#1a1a2e]' : 'border-slate-200 bg-white shadow-md',
          ].join(' ')}
        >
          {catSuggestions.map((c) => (
            <li key={c.id} className="border-b last:border-b-0 border-black/5 dark:border-white/5">
              <button
                type="button"
                className={[
                  'w-full text-left px-3 py-3 text-sm min-h-[44px]',
                  theme === 'dark' ? 'hover:bg-primary/10 text-gray-100' : 'hover:bg-primary/5 text-token-textMain',
                ].join(' ')}
                onClick={() => add(c)}
              >
                {c.name_az}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {pickedCats.length > 0 ? (
        <div className="flex flex-wrap gap-2 mt-3">
          {pickedCats.map((c) => (
            <span
              key={c.id}
              className={[
                'inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl border max-w-full',
                theme === 'dark'
                  ? 'bg-primary/15 border-primary/30 text-primary'
                  : 'bg-primary/5 border-primary/25 text-token-textMain',
              ].join(' ')}
            >
              <span className="truncate">{c.name_az}</span>
              <button
                type="button"
                className="shrink-0 w-5 h-5 rounded-md opacity-70 hover:opacity-100 leading-none"
                aria-label={t('settings.discover.removeSubject', { name: c.name_az })}
                onClick={() => onRemove?.(c.id)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : (
        <p className={['text-xs mt-2', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>
          {t('settings.discover.needOneSubject')}
        </p>
      )}
      {categoryIds.length === 0 ? (
        <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
          {t('settings.discover.emptyDesc')}
        </div>
      ) : null}
    </section>
  )
}
