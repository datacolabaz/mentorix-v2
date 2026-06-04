import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../lib/api'
import Card from '../common/Card'
import Button from '../common/Button'
import { useToast } from '../common/Toast'
import { groupServiceAreas } from '../../lib/serviceAreaGroups'

const FORMAT_OPTS = [
  { id: 'online', label: '💻 Onlayn' },
  { id: 'teacher_place', label: '🏢 Canlı — Müəllimin yanında' },
  { id: 'student_place', label: '🏡 Canlı — Tələbənin evində' },
]

export default function InstructorDiscoverSettings({ mapVisible, theme, inp }) {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [premium, setPremium] = useState(false)
  const [limits, setLimits] = useState(null)
  const [formats, setFormats] = useState([])
  const [categoryIds, setCategoryIds] = useState([])
  const [areaIds, setAreaIds] = useState([])
  const [hourlyRate, setHourlyRate] = useState('')
  const [bio, setBio] = useState('')
  const [address, setAddress] = useState('')
  const [areas, setAreas] = useState([])
  const [catSearch, setCatSearch] = useState('')
  const [catSuggestions, setCatSuggestions] = useState([])
  const [pickedCats, setPickedCats] = useState([])
  const [areaFilter, setAreaFilter] = useState('')

  const areaGroups = useMemo(() => groupServiceAreas(areas), [areas])
  const filterAreaList = useCallback(
    (list) => {
      const q = areaFilter.trim().toLowerCase()
      if (!q) return list
      return list.filter((a) => String(a.name_az || '').toLowerCase().includes(q))
    },
    [areaFilter],
  )

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [disc, areaRes] = await Promise.all([
        api.get('/instructor/discover-profile'),
        api.get('/public/service-areas'),
      ])
      setPremium(Boolean(disc?.premium))
      setLimits(disc?.limits || null)
      setFormats((disc?.delivery_formats || []).map((f) => f.format))
      setCategoryIds((disc?.categories || []).map((c) => c.id))
      setPickedCats(disc?.categories || [])
      setAreaIds((disc?.service_areas || []).map((a) => a.id))
      setHourlyRate(disc?.profile?.discover_hourly_rate != null ? String(disc.profile.discover_hourly_rate) : '')
      setBio(disc?.profile?.discover_bio || '')
      setAddress(disc?.profile?.teacher_place_address || '')
      if (areaRes?.success) setAreas(Array.isArray(areaRes.areas) ? areaRes.areas : [])
    } catch (e) {
      toast(e?.message || 'Yüklənmədi', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const q = catSearch.trim()
    if (q.length < 2) {
      setCatSuggestions([])
      return
    }
    const t = window.setTimeout(() => {
      void api.get('/public/categories/search', { params: { q, limit: 10 } }).then((res) => {
        setCatSuggestions(res?.success && Array.isArray(res.results) ? res.results : [])
      })
    }, 280)
    return () => window.clearTimeout(t)
  }, [catSearch])

  const toggleFormat = (id) => {
    const max = premium ? 3 : 1
    setFormats((prev) => {
      if (prev.includes(id)) return prev.filter((f) => f !== id)
      if (prev.length >= max) {
        toast(premium ? 'Ən çox 3 format' : 'Pulsuz paketdə yalnız 1 format seçə bilərsiniz', 'error')
        return prev
      }
      return [...prev, id]
    })
  }

  const addCategory = (cat) => {
    const max = premium ? 50 : limits?.max_categories || 5
    if (categoryIds.includes(cat.id)) return
    if (categoryIds.length >= max) {
      toast(`Ən çox ${max} fənn seçə bilərsiniz`, 'error')
      return
    }
    setCategoryIds((ids) => [...ids, cat.id])
    setPickedCats((list) => [...list, cat])
    setCatSearch('')
    setCatSuggestions([])
  }

  const toggleArea = (id) => {
    const max = premium ? 100 : 1
    setAreaIds((prev) => {
      if (prev.includes(id)) return prev.filter((a) => a !== id)
      if (prev.length >= max) {
        toast('Pulsuz paketdə yalnız 1 rayon/metro', 'error')
        return prev
      }
      return [...prev, id]
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      await api.patch('/instructor/discover-profile', {
        discover_hourly_rate: hourlyRate === '' ? null : hourlyRate,
        discover_bio: bio,
        teacher_place_address: address,
        category_ids: categoryIds,
        delivery_formats: formats.map((f) => ({
          format: f,
          travel_radius_km: f === 'student_place' ? 15 : 10,
        })),
        service_area_ids: areaIds,
      })
      toast('Axtarış profili saxlanıldı')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card className="animate-pulse h-32" title="Tələbə tapma profili">
        <div className="h-20 bg-white/5 rounded-lg" />
      </Card>
    )
  }

  return (
    <Card id="discover-profile" title="Valideynlər / Tələbələr məni tapa bilsin">
      <p className={['text-sm mb-4', theme === 'dark' ? 'text-gray-400' : 'text-token-textMuted'].join(' ')}>
        Axtarışda görünmək üçün xəritə pinini aktiv edin və fənn, format və rayonları seçin.
        {!mapVisible ? (
          <span className="block text-amber-400/90 mt-1 text-xs">Xəritə görünürlüyü hal-hazırda bağlıdır.</span>
        ) : null}
      </p>

      {!premium ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90 mb-4">
          Pulsuz: 1 format, 1 rayon, ayda 2 sorğu nömrəsi.{' '}
          <Link to="/instructor/settings#billing" className="text-primary font-semibold hover:underline">
            PRO paket
          </Link>{' '}
          — limitsiz format, rayon və sorğular + TOP sıralama.
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300/90 mb-4">
          ✓ Premium axtarış imkanları aktivdir
        </div>
      )}

      <div className="space-y-4">
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Dərs formatları</p>
          <div className="flex flex-col gap-2">
            {FORMAT_OPTS.map((opt) => (
              <label key={opt.id} className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formats.includes(opt.id)}
                  onChange={() => toggleFormat(opt.id)}
                  className="accent-indigo-500 rounded"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold text-gray-500 uppercase mb-2">Tədris etdiyiniz fənlər</p>
          <input
            type="search"
            value={catSearch}
            onChange={(e) => setCatSearch(e.target.value)}
            placeholder="Fənn axtar…"
            className={inp}
          />
          {catSuggestions.length > 0 ? (
            <ul className="mt-1 rounded-lg border border-white/10 bg-[#1a1a2e] max-h-36 overflow-y-auto">
              {catSuggestions.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10"
                    onClick={() => addCategory(c)}
                  >
                    {c.name_az}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {pickedCats.map((c) => (
              <span
                key={c.id}
                className="text-xs px-2 py-1 rounded-lg bg-primary/15 border border-primary/30 text-primary"
              >
                {c.name_az}
                <button
                  type="button"
                  className="ml-1 opacity-70 hover:opacity-100"
                  onClick={() => {
                    setCategoryIds((ids) => ids.filter((id) => id !== c.id))
                    setPickedCats((list) => list.filter((x) => x.id !== c.id))
                  }}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>

        {formats.includes('student_place') || formats.includes('teacher_place') ? (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase mb-2">
              Rayon / şəhər / metro (canlı dərs)
            </p>
            <input
              type="search"
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              placeholder="Rayon axtar… (məs. Gəncə, Lənkəran)"
              className={`${inp} mb-2`}
            />
            <div className="max-h-52 overflow-y-auto space-y-3 pr-1">
              {[
                ['Populyar', areaGroups.popular],
                ['Bakı rayonları', areaGroups.bakuDistricts],
                ['Metro', areaGroups.metros],
                ['Azərbaycan rayonları', areaGroups.regions],
              ].map(([label, list]) => {
                const shown = filterAreaList(list)
                if (!shown.length) return null
                return (
                  <div key={label}>
                    <p className="text-[10px] font-bold text-gray-500 uppercase mb-1.5">{label}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {shown.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleArea(a.id)}
                          className={`text-xs px-2 py-1 rounded-lg border ${
                            areaIds.includes(a.id)
                              ? 'border-primary/50 bg-primary/15 text-primary'
                              : 'border-white/10 text-gray-400'
                          }`}
                        >
                          {a.name_az}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}

        {formats.includes('teacher_place') ? (
          <div>
            <label className="text-xs text-gray-500 block mb-1">Dərs keçdiyiniz ünvan (qısa)</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className={inp} />
          </div>
        ) : null}

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Saatlıq qiymət (AZN)</label>
            <input
              type="number"
              min="0"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(e.target.value)}
              className={inp}
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Qısa təqdimat</label>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className={`${inp} resize-none`} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" loading={saving} onClick={() => void save()}>
            Axtarış profilini saxla
          </Button>
          <Link
            to="/instructor/inquiries"
            className="text-sm font-semibold text-primary hover:underline self-center px-2"
          >
            Xəritə müraciətləri →
          </Link>
        </div>
      </div>
    </Card>
  )
}
