import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import useAuthStore from '../../hooks/useAuth'
import { instructorRoleAz } from '../../lib/instructorLabel'
import useUiStore from '../../hooks/useUi'
import { planPriceLabel } from '../../constants/subscriptionPlans'
import { useSubscriptionPlans } from '../../hooks/useSubscriptionPlans'
import { useBillingStatus, BILLING_STATUS_QUERY_KEY } from '../../hooks/useBillingStatus'
import { SUBSCRIPTION_PLANS_QUERY_KEY } from '../../hooks/useSubscriptionPlans'
import PricingBillingIntervalToggle from '../../components/instructor/PricingBillingIntervalToggle'
import InstructorMapPinPicker from '../../components/instructor/InstructorMapPinPicker'
import InstructorMapPreviewModal from '../../components/instructor/InstructorMapPreviewModal'
import { reverseGeocodeLabel } from '../../lib/reverseGeocode'
import { formatAzn, yearlyTotalAzn, YEARLY_DISCOUNT } from '../../lib/pricing'

export default function InstructorSettings() {
  const qc = useQueryClient()
  const toast = useToast()
  const { user, updateUser } = useAuthStore()
  const { theme } = useUiStore()
  const [loading, setLoading] = useState(true)
  const [planBusy, setPlanBusy] = useState(false)
  const [planErr, setPlanErr] = useState(null)
  const plansQ = useSubscriptionPlans()
  const billingQ = useBillingStatus()
  const billing = billingQ.data || null
  const plans = Array.isArray(plansQ.data) ? plansQ.data : []
  const [savingLabel, setSavingLabel] = useState(false)
  const [publicLabel, setPublicLabel] = useState('instructor')
  const [mapLat, setMapLat] = useState('')
  const [mapLng, setMapLng] = useState('')
  const [mapKind, setMapKind] = useState('teacher')
  const [mapVisible, setMapVisible] = useState(true)
  const [savingMap, setSavingMap] = useState(false)
  const [mapFlyKey, setMapFlyKey] = useState(0)
  const [mapRadiusKm, setMapRadiusKm] = useState(10)
  const [locationLabel, setLocationLabel] = useState('')
  const [locationLoading, setLocationLoading] = useState(false)
  const [mapPreviewOpen, setMapPreviewOpen] = useState(false)
  const [mapJustSaved, setMapJustSaved] = useState(false)
  const savedMapRef = useRef(null)
  const geocodeTimerRef = useRef(null)
  const [subjects, setSubjects] = useState([])
  const [newSubject, setNewSubject] = useState('')
  const [newGroupBySubject, setNewGroupBySubject] = useState({})
  const [busy, setBusy] = useState({})
  const [billingInterval, setBillingInterval] = useState('yearly')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api.get('/instructor/teaching')
      setPublicLabel(d.public_label === 'trainer' ? 'trainer' : 'instructor')
      const m = d.map || {}
      setMapLat(m.latitude != null && Number.isFinite(Number(m.latitude)) ? String(m.latitude) : '')
      setMapLng(m.longitude != null && Number.isFinite(Number(m.longitude)) ? String(m.longitude) : '')
      setMapKind(m.map_profile_kind === 'trainer' ? 'trainer' : 'teacher')
      setMapVisible(m.map_visible !== false)
      setSubjects(Array.isArray(d.subjects) ? d.subjects : [])
      savedMapRef.current = {
        lat: m.latitude != null && Number.isFinite(Number(m.latitude)) ? String(m.latitude) : '',
        lng: m.longitude != null && Number.isFinite(Number(m.longitude)) ? String(m.longitude) : '',
        kind: m.map_profile_kind === 'trainer' ? 'trainer' : 'teacher',
        visible: m.map_visible !== false,
      }
      setMapJustSaved(false)
    } catch (e) {
      toast(e?.message || 'Yüklənmədi', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  const hasMapPin = mapLat.trim() !== '' && mapLng.trim() !== ''

  const mapDirty = useMemo(() => {
    const s = savedMapRef.current
    if (!s) return hasMapPin || mapVisible
    return s.lat !== mapLat || s.lng !== mapLng || s.kind !== mapKind || s.visible !== mapVisible
  }, [mapLat, mapLng, mapKind, mapVisible, hasMapPin])

  const primarySubject = subjects[0]?.name || ''

  useEffect(() => {
    if (!hasMapPin) {
      setLocationLabel('')
      return
    }
    if (geocodeTimerRef.current) window.clearTimeout(geocodeTimerRef.current)
    setLocationLoading(true)
    geocodeTimerRef.current = window.setTimeout(() => {
      void (async () => {
        const label = await reverseGeocodeLabel(mapLat, mapLng)
        setLocationLabel(label || 'Mövqe seçildi')
        setLocationLoading(false)
      })()
    }, 450)
    return () => {
      if (geocodeTimerRef.current) window.clearTimeout(geocodeTimerRef.current)
    }
  }, [mapLat, mapLng, hasMapPin])

  const saveLabel = async () => {
    setSavingLabel(true)
    try {
      await api.patch('/instructor/profile-label', { public_label: publicLabel })
      updateUser({ public_label: publicLabel })
      toast('Görünən ad saxlanıldı')
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setSavingLabel(false)
    }
  }

  const fillMapFromGeolocation = () => {
    if (!navigator.geolocation) {
      toast('Brauzer mövqeni dəstəkləmir', 'error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMapLat(String(pos.coords.latitude.toFixed(6)))
        setMapLng(String(pos.coords.longitude.toFixed(6)))
        setMapFlyKey((k) => k + 1)
        setMapJustSaved(false)
        toast('📍 Mövqeyiniz xəritədə işarələndi — indi saxlayın', 'info')
      },
      () => toast('Mövqe alınmadı', 'error'),
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }

  const saveMapProfile = async () => {
    setSavingMap(true)
    try {
      const lat = mapLat.trim() === '' ? null : Number(String(mapLat).replace(',', '.'))
      const lng = mapLng.trim() === '' ? null : Number(String(mapLng).replace(',', '.'))
      if (lat != null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
        toast('Enlik düzgün deyil', 'error')
        return
      }
      if (lng != null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
        toast('Uzunluq düzgün deyil', 'error')
        return
      }
      if (mapVisible && (lat == null || lng == null)) {
        toast('Xəritədə görünmək üçün əvvəlcə pin qoyun', 'error')
        return
      }
      await api.patch('/instructor/map-profile', {
        latitude: lat,
        longitude: lng,
        map_profile_kind: mapKind,
        map_visible: mapVisible,
      })
      savedMapRef.current = {
        lat: mapLat,
        lng: mapLng,
        kind: mapKind,
        visible: mapVisible,
      }
      setMapJustSaved(true)
      if (mapVisible && lat != null && lng != null) {
        toast('✓ Uğurla saxlanıldı — tələbələr sizi xəritədə tapa bilər', 'success')
      } else {
        toast('✓ Saxlanıldı — hazırda xəritədə gizlisiniz', 'success')
      }
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setSavingMap(false)
    }
  }

  const addSubject = async () => {
    const name = newSubject.trim()
    if (!name) {
      toast('Sahə adı daxil edin', 'error')
      return
    }
    setBusy((b) => ({ ...b, addSub: true }))
    try {
      await api.post('/instructor/teaching/subjects', { name })
      setNewSubject('')
      toast('Sahə əlavə olundu')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setBusy((b) => ({ ...b, addSub: false }))
    }
  }

  const removeSubject = async (id) => {
    if (!window.confirm('Bu sahəni və onun qruplarını silmək istəyirsiniz?')) return
    setBusy((b) => ({ ...b, [`dels-${id}`]: true }))
    try {
      await api.delete('/instructor/teaching/subjects/' + encodeURIComponent(id))
      toast('Silindi')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setBusy((b) => ({ ...b, [`dels-${id}`]: false }))
    }
  }

  const addGroup = async (subjectId) => {
    const raw = newGroupBySubject[subjectId] || ''
    const name = String(raw).trim()
    if (!name) {
      toast('Qrup adı daxil edin', 'error')
      return
    }
    setBusy((b) => ({ ...b, [`addg-${subjectId}`]: true }))
    try {
      await api.post('/instructor/teaching/groups', { subject_id: subjectId, name })
      setNewGroupBySubject((p) => ({ ...p, [subjectId]: '' }))
      toast('Qrup əlavə olundu')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setBusy((b) => ({ ...b, [`addg-${subjectId}`]: false }))
    }
  }

  const removeGroup = async (groupId) => {
    if (!window.confirm('Qrup silinsin?')) return
    setBusy((b) => ({ ...b, [`delg-${groupId}`]: true }))
    try {
      await api.delete('/instructor/teaching/groups/' + encodeURIComponent(groupId))
      toast('Silindi')
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setBusy((b) => ({ ...b, [`delg-${groupId}`]: false }))
    }
  }

  const roleWord = instructorRoleAz(publicLabel)
  const currentPlanId = String(billing?.plan || 'basic').toLowerCase()
  const currentPlanObj = plans.find((p) => String(p?.id || '').toLowerCase() === currentPlanId) || null

  const displayPriceForPlan = useCallback(
    (p) => {
      const pid = String(p?.id || '').toLowerCase()
      const monthly = Number(p?.price_azn)
      const isPaid = pid !== 'basic' && Number.isFinite(monthly) && monthly > 0
      if (!isPaid) return { main: null, suffix: '', hint: null, isPaid: false }
      if (billingInterval === 'monthly')
        return { main: `${formatAzn(monthly)} AZN`, suffix: '/ay', hint: null, isPaid: true }
      const y = yearlyTotalAzn(monthly, YEARLY_DISCOUNT)
      return {
        main: `${formatAzn(y)} AZN`,
        suffix: '/il',
        hint: `≈ ${formatAzn(monthly)} AZN/ay qarşılığında (12 ay, −${Math.round(YEARLY_DISCOUNT * 100)}%)`,
        isPaid: true,
      }
    },
    [billingInterval],
  )

  const currentPlanPricingLine = useMemo(() => {
    if (!currentPlanObj) return '—'
    const pid = String(currentPlanObj.id || '').toLowerCase()
    if (pid === 'basic') return 'Ödənişsiz əsas paket — vaxt limiti yoxdur, istifadə limitləri paket üzrə tətbiq olunur.'
    const m = Number(currentPlanObj.price_azn)
    if (!Number.isFinite(m) || m <= 0) return planPriceLabel(currentPlanObj)
    if (billingInterval === 'monthly') return `${formatAzn(m)} AZN/ay`
    return `${formatAzn(yearlyTotalAzn(m))} AZN/il (təxm. ${formatAzn(m)} AZN/ay)`
  }, [billingInterval, currentPlanObj])

  async function downgradeToBasic() {
    setPlanErr(null)
    setPlanBusy(true)
    try {
      await api.post('/billing/select-basic')
      await Promise.all([
        qc.invalidateQueries({ queryKey: BILLING_STATUS_QUERY_KEY }),
        qc.invalidateQueries({ queryKey: SUBSCRIPTION_PLANS_QUERY_KEY }),
      ])
      toast('SADƏ (pulsuz) paket seçildi')
    } catch (e) {
      setPlanErr(e?.message || 'Əməliyyat alınmadı')
    } finally {
      setPlanBusy(false)
    }
  }

  async function startUpgrade(planId) {
    setPlanErr(null)
    setPlanBusy(true)
    try {
      const r = await api.post('/billing/create-payment', {
        plan: planId,
        interval: billingInterval,
      })
      const url = r?.payment?.payment_url
      if (!url) throw new Error('Ödəniş linki alınmadı')
      window.location.href = url
    } catch (e) {
      setPlanErr(e?.message || 'Ödəniş yaradılmadı')
    } finally {
      setPlanBusy(false)
    }
  }

  const planRank = (id) => {
    const s = String(id || '').toLowerCase()
    if (s === 'business') return 3
    if (s === 'pro') return 2
    return 1
  }

  const cardTitleCls = [
    'text-sm font-semibold uppercase tracking-wider',
    theme === 'dark' ? 'text-indigo-200/90' : 'text-token-textMain',
  ].join(' ')

  const cardTextCls = ['text-xs leading-relaxed', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')

  const inp = [
    'w-full rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 border',
    theme === 'dark'
      ? 'bg-[#13112e] border-indigo-500/20 text-white placeholder:text-gray-500'
      : 'bg-token-surfaceMain border-[color:var(--border-subtle)] text-token-textMain placeholder:text-token-textMuted',
  ].join(' ')

  const secondaryBtnCls = [
    'whitespace-nowrap',
    theme === 'dark'
      ? 'border-white/15 text-white hover:bg-white/[0.06] hover:border-white/25'
      : '!border-slate-200 !text-slate-800 hover:!text-slate-900 hover:!border-slate-300 hover:bg-slate-500/10',
  ].join(' ')

  const settingsCardCls = 'w-full p-5 border border-indigo-500/20 space-y-4'

  return (
    <div className="p-4 sm:p-6 min-w-0 max-w-6xl mx-auto w-full space-y-6">
      <div>
        <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain tracking-tight">Tənzimləmələr</h1>
        <p className="text-token-textMuted text-sm mt-1">
          İnterfeysdə və tələbə tərəfində sizin rolunuz <span className="text-indigo-300">{roleWord}</span> kimi görünəcək.
        </p>
      </div>

      <Card className={settingsCardCls}>
        <h2 className={cardTitleCls}>Paketini dəyiş</h2>
        <p className={cardTextCls}>
          <span className="text-gray-200 font-medium">Aktiv paket:</span>{' '}
          <span className="text-white font-semibold">
            {currentPlanObj?.title || String(currentPlanId || '').toUpperCase()}
          </span>
          <span className="text-gray-500"> — {currentPlanPricingLine}</span>
        </p>
        <p className={cardTextCls}>
          SADƏ (pulsuz) paketdə vaxt limiti yoxdur; limitlər istifadəyə əsaslanır və hər hansı limit dolduqda daha geniş
          paket seçməlisiniz.
        </p>
        <PricingBillingIntervalToggle value={billingInterval} onChange={setBillingInterval} theme={theme} />
        {planErr ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-100 px-4 py-3 text-sm">
            {planErr}
          </div>
        ) : null}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-stretch">
          {plans.map((p) => {
            const pid = String(p?.id || '').toLowerCase()
            const isCurrent = pid && pid === currentPlanId
            const isUpgrade = planRank(pid) > planRank(currentPlanId)
            const isFree = pid === 'basic'
            const isProHighlight = pid === 'pro' && Boolean(p.highlight)

            let btnLabel = 'Başla'
            if (isCurrent) btnLabel = 'Aktiv paket'
            else if (isFree) btnLabel = 'Pulsuz başla'
            else if (isUpgrade) btnLabel = 'Upgrade et'

            const priceBox = displayPriceForPlan(p)

            const limitsNote =
              typeof p?.limitsNote === 'string' && p.limitsNote.trim()
                ? p.limitsNote
                : Array.isArray(p?.items) && p.items.length && String(p.items[0] || '').trim()
                  ? String(p.items[0]).trim()
                  : 'Limitlər mövcud paketə uyğun tətbiq olunur (idarəetmədə dəyişdirilə bilər).'

            async function onPlanAction() {
              if (isCurrent) return
              if (isUpgrade) return startUpgrade(p.id)
              if (isFree) return downgradeToBasic()
              setPlanErr(null)
              toast('Bu paketə keçid üçün dəstəyə yazın — cari abunə üçün endirimli dəyişiklik tələb olunur.')
            }

            const btnDisabled = planBusy || isCurrent

            return (
              <div
                key={p.id}
                className={[
                  'relative rounded-2xl border p-4 h-full min-h-[22rem]',
                  'flex flex-col gap-0',
                  'transition-[transform,box-shadow,border-color] duration-200 ease-out',
                  'hover:-translate-y-0.5 hover:shadow-[0_14px_44px_rgba(0,0,0,0.14)]',
                  isCurrent
                    ? 'border-emerald-500/50 bg-emerald-500/[0.07] shadow-[0_8px_32px_rgba(16,185,129,0.12)] ring-1 ring-emerald-500/25'
                    : isProHighlight
                      ? 'border-primary/50 bg-primary/[0.08] shadow-[0_12px_40px_rgba(99,102,241,0.18)] ring-1 ring-primary/30 sm:scale-[1.02] z-[1]'
                      : isFree
                        ? 'border-teal-500/30 bg-teal-500/[0.04]'
                        : 'border-[color:var(--border-subtle)] bg-token-surfaceCard/45',
                ].join(' ')}
              >
                <div className="flex w-full shrink-0 items-start justify-between gap-2">
                  <div className="flex min-h-[22px] min-w-0 flex-1 flex-wrap items-center gap-2">
                    {isCurrent ? (
                      <span className="rounded-full bg-emerald-500/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-100 ring-1 ring-emerald-500/40">
                        Aktiv paket
                      </span>
                    ) : isProHighlight ? (
                      <span className="rounded-full bg-primary/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-100 ring-1 ring-primary/35">
                        Ən populyar
                      </span>
                    ) : null}
                  </div>
                  {billingInterval === 'yearly' && priceBox?.isPaid ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/18 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-100">
                      −20%
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 shrink-0 text-base font-display font-bold tracking-tight text-token-textMain">
                  {p.title}
                </div>

                <div className="mt-1 shrink-0 flex flex-wrap items-baseline gap-1">
                  {priceBox?.isPaid ? (
                    <>
                      <span className="text-xl font-display font-bold tracking-tight text-token-textMain">{priceBox.main}</span>
                      <span className="text-xs font-medium text-token-textMuted">{priceBox.suffix}</span>
                    </>
                  ) : (
                    <span className="text-xl font-display font-bold tracking-tight text-token-textMain">Pulsuz</span>
                  )}
                </div>

                {priceBox?.hint ? (
                  <p className="mt-1 shrink-0 text-[11px] leading-snug text-token-textMuted">{priceBox.hint}</p>
                ) : billingInterval === 'yearly' && priceBox?.isPaid ? (
                  <p className="mt-1 shrink-0 text-[11px] leading-snug text-emerald-600/95 dark:text-emerald-300/90">
                    İllik seçərək 20% qənaət edin
                  </p>
                ) : null}

                <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3">
                  <p className="text-[11px] leading-relaxed text-token-textMuted">{limitsNote}</p>
                  {isFree ? (
                    <p className="whitespace-pre-line text-[11px] leading-relaxed text-token-textMain/85">
                      {`Bu paketdə istifadə müddəti məhdud deyil.\n5 tələbə, 5 SMS və 512 KB limit mövcuddur.\nLimitlərə çatdıqda daha geniş paket seçməyiniz tələb olunacaq.`}
                    </p>
                  ) : null}
                </div>

                <div className="mt-auto shrink-0 border-t border-[color:var(--border-subtle)]/60 pt-4">
                  <Button
                    className="w-full justify-center duration-200 ease-out hover:brightness-[1.06]"
                    variant={isCurrent ? 'secondary' : p.highlight ? 'primary' : 'secondary'}
                    loading={planBusy}
                    disabled={btnDisabled}
                    onClick={() => void onPlanAction()}
                  >
                    {btnLabel}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <Card className={settingsCardCls}>
        <h2 className={cardTitleCls}>Görünən ad</h2>
        <p className={cardTextCls}>
          Dashboard və naviqasiyada, həmçinin tələbə ödəniş/tapşırıq ekranlarında göstərilən titul.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <label className={['flex items-center gap-2 cursor-pointer text-sm', theme === 'dark' ? 'text-gray-200' : 'text-token-textMain'].join(' ')}>
            <input
              type="radio"
              name="public_label"
              checked={publicLabel === 'instructor'}
              onChange={() => setPublicLabel('instructor')}
              className="accent-indigo-500"
            />
            Müəllim
          </label>
          <label className={['flex items-center gap-2 cursor-pointer text-sm', theme === 'dark' ? 'text-gray-200' : 'text-token-textMain'].join(' ')}>
            <input
              type="radio"
              name="public_label"
              checked={publicLabel === 'trainer'}
              onChange={() => setPublicLabel('trainer')}
              className="accent-indigo-500"
            />
            Təlimçi
          </label>
        </div>
        <Button type="button" loading={savingLabel} onClick={() => void saveLabel()} className="w-full sm:w-auto justify-center">
          Saxla
        </Button>
      </Card>

      <Card className={settingsCardCls}>
        <h2 className={cardTitleCls}>Xəritədə tap</h2>
        <p className={cardTextCls}>
          Tələbələr mentorix.io/search səhifəsində sizi xəritədə axtarır. Pin qoyun, saxlayın — hazırsınız.
        </p>

        <label
          className={[
            'flex items-start gap-3 cursor-pointer rounded-xl border p-3 transition-colors',
            mapVisible ? 'border-primary/40 bg-primary/5' : 'border-white/10 bg-white/[0.02]',
            theme === 'dark' ? 'text-gray-200' : 'text-token-textMain',
          ].join(' ')}
        >
          <input
            type="checkbox"
            checked={mapVisible}
            onChange={(e) => {
              setMapVisible(e.target.checked)
              setMapJustSaved(false)
            }}
            className="accent-indigo-500 rounded mt-0.5"
          />
          <span className="text-sm leading-snug">
            <span className="font-semibold text-white block">Tələbələr sizi xəritədə tapa bilsin</span>
            <span className="text-xs text-token-textMuted">
              {mapVisible ? 'Aktiv — saxladıqdan sonra axtarışda görünəcəksiniz' : 'Deaktiv — heç kim sizi xəritədə görməyəcək'}
            </span>
          </span>
        </label>

        {hasMapPin ? (
          <div
            className={[
              'rounded-xl border px-4 py-3 space-y-1',
              mapVisible ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/25 bg-amber-500/5',
            ].join(' ')}
          >
            <p className="text-sm font-semibold text-white">
              {locationLoading ? '📍 Ünvan müəyyən edilir…' : `📍 ${locationLabel || 'Mövqe seçildi'}`}
            </p>
            {mapVisible ? (
              <p className="text-xs text-emerald-400/90">✓ Pin düzgün qoyulub — saxladıqdan sonra tələbələr sizi burada görəcək</p>
            ) : (
              <p className="text-xs text-amber-400/90">Pin var, amma görünmə bağlıdır — yuxarıdakı seçimi aktiv edin</p>
            )}
            <p className="text-xs text-token-textMuted">
              Tələbələr sizi təxminən <span className="text-primary font-semibold">{mapRadiusKm} km</span> radiusda axtarışda görə bilər
            </p>
            {mapDirty ? (
              <p className="text-xs text-amber-300 font-medium pt-1">● Dəyişikliklər hələ saxlanmayıb</p>
            ) : mapJustSaved ? (
              <p className="text-xs text-emerald-400 font-medium pt-1">● Son dəfə uğurla saxlanıldı</p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-xs text-token-textMuted">
            Hələ pin yoxdur — aşağıdakı xəritədə iş yerinizə klik edin
          </div>
        )}

        {!loading ? (
          <InstructorMapPinPicker
            latitude={mapLat}
            longitude={mapLng}
            mapKind={mapKind}
            flyKey={mapFlyKey}
            displayName={user?.full_name || ''}
            radiusKm={mapRadiusKm}
            onChange={(lat, lng) => {
              setMapLat(lat)
              setMapLng(lng)
              setMapJustSaved(false)
            }}
          />
        ) : null}

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="text-xs text-token-textMuted">Pin növü:</span>
          <label className={['flex items-center gap-2 cursor-pointer', theme === 'dark' ? 'text-gray-200' : 'text-token-textMain'].join(' ')}>
            <input
              type="radio"
              name="map_kind"
              checked={mapKind === 'teacher'}
              onChange={() => {
                setMapKind('teacher')
                setMapJustSaved(false)
              }}
              className="accent-indigo-500"
            />
            👨‍🏫 Müəllim
          </label>
          <label className={['flex items-center gap-2 cursor-pointer', theme === 'dark' ? 'text-gray-200' : 'text-token-textMain'].join(' ')}>
            <input
              type="radio"
              name="map_kind"
              checked={mapKind === 'trainer'}
              onChange={() => {
                setMapKind('trainer')
                setMapJustSaved(false)
              }}
              className="accent-indigo-500"
            />
            🥊 Təlimçi
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 flex-wrap items-center">
          <Button type="button" variant="secondary" onClick={() => fillMapFromGeolocation()} className="justify-center">
            Mövqeyimdən doldur
          </Button>
          <label className="text-xs text-token-textMuted flex items-center gap-1.5">
            Görünürlük radiusu (tələbə üçün)
            <select
              className={`${inp} !py-1 !px-2 !w-auto text-xs`}
              value={mapRadiusKm}
              onChange={(e) => setMapRadiusKm(Number(e.target.value))}
            >
              <option value={5}>5 km</option>
              <option value={10}>10 km</option>
              <option value={25}>25 km</option>
            </select>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button type="button" loading={savingMap} onClick={() => void saveMapProfile()} className="flex-1 justify-center">
            {mapDirty ? 'Dəyişiklikləri saxla' : 'Xəritə məlumatını saxla'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!hasMapPin}
            onClick={() => setMapPreviewOpen(true)}
            className="flex-1 justify-center"
          >
            Axtarışda necə görünürəm?
          </Button>
        </div>

        {mapJustSaved && mapVisible && hasMapPin ? (
          <Link to="/search" className="block text-center text-sm font-semibold text-primary hover:underline py-1">
            → Canlı xəritədə bax
          </Link>
        ) : null}
      </Card>

      <InstructorMapPreviewModal
        open={mapPreviewOpen}
        onClose={() => setMapPreviewOpen(false)}
        fullName={user?.full_name}
        subject={primarySubject}
        mapKind={mapKind}
        latitude={mapLat}
        longitude={mapLng}
        locationLabel={locationLabel}
        mapVisible={mapVisible}
        radiusKm={mapRadiusKm}
      />

      <Card className={settingsCardCls}>
        <h2 className={cardTitleCls}>Tədris sahələri və qruplar</h2>
        <p className={cardTextCls}>
          Tələbə qeydiyyatında sahə və qrup seçiminə imkan verir; ödənişlər cədvəlində sahə adı görünür (hesabat üçün).
        </p>
        {loading ? (
          <p className={['text-sm', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>Yüklənir…</p>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                className={inp}
                placeholder="Məs: Java Programming"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                loading={busy.addSub}
                onClick={() => void addSubject()}
                className={['w-full sm:w-auto justify-center', secondaryBtnCls].join(' ')}
              >
                Sahə əlavə et
              </Button>
            </div>
            <ul className="space-y-4">
              {!subjects.length ? (
                <li className={['text-sm', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>
                  Hələ sahə yoxdur — əlavə edin və ya qeydiyyatda sahəni boş buraxın.
                </li>
              ) : null}
              {subjects.map((s) => (
                <li
                  key={s.id}
                  className={[
                    'rounded-xl border p-4 space-y-3',
                    theme === 'dark'
                      ? 'border-indigo-500/15 bg-[#0f0c29]/60'
                      : 'border-[color:var(--border-subtle)] bg-token-surfaceMain/60',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={['font-medium', theme === 'dark' ? 'text-white' : 'text-token-textMain'].join(' ')}>
                      {s.name}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="danger"
                      loading={busy[`dels-${s.id}`]}
                      onClick={() => void removeSubject(s.id)}
                    >
                      Sil
                    </Button>
                  </div>
                  <div
                    className={[
                      'pl-2 border-l space-y-2',
                      theme === 'dark' ? 'border-indigo-500/20' : 'border-[color:var(--border-subtle)]',
                    ].join(' ')}
                  >
                    {(s.groups || []).length === 0 ? (
                      <p className={['text-xs', theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'].join(' ')}>
                        Qrup yoxdur
                      </p>
                    ) : (
                      <ul className="space-y-1">
                        {(s.groups || []).map((g) => (
                          <li
                            key={g.id}
                            className={['flex items-center justify-between gap-2 text-sm', theme === 'dark' ? 'text-gray-300' : 'text-token-textMain'].join(' ')}
                          >
                            <span>{g.name}</span>
                            <button
                              type="button"
                              className={[
                                'text-xs disabled:opacity-40',
                                theme === 'dark' ? 'text-rose-300 hover:text-rose-200' : 'text-rose-700 hover:text-rose-800',
                              ].join(' ')}
                              disabled={busy[`delg-${g.id}`]}
                              onClick={() => void removeGroup(g.id)}
                            >
                              Sil
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      <input
                        className={inp + ' text-xs'}
                        placeholder="Yeni qrup adı"
                        value={newGroupBySubject[s.id] || ''}
                        onChange={(e) =>
                          setNewGroupBySubject((p) => ({
                            ...p,
                            [s.id]: e.target.value,
                          }))
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        loading={busy[`addg-${s.id}`]}
                        onClick={() => void addGroup(s.id)}
                        className={secondaryBtnCls}
                      >
                        Qrup əlavə et
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <p className={['text-xs', theme === 'dark' ? 'text-gray-600' : 'text-token-textMuted'].join(' ')}>
        Hesab:{' '}
        <span className={theme === 'dark' ? 'text-gray-400' : 'text-token-textMain'}>{user?.full_name}</span>
      </p>
    </div>
  )
}

