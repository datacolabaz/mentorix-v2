import { useEffect, useMemo, useState } from 'react'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import api from '../../lib/api'
import {
  defaultInstructorNavSections,
  INSTRUCTOR_NAV_ITEM_DEFS,
} from '../../constants/instructorNav'

const inp =
  'w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500'

function cloneSections(sections) {
  return JSON.parse(JSON.stringify(sections || []))
}

function newSectionId(existing) {
  const used = new Set((existing || []).map((s) => s.id))
  let i = 1
  while (used.has(`custom_${i}`)) i += 1
  return `custom_${i}`
}

export default function AdminInstructorNav() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sections, setSections] = useState(() => cloneSections(defaultInstructorNavSections()))
  const [defaults, setDefaults] = useState(null)

  const itemLabel = (key) => INSTRUCTOR_NAV_ITEM_DEFS[key]?.label || key

  const assignedKeys = useMemo(() => {
    const set = new Set()
    for (const sec of sections) {
      for (const key of sec.itemKeys || []) set.add(key)
    }
    return set
  }, [sections])

  const unassignedKeys = useMemo(
    () => Object.keys(INSTRUCTOR_NAV_ITEM_DEFS).filter((k) => !assignedKeys.has(k)),
    [assignedKeys],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const data = await api.get('/admin/instructor-nav')
        if (cancelled) return
        if (data?.success && data?.nav?.sections) {
          setSections(cloneSections(data.nav.sections))
          setDefaults(data.defaults?.sections ? cloneSections(data.defaults.sections) : null)
        }
      } catch (e) {
        if (!cancelled) toast(e?.message || 'Yüklənmədi', 'error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const patchSection = (index, patch) => {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  const moveSection = (index, dir) => {
    setSections((prev) => {
      const next = [...prev]
      const target = index + dir
      if (target < 0 || target >= next.length) return prev
      const tmp = next[index]
      next[index] = next[target]
      next[target] = tmp
      return next
    })
  }

  const removeSection = (index) => {
    setSections((prev) => {
      if (prev.length <= 1) return prev
      const removed = prev[index]
      const next = prev.filter((_, i) => i !== index)
      const fallback = next[0]
      if (fallback && removed?.itemKeys?.length) {
        fallback.itemKeys = [...new Set([...(fallback.itemKeys || []), ...removed.itemKeys])]
      }
      return [...next]
    })
  }

  const addSection = () => {
    setSections((prev) => [
      ...prev,
      {
        id: newSectionId(prev),
        title: 'Yeni bölmə',
        enabled: true,
        itemKeys: unassignedKeys.length ? [unassignedKeys[0]] : [],
      },
    ])
  }

  const toggleItem = (sectionIndex, key) => {
    setSections((prev) =>
      prev.map((sec, i) => {
        const keys = [...(sec.itemKeys || [])]
        if (i === sectionIndex) {
          if (keys.includes(key)) return { ...sec, itemKeys: keys.filter((k) => k !== key) }
          return { ...sec, itemKeys: [...keys, key] }
        }
        return { ...sec, itemKeys: keys.filter((k) => k !== key) }
      }),
    )
  }

  const save = async () => {
    setSaving(true)
    try {
      const data = await api.put('/admin/instructor-nav', {
        nav: { version: 1, sections },
      })
      if (data?.success && data?.nav?.sections) {
        setSections(cloneSections(data.nav.sections))
        toast('Müəllim menyusu saxlanıldı', 'success')
      } else {
        toast('Naməlum cavab', 'error')
      }
    } catch (e) {
      toast(e?.message || 'Saxlanılmadı', 'error')
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = () => {
    const base = defaults || defaultInstructorNavSections()
    setSections(cloneSections(base))
    toast('Defolt struktur yükləndi (hələ saxlamamısınız)', 'success')
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 text-gray-400 text-sm">Yüklənir…</div>
    )
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-white">Müəllim sidebar menyusu</h1>
        <p className="text-sm text-gray-400 mt-2 max-w-2xl">
          MANAGEMENT, ANALYTICS, SYSTEM kimi bölmə başlıqlarını azərbaycanca dəyişin. Linklər və səhifələr kodda
          qalır — buradan yalnız qrup adları və hansı linkin hansı qrupda görünəcəyini idarə edirsiniz.
        </p>
      </div>

      <div className="space-y-4">
        {sections.map((section, index) => (
          <Card key={`${section.id}-${index}`} className="p-4 sm:p-5 space-y-4 border border-white/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex-1 min-w-[220px] space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Bölmə başlığı (sidebar)
                  </label>
                  <input
                    className={inp}
                    value={section.title}
                    onChange={(e) => patchSection(index, { title: e.target.value })}
                    placeholder="Məs: İDARƏETMƏ"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-indigo-500"
                    checked={section.enabled !== false}
                    onChange={(e) => patchSection(index, { enabled: e.target.checked })}
                  />
                  Bölmə aktivdir
                </label>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button type="button" variant="secondary" size="sm" onClick={() => moveSection(index, -1)} disabled={index === 0}>
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => moveSection(index, 1)}
                  disabled={index === sections.length - 1}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => removeSection(index)}
                  disabled={sections.length <= 1}
                >
                  Sil
                </Button>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Bu bölmədəki linklər
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.keys(INSTRUCTOR_NAV_ITEM_DEFS).map((key) => {
                  const checked = (section.itemKeys || []).includes(key)
                  const inOther = !checked && assignedKeys.has(key)
                  return (
                    <label
                      key={key}
                      className={[
                        'flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer',
                        checked
                          ? 'border-indigo-400/40 bg-indigo-500/10 text-indigo-100'
                          : inOther
                            ? 'border-white/5 bg-black/10 text-gray-500 cursor-not-allowed'
                            : 'border-white/10 bg-black/20 text-gray-300 hover:border-white/20',
                      ].join(' ')}
                    >
                      <input
                        type="checkbox"
                        className="accent-indigo-500"
                        checked={checked}
                        disabled={inOther}
                        onChange={() => toggleItem(index, key)}
                      />
                      <span className="truncate">{itemLabel(key)}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="secondary" onClick={addSection}>
          + Yeni bölmə
        </Button>
        <Button type="button" variant="secondary" onClick={resetToDefaults}>
          Defolta qaytar
        </Button>
        <Button type="button" onClick={save} disabled={saving}>
          {saving ? 'Saxlanır…' : 'Yadda saxla'}
        </Button>
      </div>
    </div>
  )
}
