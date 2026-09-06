import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import Card from '../common/Card'
import Button from '../common/Button'
import { useToast } from '../common/Toast'
import { groupServiceAreas } from '../../lib/serviceAreaGroups'
import { useSubscriptionPlans } from '../../hooks/useSubscriptionPlans'
import { higherPaidPlansSuffix, planTitleOrSlug } from '../../lib/subscriptionPlanGuards'

export default function InstructorDiscoverSettings({ mapVisible, theme, inp }) {
  const { t } = useTranslation()
  const toast = useToast()
  const formatOpts = [
    { id: 'online', label: t('settings.discover.formatOnline') },
    { id: 'teacher_place', label: t('settings.discover.formatTeacherPlace') },
    { id: 'student_place', label: t('settings.discover.formatStudentPlace') },
  ]
  const plansQ = useSubscriptionPlans()
  const plans = Array.isArray(plansQ.data) ? plansQ.data : []
  const proPlanTitle = useMemo(() => {
    const pro = plans.find((p) => String(p?.id || '').toLowerCase() === 'pro')
    return planTitleOrSlug(pro, 'pro')
  }, [plans])
  const paidDiscoverLabel = useMemo(() => higherPaidPlansSuffix(plans, 'basic'), [plans])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [premium, setPremium] = useState(false)
  const [limits, setLimits] = useState(null)
  const [formats, setFormats] = useState([])
  const [categoryIds, setCategoryIds] = useState([])
  const [areaIds, setAreaIds] = useState([])
  const [hourlyRate, setHourlyRate] = useState('')
  const [bio, setBio] = useState('')
  const [education, setEducation] = useState('')
  const [certifications, setCertifications] = useState('')
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
      setEducation(disc?.profile?.discover_education || '')
      setCertifications(disc?.profile?.discover_certifications || '')
      if (areaRes?.success) setAreas(Array.isArray(areaRes.areas) ? areaRes.areas : [])
    } catch (e) {
      toast(e?.message || t('settings.discover.toastLoadFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast, t])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onUpdated = () => {
      void load()
    }
    window.addEventListener('mx:discover-profile-updated', onUpdated)
    return () => window.removeEventListener('mx:discover-profile-updated', onUpdated)
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
        toast(premium ? t('settings.discover.toastMaxFormatsPremium') : t('settings.discover.toastMaxFormatsFree'), 'error')
        return prev
      }
      return [...prev, id]
    })
  }

  const addCategory = (cat) => {
    const max = premium ? 50 : limits?.max_categories || 5
    if (categoryIds.includes(cat.id)) return
    if (categoryIds.length >= max) {
      toast(t('settings.discover.toastMaxSubjects', { max }), 'error')
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
        toast(t('settings.discover.toastMaxAreas'), 'error')
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
        discover_education: education,
        discover_certifications: certifications,
        category_ids: categoryIds,
        delivery_formats: formats.map((f) => ({
          format: f,
          travel_radius_km: f === 'student_place' ? 15 : 10,
        })),
        service_area_ids: areaIds,
      })
      toast(t('settings.discover.toastSaved'))
      window.dispatchEvent(new CustomEvent('mx:discover-profile-updated'))
      await load()
    } catch (e) {
      toast(e?.message || t('settings.discover.toastError'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const sectionTitleCls = [
    'text-[11px] font-bold uppercase tracking-wider mb-2.5',
    theme === 'dark' ? 'text-gray-400' : 'text-token-textMuted',
  ].join(' ')

  const fieldLabelCls = ['text-xs block mb-1.5', theme === 'dark' ? 'text-gray-400' : 'text-token-textMuted'].join(' ')

  const chipBaseCls = [
    'text-xs rounded-xl border text-left transition-colors min-h-[44px] px-3 py-2.5 leading-snug',
    theme === 'dark' ? 'border-white/10' : 'border-slate-200 bg-white',
  ].join(' ')

  const chipActiveCls =
    theme === 'dark'
      ? 'border-primary/50 bg-primary/15 text-primary font-medium'
      : 'border-primary/40 bg-primary/5 text-token-textMain font-medium'

  const chipIdleCls =
    theme === 'dark' ? 'text-gray-300 hover:border-white/20' : 'text-token-textMuted hover:border-slate-300'

  if (loading) {
    return (
      <Card className="animate-pulse h-32 p-5">
        <div className="h-20 bg-black/5 dark:bg-white/5 rounded-lg" />
      </Card>
    )
  }

  return (
    <Card id="discover-profile" data-mentor-id="page:discover-profile" className="p-4 sm:p-5 space-y-4 border border-indigo-500/20">
      <div>
        <h2
          className={[
            'text-sm font-semibold uppercase tracking-wider',
            theme === 'dark' ? 'text-indigo-200/90' : 'text-token-textMain',
          ].join(' ')}
        >
          {t('settings.discover.title')}
        </h2>
      </div>
          <p className={['text-sm', theme === 'dark' ? 'text-gray-400' : 'text-token-textMuted'].join(' ')}>
        {t('settings.discover.desc')}
        {!mapVisible ? (
          <span className="block text-amber-400/90 mt-1 text-xs">{t('settings.discover.visibilityOff')}</span>
        ) : null}
      </p>

      {categoryIds.length === 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-sm text-amber-100/95 space-y-1">
          <p className="font-semibold text-amber-200">{t('settings.discover.emptyTitle')}</p>
          <p className="text-xs text-amber-100/80 leading-relaxed">
            {t('settings.discover.emptyDesc')}
          </p>
        </div>
      ) : null}

      {!premium ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-200/90 mb-4">
          {t('settings.discover.freeHint')}{' '}
          <Link to="/instructor/settings#billing" className="text-primary font-semibold hover:underline">
            {t('settings.discover.proLink', { plan: proPlanTitle })}
          </Link>{' '}
          {t('settings.discover.paidHint')}
        </div>
      ) : (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-300/90 mb-4">
          {t('settings.discover.premiumActive', { plans: paidDiscoverLabel })}
        </div>
      )}

      <div className="space-y-5">
        <section>
          <p className={sectionTitleCls}>{t('settings.discover.formatsTitle')}</p>
          <div className="grid gap-2">
            {formatOpts.map((opt) => {
              const active = formats.includes(opt.id)
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => toggleFormat(opt.id)}
                  className={[
                    'w-full flex items-center gap-3 rounded-xl border px-3 py-3 text-sm text-left min-h-[48px]',
                    theme === 'dark' ? 'transition-colors' : 'transition-colors shadow-sm',
                    active ? chipActiveCls : chipIdleCls,
                    theme === 'dark' && !active ? 'bg-white/[0.03]' : '',
                  ].join(' ')}
                >
                  <span
                    className={[
                      'shrink-0 w-5 h-5 rounded-md border flex items-center justify-center text-[11px]',
                      active
                        ? 'border-primary bg-primary text-[#041018] font-bold'
                        : theme === 'dark'
                          ? 'border-white/20 text-transparent'
                          : 'border-slate-300 text-transparent',
                    ].join(' ')}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span className="min-w-0 break-words">{opt.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <p className={sectionTitleCls}>{t('settings.discover.subjectsTitle')}</p>
          <input
            type="search"
            value={catSearch}
            onChange={(e) => setCatSearch(e.target.value)}
            placeholder={t('settings.discover.subjectsPh')}
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
                    onClick={() => addCategory(c)}
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
          ) : (
            <p className={['text-xs mt-2', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>
              {t('settings.discover.needOneSubject')}
            </p>
          )}
        </section>

        {formats.includes('student_place') || formats.includes('teacher_place') ? (
          <section>
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <p className={[sectionTitleCls, 'mb-0'].join(' ')}>{t('settings.discover.areasTitle')}</p>
              {areaIds.length > 0 ? (
                <span className="text-[10px] font-semibold text-primary shrink-0">{t('settings.discover.areasSelected', { count: areaIds.length })}</span>
              ) : null}
            </div>
            <input
              type="search"
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              placeholder={t('settings.discover.areasPh')}
              className={inp}
            />
            <div
              className={[
                'mt-3 max-h-56 overflow-y-auto space-y-4 rounded-xl border p-3',
                theme === 'dark' ? 'border-white/10 bg-white/[0.02]' : 'border-slate-200 bg-slate-50/80',
              ].join(' ')}
            >
              {[
                [t('settings.discover.groupPopular'), areaGroups.popular],
                [t('settings.discover.groupBaku'), areaGroups.bakuDistricts],
                [t('settings.discover.groupMetro'), areaGroups.metros],
                [t('settings.discover.groupRegions'), areaGroups.regions],
              ].map(([label, list]) => {
                const shown = filterAreaList(list)
                if (!shown.length) return null
                return (
                  <div key={label}>
                    <p className={[sectionTitleCls, 'mb-2 text-[10px]'].join(' ')}>{label}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {shown.map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => toggleArea(a.id)}
                          className={[
                            chipBaseCls,
                            areaIds.includes(a.id) ? chipActiveCls : chipIdleCls,
                          ].join(' ')}
                        >
                          {a.name_az}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ) : null}

        <section>
          <label className={fieldLabelCls}>{t('settings.discover.rateLabel')}</label>
          <input
            type="number"
            min="0"
            value={hourlyRate}
            onChange={(e) => setHourlyRate(e.target.value)}
            className={inp}
            inputMode="decimal"
          />
        </section>
        <section>
          <label className={fieldLabelCls}>{t('settings.discover.bioLabel')}</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder={t('settings.discover.bioPh')}
            className={`${inp} resize-y min-h-[5rem]`}
          />
        </section>
        <section>
          <label className={fieldLabelCls}>{t('settings.discover.educationLabel')}</label>
          <textarea
            value={education}
            onChange={(e) => setEducation(e.target.value)}
            rows={2}
            placeholder={t('settings.discover.educationPh')}
            className={`${inp} resize-y`}
          />
        </section>
        <section>
          <label className={fieldLabelCls}>{t('settings.discover.certsLabel')}</label>
          <textarea
            value={certifications}
            onChange={(e) => setCertifications(e.target.value)}
            rows={2}
            placeholder={t('settings.discover.certsPh')}
            className={`${inp} resize-y`}
          />
        </section>

        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <Button type="button" loading={saving} onClick={() => void save()} className="w-full sm:w-auto justify-center">
            {t('settings.discover.save')}
          </Button>
          <Link
            to="/instructor/inquiries"
            className="text-sm font-semibold text-primary hover:underline self-center text-center px-2 py-2"
          >
            {t('settings.discover.inquiriesLink')}
          </Link>
        </div>
      </div>
    </Card>
  )
}
