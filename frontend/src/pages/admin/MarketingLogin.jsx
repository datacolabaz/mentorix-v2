import { useEffect, useState } from 'react'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import api from '../../lib/api'
import { ACCENT_OPTIONS, deepClone, defaultLoginMarketingPayload } from '../../constants/defaultLoginMarketing'

const inp =
  'w-full bg-[#13112e] border border-indigo-500/20 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-blue-500'
const lbl = 'block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2'

function parseCalendarDays(text) {
  return String(text || '')
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 14)
}

export default function MarketingLogin() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [landing, setLanding] = useState(() => deepClone(defaultLoginMarketingPayload()))
  const [defaults, setDefaults] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      try {
        const data = await api.get('/admin/marketing/login')
        if (cancelled) return
        if (data?.success && data.landing) {
          setLanding(deepClone(data.landing))
          setDefaults(data.defaults ? deepClone(data.defaults) : deepClone(defaultLoginMarketingPayload()))
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

  const save = async () => {
    setSaving(true)
    try {
      const data = await api.put('/admin/marketing/login', { landing })
      if (data?.success && data.landing) {
        setLanding(deepClone(data.landing))
        toast('Landing məzmunu yadda saxlandı', 'success')
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
    const base = defaults || defaultLoginMarketingPayload()
    setLanding(deepClone(base))
    toast('Defolt məzmun yükləndi (hələ saxlamamısınız)', 'success')
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[40vh] text-gray-400 text-sm">Yüklənir…</div>
    )
  }

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-4xl mx-auto w-full space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-xl sm:text-2xl break-words">Login / landing məzmunu</h1>
          <p className="text-sm text-gray-500 mt-1">Mətnlər və dinamik bloklar (imkanlar, FAQ və s.)</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" className="justify-center" onClick={resetToDefaults}>
            Defolta qaytar
          </Button>
          <Button type="button" loading={saving} className="justify-center min-w-[140px]" onClick={() => void save()}>
            Saxla
          </Button>
        </div>
      </div>

      <Card className="p-4 sm:p-6 space-y-4">
        <h2 className="font-display font-bold text-base">Hero</h2>
        {[
          ['pill', 'Pill'],
          ['headline', 'Başlıq'],
          ['subheadline', 'Alt başlıq'],
          ['primary_cta_label', 'Əsas CTA düyməsi'],
          ['secondary_how', '"Necə işləyir?"'],
          ['secondary_demo', '"Demo bax"'],
          ['existing_account', 'Mövcud hesab linki'],
        ].map(([k, label]) => (
          <div key={k}>
            <label className={lbl}>{label}</label>
            <input
              className={inp}
              value={landing.hero[k] ?? ''}
              onChange={(e) =>
                setLanding((L) => ({ ...L, hero: { ...L.hero, [k]: e.target.value } }))
              }
            />
          </div>
        ))}
      </Card>

      <Card className="p-4 sm:p-6 space-y-4">
        <h2 className="font-display font-bold text-base">Mini prevyu paneli</h2>
        {[
          ['title', 'Başlıq'],
          ['badge', 'Nişan'],
          ['col1_label', 'Sütun 1 etiket'],
          ['col2_label', 'Sütun 2 etiket'],
          ['col2_value', 'Sütun 2 dəyər'],
          ['col3_label', 'Sütun 3 etiket'],
          ['col3_value', 'Sütun 3 dəyər'],
          ['calendar_title', 'Təqvim başlığı'],
          ['slot1_time', 'Slot 1 saat'],
          ['slot2_time', 'Slot 2 saat'],
        ].map(([k, label]) => (
          <div key={k}>
            <label className={lbl}>{label}</label>
            <input
              className={inp}
              value={landing.mini_preview[k] ?? ''}
              onChange={(e) =>
                setLanding((L) => ({
                  ...L,
                  mini_preview: { ...L.mini_preview, [k]: e.target.value },
                }))
              }
            />
          </div>
        ))}
        <div>
          <label className={lbl}>Həftə günləri (hər sətirdə və ya vergüllə)</label>
          <textarea
            className={`${inp} min-h-[88px]`}
            value={(landing.mini_preview.calendar_days || []).join('\n')}
            onChange={(e) =>
              setLanding((L) => ({
                ...L,
                mini_preview: { ...L.mini_preview, calendar_days: parseCalendarDays(e.target.value) },
              }))
            }
          />
        </div>
      </Card>

      <Card className="p-4 sm:p-6 space-y-4">
        <h2 className="font-display font-bold text-base">İnam bloku</h2>
        <div>
          <label className={lbl}>Başlıq</label>
          <input
            className={inp}
            value={landing.trust.heading}
            onChange={(e) => setLanding((L) => ({ ...L, trust: { ...L.trust, heading: e.target.value } }))}
          />
        </div>
        <div>
          <label className={lbl}>Tələbə sətri (məs. “… tələbə idarə olunur” üçün son hissə)</label>
          <input
            className={inp}
            value={landing.trust.students_suffix}
            onChange={(e) =>
              setLanding((L) => ({ ...L, trust: { ...L.trust, students_suffix: e.target.value } }))
            }
          />
        </div>
        <div>
          <label className={lbl}>Müəllim sətiri</label>
          <input
            className={inp}
            value={landing.trust.instructors_suffix}
            onChange={(e) =>
              setLanding((L) => ({ ...L, trust: { ...L.trust, instructors_suffix: e.target.value } }))
            }
          />
        </div>
        <div>
          <label className={lbl}>Davamiyyət alt qeydi</label>
          <textarea
            className={`${inp} min-h-[72px]`}
            value={landing.trust.attendance_footnote}
            onChange={(e) =>
              setLanding((L) => ({ ...L, trust: { ...L.trust, attendance_footnote: e.target.value } }))
            }
          />
        </div>
      </Card>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display font-bold text-base">Niyə bölməsi</h2>
          <Button
            type="button"
            variant="secondary"
            className="text-xs shrink-0"
            onClick={() =>
              setLanding((L) => ({
                ...L,
                why: { ...L.why, cards: [...L.why.cards, { title: '', body: '' }] },
              }))
            }
          >
            Kart əlavə et
          </Button>
        </div>
        <div>
          <label className={lbl}>Bölmə başlığı</label>
          <input
            className={inp}
            value={landing.why.heading}
            onChange={(e) => setLanding((L) => ({ ...L, why: { ...L.why, heading: e.target.value } }))}
          />
        </div>
        {landing.why.cards.map((c, i) => (
          <div key={i} className="p-3 rounded-xl border border-indigo-500/15 space-y-2">
            <div className="flex justify-between gap-2">
              <span className="text-xs text-gray-500">Kart {i + 1}</span>
              <button
                type="button"
                className="text-xs text-red-400 hover:text-red-300"
                onClick={() =>
                  setLanding((L) => ({
                    ...L,
                    why: { ...L.why, cards: L.why.cards.filter((_, j) => j !== i) },
                  }))
                }
              >
                Sil
              </button>
            </div>
            <input
              className={inp}
              placeholder="Başlıq"
              value={c.title}
              onChange={(e) =>
                setLanding((L) => ({
                  ...L,
                  why: {
                    ...L.why,
                    cards: L.why.cards.map((row, j) => (j === i ? { ...row, title: e.target.value } : row)),
                  },
                }))
              }
            />
            <textarea
              className={`${inp} min-h-[80px]`}
              placeholder="Mətn"
              value={c.body}
              onChange={(e) =>
                setLanding((L) => ({
                  ...L,
                  why: {
                    ...L.why,
                    cards: L.why.cards.map((row, j) => (j === i ? { ...row, body: e.target.value } : row)),
                  },
                }))
              }
            />
          </div>
        ))}
      </Card>

      <Card className="p-4 sm:p-6 space-y-4">
        <h2 className="font-display font-bold text-base">Top müəllimlər</h2>
        <div>
          <label className={lbl}>Başlıq</label>
          <input
            className={inp}
            value={landing.top_teachers.heading}
            onChange={(e) =>
              setLanding((L) => ({ ...L, top_teachers: { ...L.top_teachers, heading: e.target.value } }))
            }
          />
        </div>
        {[
          ['preview_before', 'Prevyu — mətn (əvvəl)'],
          ['preview_emphasis', 'Prevyu — vurğulanan hissə'],
          ['preview_after', 'Prevyu — mətn (sonra)'],
          ['description_real', 'Real statistikada təsvir'],
          ['rating_fallback', 'Reytinq yoxdursa mətn'],
          ['pupil_suffix', '"Şagird" son hissəsi'],
        ].map(([k, label]) => (
          <div key={k}>
            <label className={lbl}>{label}</label>
            {k.includes('preview') || k === 'description_real' ? (
              <textarea
                className={`${inp} min-h-[64px]`}
                value={landing.top_teachers[k] ?? ''}
                onChange={(e) =>
                  setLanding((L) => ({
                    ...L,
                    top_teachers: { ...L.top_teachers, [k]: e.target.value },
                  }))
                }
              />
            ) : (
              <input
                className={inp}
                value={landing.top_teachers[k] ?? ''}
                onChange={(e) =>
                  setLanding((L) => ({
                    ...L,
                    top_teachers: { ...L.top_teachers, [k]: e.target.value },
                  }))
                }
              />
            )}
          </div>
        ))}
      </Card>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display font-bold text-base">Addımlar</h2>
          <Button
            type="button"
            variant="secondary"
            className="text-xs shrink-0"
            onClick={() =>
              setLanding((L) => ({
                ...L,
                steps: {
                  ...L.steps,
                  items: [...L.steps.items, { step: String(L.steps.items.length + 1), title: '', body: '' }],
                },
              }))
            }
          >
            Addım əlavə et
          </Button>
        </div>
        <div>
          <label className={lbl}>Bölmə başlığı</label>
          <input
            className={inp}
            value={landing.steps.heading}
            onChange={(e) =>
              setLanding((L) => ({ ...L, steps: { ...L.steps, heading: e.target.value } }))
            }
          />
        </div>
        {landing.steps.items.map((it, i) => (
          <div key={i} className="p-3 rounded-xl border border-indigo-500/15 space-y-2">
            <div className="flex justify-between gap-2">
              <span className="text-xs text-gray-500">Addım {i + 1}</span>
              <button
                type="button"
                className="text-xs text-red-400 hover:text-red-300"
                onClick={() =>
                  setLanding((L) => ({
                    ...L,
                    steps: { ...L.steps, items: L.steps.items.filter((_, j) => j !== i) },
                  }))
                }
              >
                Sil
              </button>
            </div>
            <input
              className={inp}
              placeholder="№"
              value={it.step}
              onChange={(e) =>
                setLanding((L) => ({
                  ...L,
                  steps: {
                    ...L.steps,
                    items: L.steps.items.map((row, j) =>
                      j === i ? { ...row, step: e.target.value } : row,
                    ),
                  },
                }))
              }
            />
            <input
              className={inp}
              placeholder="Başlıq"
              value={it.title}
              onChange={(e) =>
                setLanding((L) => ({
                  ...L,
                  steps: {
                    ...L.steps,
                    items: L.steps.items.map((row, j) =>
                      j === i ? { ...row, title: e.target.value } : row,
                    ),
                  },
                }))
              }
            />
            <textarea
              className={`${inp} min-h-[80px]`}
              placeholder="Mətn"
              value={it.body}
              onChange={(e) =>
                setLanding((L) => ({
                  ...L,
                  steps: {
                    ...L.steps,
                    items: L.steps.items.map((row, j) =>
                      j === i ? { ...row, body: e.target.value } : row,
                    ),
                  },
                }))
              }
            />
          </div>
        ))}
      </Card>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display font-bold text-base">İmkanlar (features)</h2>
          <Button
            type="button"
            variant="secondary"
            className="text-xs shrink-0"
            onClick={() =>
              setLanding((L) => ({
                ...L,
                features: {
                  ...L.features,
                  items: [
                    ...L.features.items,
                    { title: '', body: '', accent: ACCENT_OPTIONS[0] },
                  ],
                },
              }))
            }
          >
            Sətir əlavə et
          </Button>
        </div>
        <div>
          <label className={lbl}>Bölmə başlığı</label>
          <input
            className={inp}
            value={landing.features.heading}
            onChange={(e) =>
              setLanding((L) => ({ ...L, features: { ...L.features, heading: e.target.value } }))
            }
          />
        </div>
        {landing.features.items.map((it, i) => (
          <div key={i} className="p-3 rounded-xl border border-indigo-500/15 space-y-2">
            <div className="flex justify-between gap-2">
              <span className="text-xs text-gray-500">Feature {i + 1}</span>
              <button
                type="button"
                className="text-xs text-red-400 hover:text-red-300"
                onClick={() =>
                  setLanding((L) => ({
                    ...L,
                    features: { ...L.features, items: L.features.items.filter((_, j) => j !== i) },
                  }))
                }
              >
                Sil
              </button>
            </div>
            <input
              className={inp}
              placeholder="Başlıq"
              value={it.title}
              onChange={(e) =>
                setLanding((L) => ({
                  ...L,
                  features: {
                    ...L.features,
                    items: L.features.items.map((row, j) =>
                      j === i ? { ...row, title: e.target.value } : row,
                    ),
                  },
                }))
              }
            />
            <textarea
              className={`${inp} min-h-[72px]`}
              placeholder="Mətn"
              value={it.body}
              onChange={(e) =>
                setLanding((L) => ({
                  ...L,
                  features: {
                    ...L.features,
                    items: L.features.items.map((row, j) =>
                      j === i ? { ...row, body: e.target.value } : row,
                    ),
                  },
                }))
              }
            />
            <div>
              <label className={lbl}>Aksent (gradient)</label>
              <select
                className={inp}
                value={it.accent}
                onChange={(e) =>
                  setLanding((L) => ({
                    ...L,
                    features: {
                      ...L.features,
                      items: L.features.items.map((row, j) =>
                        j === i ? { ...row, accent: e.target.value } : row,
                      ),
                    },
                  }))
                }
              >
                {ACCENT_OPTIONS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </Card>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display font-bold text-base">Real ssenari</h2>
          <Button
            type="button"
            variant="secondary"
            className="text-xs shrink-0"
            onClick={() =>
              setLanding((L) => ({
                ...L,
                use_case: {
                  ...L.use_case,
                  bullets: [...L.use_case.bullets, { lead: '', rest: '' }],
                },
              }))
            }
          >
            Güllə əlavə et
          </Button>
        </div>
        <div>
          <label className={lbl}>Bölmə başlığı</label>
          <input
            className={inp}
            value={landing.use_case.heading}
            onChange={(e) =>
              setLanding((L) => ({ ...L, use_case: { ...L.use_case, heading: e.target.value } }))
            }
          />
        </div>
        <div>
          <label className={lbl}>Sətir başlığı</label>
          <input
            className={inp}
            value={landing.use_case.title_line}
            onChange={(e) =>
              setLanding((L) => ({ ...L, use_case: { ...L.use_case, title_line: e.target.value } }))
            }
          />
        </div>
        {landing.use_case.bullets.map((b, i) => (
          <div key={i} className="p-3 rounded-xl border border-indigo-500/15 space-y-2">
            <div className="flex justify-between gap-2">
              <span className="text-xs text-gray-500">Güllə {i + 1}</span>
              <button
                type="button"
                className="text-xs text-red-400 hover:text-red-300"
                onClick={() =>
                  setLanding((L) => ({
                    ...L,
                    use_case: {
                      ...L.use_case,
                      bullets: L.use_case.bullets.filter((_, j) => j !== i),
                    },
                  }))
                }
              >
                Sil
              </button>
            </div>
            <input
              className={inp}
              placeholder="Lead"
              value={b.lead}
              onChange={(e) =>
                setLanding((L) => ({
                  ...L,
                  use_case: {
                    ...L.use_case,
                    bullets: L.use_case.bullets.map((row, j) =>
                      j === i ? { ...row, lead: e.target.value } : row,
                    ),
                  },
                }))
              }
            />
            <textarea
              className={`${inp} min-h-[64px]`}
              placeholder="Mətn"
              value={b.rest}
              onChange={(e) =>
                setLanding((L) => ({
                  ...L,
                  use_case: {
                    ...L.use_case,
                    bullets: L.use_case.bullets.map((row, j) =>
                      j === i ? { ...row, rest: e.target.value } : row,
                    ),
                  },
                }))
              }
            />
          </div>
        ))}
        <div>
          <label className={lbl}>FAQ keçid mətni</label>
          <input
            className={inp}
            value={landing.use_case.faq_link}
            onChange={(e) =>
              setLanding((L) => ({ ...L, use_case: { ...L.use_case, faq_link: e.target.value } }))
            }
          />
        </div>
      </Card>

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display font-bold text-base">FAQ</h2>
          <Button
            type="button"
            variant="secondary"
            className="text-xs shrink-0"
            onClick={() =>
              setLanding((L) => ({
                ...L,
                faq: { ...L.faq, items: [...L.faq.items, { q: '', a: '' }] },
              }))
            }
          >
            Sual əlavə et
          </Button>
        </div>
        <div>
          <label className={lbl}>Başlıq</label>
          <input
            className={inp}
            value={landing.faq.heading}
            onChange={(e) =>
              setLanding((L) => ({ ...L, faq: { ...L.faq, heading: e.target.value } }))
            }
          />
        </div>
        {landing.faq.items.map((it, i) => (
          <div key={i} className="p-3 rounded-xl border border-indigo-500/15 space-y-2">
            <div className="flex justify-between gap-2">
              <span className="text-xs text-gray-500">Sual {i + 1}</span>
              <button
                type="button"
                className="text-xs text-red-400 hover:text-red-300"
                onClick={() =>
                  setLanding((L) => ({
                    ...L,
                    faq: { ...L.faq, items: L.faq.items.filter((_, j) => j !== i) },
                  }))
                }
              >
                Sil
              </button>
            </div>
            <input
              className={inp}
              placeholder="Sual"
              value={it.q}
              onChange={(e) =>
                setLanding((L) => ({
                  ...L,
                  faq: {
                    ...L.faq,
                    items: L.faq.items.map((row, j) =>
                      j === i ? { ...row, q: e.target.value } : row,
                    ),
                  },
                }))
              }
            />
            <textarea
              className={`${inp} min-h-[100px]`}
              placeholder="Cavab"
              value={it.a}
              onChange={(e) =>
                setLanding((L) => ({
                  ...L,
                  faq: {
                    ...L.faq,
                    items: L.faq.items.map((row, j) =>
                      j === i ? { ...row, a: e.target.value } : row,
                    ),
                  },
                }))
              }
            />
          </div>
        ))}
      </Card>

      <Card className="p-4 sm:p-6 space-y-4">
        <h2 className="font-display font-bold text-base">Alt CTA zolağı</h2>
        <div>
          <label className={lbl}>Başlıq</label>
          <input
            className={inp}
            value={landing.cta_band.heading}
            onChange={(e) =>
              setLanding((L) => ({
                ...L,
                cta_band: { ...L.cta_band, heading: e.target.value },
              }))
            }
          />
        </div>
        <div>
          <label className={lbl}>Alt mətn</label>
          <textarea
            className={`${inp} min-h-[72px]`}
            value={landing.cta_band.subtitle}
            onChange={(e) =>
              setLanding((L) => ({
                ...L,
                cta_band: { ...L.cta_band, subtitle: e.target.value },
              }))
            }
          />
        </div>
      </Card>

      <div className="flex justify-end pb-8">
        <Button type="button" loading={saving} className="justify-center min-w-[160px]" onClick={() => void save()}>
          Saxla
        </Button>
      </div>
    </div>
  )
}
