import { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../lib/api'

const FORMAT_OPTIONS = [
  { value: 'any', label: 'Fərq etmir' },
  { value: 'online', label: 'Onlayn' },
  { value: 'teacher_place', label: 'Canlı (Müəllimin yanında)' },
  { value: 'student_place', label: 'Canlı (Mənim evimdə)' },
]

export default function DiscoverSearchFilters({ value, onChange }) {
  const [categoryQuery, setCategoryQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [areas, setAreas] = useState([])
  const [searching, setSearching] = useState(false)

  const v = value || {}
  const showLocation = v.format === 'teacher_place' || v.format === 'student_place'

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await api.get('/public/service-areas')
        if (!cancelled && res?.success) setAreas(Array.isArray(res.areas) ? res.areas : [])
      } catch {
        if (!cancelled) setAreas([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const runSearch = useCallback(async (q) => {
    const term = String(q || '').trim()
    if (term.length < 2) {
      setSuggestions([])
      return
    }
    setSearching(true)
    try {
      const res = await api.get('/public/categories/search', { params: { q: term, limit: 12 } })
      setSuggestions(res?.success && Array.isArray(res.results) ? res.results : [])
    } catch {
      setSuggestions([])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => void runSearch(categoryQuery), 280)
    return () => window.clearTimeout(t)
  }, [categoryQuery, runSearch])

  const selectedLabel = useMemo(() => {
    if (v.category_name) return v.category_name
    if (v.category_id) return v.category_id
    return ''
  }, [v.category_id, v.category_name])

  const patch = (partial) => onChange?.({ ...v, ...partial })

  return (
    <div className="space-y-3">
      <div>
        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1.5">
          Nə öyrənmək istəyirsiniz?
        </label>
        <div className="relative">
          <input
            type="search"
            value={categoryQuery || (selectedLabel && !categoryQuery ? selectedLabel : '')}
            onChange={(e) => {
              setCategoryQuery(e.target.value)
              if (!e.target.value.trim()) patch({ category_id: null, category_slug: null, category_name: null })
            }}
            placeholder="Riyaziyyat, Python, IELTS…"
            className="w-full rounded-xl border border-white/15 bg-[#13112e] px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-primary/50 focus:outline-none"
          />
          {searching ? (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500">…</span>
          ) : null}
          {suggestions.length > 0 && categoryQuery.trim().length >= 2 ? (
            <ul className="absolute z-50 left-0 right-0 mt-1 max-h-48 overflow-y-auto rounded-xl border border-white/15 bg-[#1a1a2e] shadow-xl">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-primary/15"
                    onClick={() => {
                      patch({
                        category_id: s.id,
                        category_slug: s.slug,
                        category_name: s.name_az,
                      })
                      setCategoryQuery('')
                      setSuggestions([])
                    }}
                  >
                    {s.name_az}
                    {s.is_popular ? <span className="ml-2 text-[10px] text-amber-400">Populyar</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {selectedLabel && !categoryQuery ? (
          <button
            type="button"
            className="mt-1 text-[11px] text-primary hover:underline"
            onClick={() => patch({ category_id: null, category_slug: null, category_name: null })}
          >
            Seçimi sil: {selectedLabel}
          </button>
        ) : null}
      </div>

      <div>
        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1.5">
          Dərs formatı
        </label>
        <div className="flex flex-wrap gap-1.5">
          {FORMAT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                patch({
                  format: opt.value,
                  area_id: opt.value === 'any' || opt.value === 'online' ? null : v.area_id,
                })
              }
              className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors ${
                (v.format || 'any') === opt.value
                  ? 'bg-primary/20 border-primary/50 text-primary'
                  : 'border-white/15 text-gray-400 hover:border-white/25'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {showLocation ? (
        <div>
          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide block mb-1.5">
            Harada?
          </label>
          <select
            className="w-full rounded-xl border border-white/15 bg-[#13112e] px-3 py-2 text-sm text-white"
            value={v.area_id || ''}
            onChange={(e) => patch({ area_id: e.target.value || null })}
          >
            <option value="">Rayon və ya metro seçin</option>
            <optgroup label="Populyar">
              {areas
                .filter((a) => a.is_popular)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name_az} ({a.kind === 'metro' ? 'Metro' : 'Rayon'})
                  </option>
                ))}
            </optgroup>
            <optgroup label="Digər">
              {areas
                .filter((a) => !a.is_popular)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name_az}
                  </option>
                ))}
            </optgroup>
          </select>
        </div>
      ) : null}
    </div>
  )
}
