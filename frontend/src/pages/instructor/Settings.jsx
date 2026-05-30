import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import { buildWhatsAppInviteMessage, groupInvitationLink } from '../../lib/joinInvite'
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
import { planDetailLines, planLimitsHeadline } from '../../lib/subscriptionPlanCopy'
import {
  canBuySmsOnCurrentPlan,
  canBuyStorageOnCurrentPlan,
  hasPendingSmsTopup,
  isSmsMonthlyLimitReached,
  isStorageLimitReached,
  planDowngradeGuard,
  planRank,
  shouldOfferLimitTopUpChoice,
} from '../../lib/subscriptionPlanGuards'
import {
  extraSmsBalance,
  extraStorageBytes,
  pendingSmsQuantity,
  pendingStorageMb,
  planSmsMonthlyLimit,
  smsUsageDisplay,
  storageUsageDisplay,
} from '../../lib/billingUsageDisplay'
import Tooltip from '../../components/common/Tooltip'
import PaymentMethodModal from '../../components/instructor/PaymentMethodModal'
import { useBillingConfig } from '../../hooks/useBillingConfig'
import { billingPaymentStatusLabel, billingPaymentTitle } from '../../lib/billingPaymentLabels'
import Modal from '../../components/common/Modal'
import { QRCodeCanvas } from 'qrcode.react'
import GroupPackageFields, {
  emptyGroupPackage,
  groupPackageFromApi,
  groupPackagePayload,
} from '../../components/instructor/GroupPackageFields'

export default function InstructorSettings() {
  const navigate = useNavigate()
  const location = useLocation()
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
  const billingConfigQ = useBillingConfig()
  const manualAccount = billingConfigQ.data?.manual_transfer_account || ''
  const smsPacks = Array.isArray(billingConfigQ.data?.sms_packs) ? billingConfigQ.data.sms_packs : []
  const storagePacks = Array.isArray(billingConfigQ.data?.storage_packs)
    ? billingConfigQ.data.storage_packs
    : []
  const [checkout, setCheckout] = useState(null)
  const [limitChoice, setLimitChoice] = useState(null) // null | { open: true }
  const [qrOpen, setQrOpen] = useState(false)
  const [qrGroup, setQrGroup] = useState(null)
  const [billingPayments, setBillingPayments] = useState([])
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
  const [groupModal, setGroupModal] = useState(null)
  const [groupModalError, setGroupModalError] = useState('')
  const [groupPkg, setGroupPkg] = useState(emptyGroupPackage)
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

  useEffect(() => {
    const scrollTo = location.state?.scrollTo
    if (!scrollTo) return
    const t = window.setTimeout(() => {
      document.getElementById(String(scrollTo))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 200)
    return () => window.clearTimeout(t)
  }, [location.state?.scrollTo])

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

  const openCreateGroup = (subjectId) => {
    const raw = newGroupBySubject[subjectId] || ''
    const name = String(raw).trim()
    if (!name) {
      toast('Qrup adı daxil edin', 'error')
      return
    }
    setGroupPkg(emptyGroupPackage())
    setGroupModal({ mode: 'create', subjectId, name })
  }

  const openEditGroupPackage = (subjectId, group) => {
    setGroupPkg(groupPackageFromApi(group))
    setGroupModal({ mode: 'edit', subjectId, group })
  }

  const saveGroupModal = async () => {
    if (!groupModal) return
    const lwd = groupPkg.default_lesson_weekdays || []
    if (!lwd.length) {
      const msg = 'Ən azı bir dərs günü seçin'
      setGroupModalError(msg)
      toast(msg, 'error')
      return
    }
    const fee = String(groupPkg.default_package_fee || '').trim()
    if (!fee) {
      const msg = 'Paket qiyməti (₼) tələb olunur'
      setGroupModalError(msg)
      toast(msg, 'error')
      return
    }
    setBusy((b) => ({ ...b, groupModal: true }))
    try {
      const body = groupPackagePayload(groupPkg, groupModal.mode === 'create' ? groupModal.name : groupModal.group?.name)
      if (groupModal.mode === 'create') {
        await api.post('/instructor/teaching/groups', { subject_id: groupModal.subjectId, ...body })
        setNewGroupBySubject((p) => ({ ...p, [groupModal.subjectId]: '' }))
        toast('Qrup və paket tənzimləri yaradıldı')
      } else {
        await api.patch(`/instructor/teaching/groups/${encodeURIComponent(groupModal.group.id)}`, body)
        toast('Qrup paketi yeniləndi')
      }
      setGroupModal(null)
      await load()
    } catch (e) {
      toast(e?.message || 'Xəta', 'error')
    } finally {
      setBusy((b) => ({ ...b, groupModal: false }))
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
  const currentPlanTitle = currentPlanObj?.title || String(currentPlanId || '').toUpperCase()
  const pendingPlanSlug = String(
    billing?.pending_plan_slug || billing?.pending_topup?.pending_plan_slug || '',
  ).toLowerCase()
  const pendingPlanObj = pendingPlanSlug
    ? plans.find((p) => String(p?.id || '').toLowerCase() === pendingPlanSlug)
    : null

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

  const smsUsageInfo = useMemo(() => smsUsageDisplay(billing), [billing])
  const storageUsageInfo = useMemo(() => storageUsageDisplay(billing), [billing])

  const currentPlanPricingLine = useMemo(() => {
    if (!currentPlanObj) return '—'
    const pid = String(currentPlanObj.id || '').toLowerCase()
    if (pid === 'basic') return 'Ödənişsiz əsas paket — vaxt limiti yoxdur, istifadə limitləri paket üzrə tətbiq olunur.'
    const m = Number(currentPlanObj.price_azn)
    if (!Number.isFinite(m) || m <= 0) return planPriceLabel(currentPlanObj)
    if (billingInterval === 'monthly') return `${formatAzn(m)} AZN/ay`
    return `${formatAzn(yearlyTotalAzn(m))} AZN/il (təxm. ${formatAzn(m)} AZN/ay)`
  }, [billingInterval, currentPlanObj])

  useEffect(() => {
    api
      .get('/billing/payments')
      .then((d) => setBillingPayments(Array.isArray(d?.payments) ? d.payments : []))
      .catch(() => {})
  }, [planBusy])

  function openPlanCheckout(planId) {
    const p = plans.find((x) => String(x.id).toLowerCase() === String(planId).toLowerCase())
    const monthly = Number(p?.price_azn || 0)
    const amountAzn =
      billingInterval === 'yearly' ? yearlyTotalAzn(monthly, YEARLY_DISCOUNT) : monthly
    setCheckout({ type: 'plan', planId, amountAzn, title: p?.title || planId })
  }

  function openSmsCheckout(pack) {
    setCheckout({
      type: 'sms',
      quantity: pack.quantity,
      amountAzn: pack.price_azn,
      title: pack.label,
    })
  }

  function openStorageCheckout(pack) {
    setCheckout({
      type: 'storage',
      quantity_mb: pack.quantity_mb,
      amountAzn: pack.price_azn,
      title: pack.label,
    })
  }

  async function confirmCheckout(paymentMethod) {
    if (!checkout) return
    setPlanErr(null)
    setPlanBusy(true)
    try {
      if (checkout.type === 'plan') {
        const r = await api.post('/billing/create-payment', {
          plan: checkout.planId,
          interval: billingInterval,
          payment_method: paymentMethod,
        })
        const pay = r?.payment
        setCheckout(null)
        if (paymentMethod === 'cash') {
          const qs = new URLSearchParams({
            account: pay?.manual_transfer_account || manualAccount,
            amount: String((Number(pay?.amount_cents || 0) / 100).toFixed(2)),
            product: 'plan',
          })
          navigate(`/payment/pending?${qs}`)
          return
        }
        const url = pay?.payment_url
        if (!url) throw new Error('Ödəniş linki alınmadı')
        window.location.href = url
        return
      }
      if (checkout.type === 'storage') {
        const r = await api.post('/billing/create-storage-payment', {
          quantity_mb: checkout.quantity_mb,
          payment_method: paymentMethod,
        })
        const pay = r?.payment
        setCheckout(null)
        if (paymentMethod === 'cash') {
          const qs = new URLSearchParams({
            account: pay?.manual_transfer_account || manualAccount,
            amount: String((Number(pay?.amount_cents || 0) / 100).toFixed(2)),
            product: 'storage',
          })
          navigate(`/payment/pending?${qs}`)
          return
        }
        const url = pay?.payment_url
        if (!url) throw new Error('Ödəniş linki alınmadı')
        window.location.href = url
        return
      }
      const r = await api.post('/billing/create-sms-payment', {
        quantity: checkout.quantity,
        payment_method: paymentMethod,
      })
      const pay = r?.payment
      setCheckout(null)
      if (paymentMethod === 'cash') {
        const qs = new URLSearchParams({
          account: pay?.manual_transfer_account || manualAccount,
          amount: String((Number(pay?.amount_cents || 0) / 100).toFixed(2)),
          product: 'sms',
        })
        navigate(`/payment/pending?${qs}`)
        return
      }
      const url = pay?.payment_url
      if (!url) throw new Error('Ödəniş linki alınmadı')
      window.location.href = url
    } catch (e) {
      const msg =
        e?.code === 'PLAN_USAGE_EXCEEDS' || /limitini aşır/i.test(String(e?.message || ''))
          ? e?.message || 'Cari istifadəniz bu paketin limitini aşır'
          : e?.code === 'PLAN_NOT_UPGRADE'
            ? 'Bu paketə keçid üçün ödəniş axını hazır deyil — daha aşağı paket seçin və ya dəstək.'
            : e?.message || 'Ödəniş yaradılmadı'
      setPlanErr(msg)
    } finally {
      setPlanBusy(false)
    }
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
          <span className={theme === 'dark' ? 'text-gray-200' : 'text-token-textMuted'}>Aktiv paket:</span>{' '}
          <span className="font-semibold text-token-textMain">
            {currentPlanObj?.title || String(currentPlanId || '').toUpperCase()}
          </span>
          <span className={theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'}> — {currentPlanPricingLine}</span>
        </p>
        <p className={cardTextCls}>
          Aşağı paketə keçid yalnız cari paket dövrü <span className="font-medium">ən azı 1 ay</span> tamamlandıqdan
          sonra mümkündür və yalnız tələbə sayı, SMS və yaddaş hər üçü hədəf paket limitinə uyğun olduqda icazə
          verilir. Limit dolubsa cari paketdə əlavə SMS alın və ya yaddaşı idarə edin.
        </p>
        {billing?.subscription?.downgrade_period_met === false &&
        billing?.subscription?.days_until_downgrade != null ? (
          <p className="text-[11px] text-token-textMuted">
            Aşağı paketə keçid təxminən {billing.subscription.days_until_downgrade} gün sonra açıla bilər.
          </p>
        ) : null}
        {billing ? (
          <div className="space-y-2">
            {smsUsageInfo.effective != null ? (
              <p className="text-[11px] text-token-textMuted leading-relaxed">
                SMS limiti:{' '}
                <span className="text-token-textMain font-medium">{smsUsageInfo.label}</span>
                {smsUsageInfo.detail ? (
                  <span className="text-token-textMuted"> — {smsUsageInfo.detail}</span>
                ) : null}
                . {currentPlanTitle} paketində qalmaq üçün effektiv limit (paket + təsdiqlənmiş əlavə SMS) istifadənizdən
                böyük və ya bərabər olmalıdır.
              </p>
            ) : null}
            {smsUsageInfo.smsShortfall > 0 ? (
              <p className="text-[11px] text-amber-300/95 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 leading-relaxed">
                Bu ay {smsUsageInfo.used} SMS istifadə olunub, cari effektiv limit {smsUsageInfo.effective}. {currentPlanTitle}{' '}
                paketində qalmaq üçün ən azı{' '}
                <span className="font-medium text-white">+{smsUsageInfo.smsShortfall} SMS</span> əlavə paketi lazımdır.
              </p>
            ) : null}
            {hasPendingSmsTopup(billing) ? (
              <p className="text-[11px] text-sky-300/95 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 leading-relaxed">
                Gözləyən SMS ödənişi təsdiqlənənə qədər limit artmayıb görünə bilər. Təsdiqdən sonra effektiv limit artır
                və {currentPlanTitle} paketində qalırsınız.
              </p>
            ) : null}
            {pendingPlanSlug && pendingPlanSlug !== currentPlanId ? (
              <p className="text-[11px] text-sky-300/95 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 leading-relaxed">
                <span className="font-medium text-white">
                  {pendingPlanObj?.title || pendingPlanSlug.toUpperCase()}
                </span>{' '}
                paketi üçün ödəniş admin təsdiqi gözləyir. Təsdiqdən sonra aktiv paket və limitlər yenilənəcək.
              </p>
            ) : null}
            {shouldOfferLimitTopUpChoice(billing, {
              smsPacksCount: smsPacks.length,
              storagePacksCount: storagePacks.length,
            }) ? (
              <p className="text-[11px] text-indigo-300/90 rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-3 py-2 leading-relaxed">
                Limit dolubsa: cari paketdə{' '}
                <span className="font-medium text-white">əlavə SMS</span> və ya{' '}
                <span className="font-medium text-white">əlavə yaddaş</span> ala bilərsiniz. Aşağı paketə keçid yalnız
                1 ay sonra və istifadə uyğun olduqda mümkündür.
              </p>
            ) : null}
          </div>
        ) : null}
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
            const isDowngrade = planRank(pid) < planRank(currentPlanId)
            const isFree = pid === 'basic'
            const isProHighlight = pid === 'pro' && Boolean(p.highlight)
            const isPendingPlan = Boolean(pendingPlanSlug && pid === pendingPlanSlug && !isCurrent)
            const usageGuard =
              !isCurrent && (isDowngrade || isFree)
                ? planDowngradeGuard(billing, currentPlanId, p)
                : { blocked: false, tooltip: null }
            const smsLimitReached = isSmsMonthlyLimitReached(billing)
            const storageLimitReached = isStorageLimitReached(billing)
            const limitChoiceOffer = shouldOfferLimitTopUpChoice(billing, {
              smsPacksCount: smsPacks.length,
              storagePacksCount: storagePacks.length,
            })

            let btnLabel = 'Başla'
            if (isCurrent) {
              if (limitChoiceOffer) btnLabel = 'Limit həlli'
              else if (smsPacks.length || storagePacks.length) btnLabel = 'Əlavə limit al'
              else btnLabel = 'Paketi yenilə'
            } else if (usageGuard.blocked) {
              btnLabel =
                usageGuard.reason === 'period'
                  ? '1 ay gözləyin'
                  : isFree
                    ? 'Pulsuz başla'
                    : 'Keçid mümkün deyil'
            } else if (isFree) {
              btnLabel = 'Pulsuz başla'
            } else if (isPendingPlan) {
              btnLabel = 'Təsdiq gözləyir'
            } else if (isUpgrade) {
              btnLabel = 'Upgrade et'
            } else {
              btnLabel = 'Paketə keç'
            }

            const priceBox = displayPriceForPlan(p)

            const limitsNote =
              typeof p?.limitsNote === 'string' && p.limitsNote.trim()
                ? p.limitsNote.trim()
                : planLimitsHeadline(p)
            const detailLines = planDetailLines(p)

            function openLimitChoiceModal() {
              setLimitChoice({ open: true })
            }

            async function onPlanAction() {
              if (isPendingPlan) {
                document.getElementById('billing-payments')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                return
              }
              if (usageGuard.blocked) {
                return
              }
              setPlanErr(null)
              if (isCurrent) {
                if (limitChoiceOffer) {
                  openLimitChoiceModal()
                  return
                }
                if (storagePacks.length && isStorageLimitReached(billing)) {
                  document.getElementById('billing-storage-addons')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  return
                }
                if (smsPacks.length) {
                  document.getElementById('billing-sms-addons')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  return
                }
                return openPlanCheckout(p.id)
              }
              if (isUpgrade) {
                return openPlanCheckout(p.id)
              }
              if (isDowngrade || isFree) {
                return
              }
              const title = p?.title || pid.toUpperCase()
              if (
                !window.confirm(
                  `${title} paketinə keçmək üçün ödəniş tələb olunur. Cari istifadəniz yeni paket limitlərinə uyğundursa davam edə bilərsiniz.`,
                )
              ) {
                return
              }
              return openPlanCheckout(p.id)
            }

            const btnDisabled = planBusy || Boolean(usageGuard.blocked) || isPendingPlan

            const planBtn = (
              <Button
                className={[
                  'w-full justify-center duration-200 ease-out',
                  !isCurrent && !btnDisabled ? 'hover:brightness-[1.06]' : '',
                  isCurrent && theme === 'light'
                    ? '!bg-emerald-50 !text-emerald-950 !border-emerald-500/35 !opacity-100'
                    : '',
                  isCurrent && theme === 'dark'
                    ? '!bg-emerald-500/15 !text-emerald-100 !border-emerald-500/35 !opacity-100'
                    : '',
                ].join(' ')}
                variant={
                  isCurrent
                    ? limitChoiceOffer || (smsLimitReached && smsPacks.length)
                      ? 'primary'
                      : 'secondary'
                    : p.highlight
                      ? 'primary'
                      : 'secondary'
                }
                loading={planBusy}
                disabled={btnDisabled}
                onClick={() => void onPlanAction()}
              >
                {btnLabel}
              </Button>
            )

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
                      <span className="rounded-full bg-emerald-500/25 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-100 ring-1 ring-emerald-500/40">
                        Aktiv paket
                      </span>
                    ) : isPendingPlan ? (
                      <span className="rounded-full bg-sky-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900 dark:text-sky-100 ring-1 ring-sky-500/35">
                        Təsdiq gözləyir
                      </span>
                    ) : isProHighlight ? (
                      <span className="rounded-full bg-primary/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-900 dark:text-indigo-100 ring-1 ring-primary/35">
                        Ən populyar
                      </span>
                    ) : null}
                  </div>
                  {billingInterval === 'yearly' && priceBox?.isPaid ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/18 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-100">
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
                  <p className="text-[11px] font-medium leading-relaxed text-token-textMain/90">{limitsNote}</p>
                  <p className="whitespace-pre-line text-[11px] leading-relaxed text-token-textMain/85">
                    {detailLines.join('\n')}
                  </p>
                </div>

                <div className="mt-auto shrink-0 border-t border-[color:var(--border-subtle)]/60 pt-4">
                  {usageGuard.blocked && usageGuard.tooltip ? (
                    <Tooltip content={usageGuard.tooltip} className="block w-full">
                      <span className="block w-full">{planBtn}</span>
                    </Tooltip>
                  ) : (
                    planBtn
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {smsPacks.length ? (
        <Card id="billing-sms-addons" className={settingsCardCls}>
          <h2 className={cardTitleCls}>Əlavə SMS al</h2>
          <p className={cardTextCls}>
            Paket limitinizə əlavə SMS balansı. Kartla dərhal, köçürmə ilə admin təsdiqindən sonra aktivləşir.
          </p>
          {extraSmsBalance(billing) > 0 ? (
            <p className="text-xs text-emerald-400/90">
              Təsdiqlənmiş əlavə SMS: +{extraSmsBalance(billing)} (paket {planSmsMonthlyLimit(billing) ?? '—'} + əlavə ={' '}
              {billing?.limits?.sms_monthly ?? '—'} limit)
            </p>
          ) : null}
          {pendingSmsQuantity(billing) > 0 ? (
            <p className="text-xs text-sky-400/90">
              Gözləyən əlavə SMS: +{pendingSmsQuantity(billing)} (admin təsdiqindən sonra limitə əlavə olunacaq)
            </p>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {smsPacks.map((pack) => (
              <div
                key={pack.quantity}
                className="rounded-2xl border border-[color:var(--border-subtle)] p-4 flex flex-col gap-3"
              >
                <div className="font-display font-bold text-token-textMain">{pack.label}</div>
                <div className="text-lg font-bold text-token-textMain">{formatAzn(pack.price_azn)} AZN</div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full justify-center mt-auto"
                  disabled={planBusy}
                  onClick={() => openSmsCheckout(pack)}
                >
                  Al
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {storagePacks.length ? (
        <Card id="billing-storage-addons" className={settingsCardCls}>
          <h2 className={cardTitleCls}>Əlavə yaddaş al</h2>
          <p className={cardTextCls}>
            Paket limitinizə əlavə yaddaş sahəsi. Kartla dərhal, köçürmə ilə admin təsdiqindən sonra aktivləşir.
          </p>
          {storageUsageInfo.detail ? (
            <p className="text-xs text-token-textMuted">{storageUsageInfo.detail}</p>
          ) : null}
          {extraStorageBytes(billing) > 0 ? (
            <p className="text-xs text-emerald-400/90">
              Təsdiqlənmiş əlavə yaddaş: +{Math.round(extraStorageBytes(billing) / (1024 * 1024))} MB
            </p>
          ) : null}
          {pendingStorageMb(billing) > 0 ? (
            <p className="text-xs text-sky-400/90">
              Gözləyən əlavə yaddaş: +{pendingStorageMb(billing)} MB (admin təsdiqindən sonra)
            </p>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {storagePacks.map((pack) => (
              <div
                key={pack.quantity_mb}
                className="rounded-2xl border border-[color:var(--border-subtle)] p-4 flex flex-col gap-3"
              >
                <div className="font-display font-bold text-token-textMain">{pack.label}</div>
                <div className="text-lg font-bold text-token-textMain">{formatAzn(pack.price_azn)} AZN</div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full justify-center mt-auto"
                  disabled={planBusy}
                  onClick={() => openStorageCheckout(pack)}
                >
                  Al
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Card id="billing-payments" className={settingsCardCls}>
        <h2 className={cardTitleCls}>Ödəniş tarixçəsi</h2>
        <p className={cardTextCls}>
          Yalnız real ödənişlər (gözləyən, ödənilmiş, rədd edilmiş) göstərilir. Kartla ödənişə başlayıb
          bitirmədən bağlasanız, sistemdə «tamamlanmayıb» qeydi yaranır — burada görünmür.
        </p>
        {!billingPayments.length ? (
          <p className="text-sm text-token-textMuted">Hələ ödəniş yoxdur.</p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {billingPayments.slice(0, 20).map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--border-subtle)] px-3 py-2 text-sm"
              >
                <span className="text-token-textMain">
                  {billingPaymentTitle(p)} · {Number(p.amount || 0).toFixed(2)} ₼
                </span>
                <span
                  className={[
                    'text-xs font-medium',
                    p.status === 'paid'
                      ? 'text-emerald-400'
                      : p.status === 'pending'
                        ? 'text-amber-300'
                        : 'text-token-textMuted',
                  ].join(' ')}
                >
                  {p.payment_method === 'cash' ? 'Köçürmə' : 'Kart'} · {billingPaymentStatusLabel(p.status)}
                </span>
              </li>
            ))}
          </ul>
        )}
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
          Qrup yaradarkən paket (8/12 dərs), qiymət və cədvəli bir dəfə təyin edin. Dəvət linki ilə qoşulan tələbə yalnız ad və
          telefon yazır; «Təsdiqlə» basanda billing avtomatik oturur.
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
                            <div className="min-w-0">
                              <div className="truncate">{g.name}</div>
                              {g.join_code ? (
                                <div className="text-[11px] text-gray-500 mt-0.5 space-y-0.5">
                                  <div>
                                    {g.invite_ready ? (
                                      <span className="text-emerald-400/90 font-medium">Paket hazır · </span>
                                    ) : (
                                      <span className="text-amber-400/90 font-medium">Paket təyin edin · </span>
                                    )}
                                    {g.default_billing_type === '12_lessons' ? '12 dərs' : '8 dərs'}
                                    {g.default_package_fee != null ? ` · ${g.default_package_fee} ₼` : ''}
                                  </div>
                                  <div>
                                    Kod:{' '}
                                    <span className={theme === 'dark' ? 'text-gray-300 font-semibold' : 'text-token-textMain font-semibold'}>
                                      {g.join_code}
                                    </span>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                className={['text-xs', theme === 'dark' ? 'text-indigo-300' : 'text-indigo-700'].join(' ')}
                                onClick={() => openEditGroupPackage(s.id, g)}
                              >
                                Paket
                              </button>
                              {g.join_code ? (
                                <>
                                  <button
                                    type="button"
                                    className={['text-xs', theme === 'dark' ? 'text-primary hover:brightness-110' : 'text-primary hover:brightness-110'].join(' ')}
                                    onClick={async () => {
                                      try {
                                        await navigator.clipboard.writeText(String(g.join_code))
                                        toast('Kod kopyalandı', 'success')
                                      } catch {
                                        toast('Kopyalanmadı', 'error')
                                      }
                                    }}
                                  >
                                    Kod
                                  </button>
                                  <button
                                    type="button"
                                    className={['text-xs', theme === 'dark' ? 'text-primary hover:brightness-110' : 'text-primary hover:brightness-110'].join(' ')}
                                    onClick={async () => {
                                      const link = groupInvitationLink(g)
                                      try {
                                        await navigator.clipboard.writeText(link)
                                        toast('Link kopyalandı', 'success')
                                      } catch {
                                        toast('Link kopyalanmadı', 'error')
                                      }
                                    }}
                                  >
                                    Link
                                  </button>
                                  <button
                                    type="button"
                                    className={['text-xs font-semibold', theme === 'dark' ? 'text-emerald-300 hover:brightness-110' : 'text-emerald-700 hover:brightness-110'].join(' ')}
                                    title="WhatsApp üçün hazır mətn"
                                    onClick={async () => {
                                      const link = groupInvitationLink(g)
                                      const text = buildWhatsAppInviteMessage(link)
                                      try {
                                        await navigator.clipboard.writeText(text)
                                        toast('WhatsApp mətni kopyalandı', 'success')
                                      } catch {
                                        toast('Kopyalanmadı', 'error')
                                      }
                                    }}
                                  >
                                    Linki Kopyala
                                  </button>
                                  <button
                                    type="button"
                                    className={['text-xs', theme === 'dark' ? 'text-primary hover:brightness-110' : 'text-primary hover:brightness-110'].join(' ')}
                                    onClick={async () => {
                                      const link = `${window.location.origin}/join/${encodeURIComponent(String(g.join_code))}`
                                      try {
                                        if (navigator.share) {
                                          await navigator.share({ title: 'Mentorix invite', text: 'Qrupa qoşul', url: link })
                                          return
                                        }
                                      } catch {
                                        // ignore
                                      }
                                      try {
                                        await navigator.clipboard.writeText(link)
                                        toast('Link kopyalandı', 'success')
                                      } catch {
                                        toast('Link kopyalanmadı', 'error')
                                      }
                                    }}
                                  >
                                    Paylaş
                                  </button>
                                  <button
                                    type="button"
                                    className={['text-xs', theme === 'dark' ? 'text-primary hover:brightness-110' : 'text-primary hover:brightness-110'].join(' ')}
                                    onClick={() => {
                                      setQrGroup({ ...g, subjectName: s.name })
                                      setQrOpen(true)
                                    }}
                                  >
                                    QR
                                  </button>
                                </>
                              ) : null}
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
                            </div>
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
                        onClick={() => openCreateGroup(s.id)}
                        className={secondaryBtnCls}
                      >
                        Qrup + paket
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

      <Modal
        open={Boolean(limitChoice?.open)}
        onClose={() => setLimitChoice(null)}
        title={`${currentPlanTitle} — limit həlli`}
        size="md"
      >
        {limitChoice?.open ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400 leading-relaxed">
              Hansı limitə ehtiyacınız var? Aşağı paketə keçmək lazım deyil — cari{' '}
              <span className="text-white font-medium">{currentPlanTitle}</span> paketində qalın.
            </p>
            {smsUsageInfo.detail ? (
              <p className="text-xs text-gray-500 rounded-lg bg-white/5 px-3 py-2">{smsUsageInfo.detail}</p>
            ) : null}
            <div className="flex flex-col gap-2">
              {canBuySmsOnCurrentPlan(billing, smsPacks.length) ? (
                <Button
                  variant="primary"
                  className="w-full justify-center"
                  onClick={() => {
                    setLimitChoice(null)
                    document.getElementById('billing-sms-addons')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                >
                  Əlavə SMS al
                </Button>
              ) : null}
              <Button
                variant="secondary"
                className="w-full justify-center"
                onClick={() => {
                  setLimitChoice(null)
                  navigate('/instructor/exams')
                }}
              >
                Yaddaşı idarə et (faylları azalt)
              </Button>
              {!billing?.is_highest_tier ? (
                <Button
                  variant="secondary"
                  className="w-full justify-center"
                  disabled={planBusy}
                  onClick={() => {
                    setLimitChoice(null)
                    openPlanCheckout(currentPlanId)
                  }}
                >
                  Paketi yenilə
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <PaymentMethodModal
        open={Boolean(checkout)}
        onClose={() => setCheckout(null)}
        title={
          checkout?.type === 'sms'
            ? 'SMS ödənişi'
            : checkout?.type === 'storage'
              ? 'Yaddaş ödənişi'
              : 'Paket ödənişi'
        }
        subtitle={checkout?.title ? `Seçim: ${checkout.title}` : undefined}
        amountAzn={checkout?.amountAzn}
        manualAccount={manualAccount}
        busy={planBusy}
        onConfirm={confirmCheckout}
      />

      <Modal
        open={Boolean(groupModal)}
        onClose={() => setGroupModal(null)}
        title={groupModal?.mode === 'edit' ? 'Qrup paketi' : 'Yeni qrup və paket'}
        size="lg"
      >
        {groupModal ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Qrup adı</label>
              <input
                className={inp}
                value={groupModal.mode === 'create' ? groupModal.name : groupModal.group?.name || ''}
                readOnly={groupModal.mode === 'create'}
                onChange={
                  groupModal.mode === 'edit'
                    ? (e) =>
                        setGroupModal((m) => ({
                          ...m,
                          group: { ...m.group, name: e.target.value },
                        }))
                    : undefined
                }
              />
            </div>
            <GroupPackageFields value={groupPkg} onChange={setGroupPkg} />
            <div className="flex gap-2">
              <Button className="flex-1 justify-center" loading={busy.groupModal} onClick={() => void saveGroupModal()}>
                Yadda saxla
              </Button>
              <Button variant="secondary" className="flex-1 justify-center" onClick={() => setGroupModal(null)}>
                Ləğv et
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        title="QR ilə qoşul"
        size="sm"
      >
        <div className="space-y-4">
          <div className="text-sm text-gray-400 text-center">
            {qrGroup?.subjectName ? <div className="text-xs text-gray-500">{qrGroup.subjectName}</div> : null}
            <div className="text-white font-semibold">{qrGroup?.name}</div>
            {qrGroup?.join_code ? (
              <div className="mt-1">
                Join code: <span className="text-gray-200 font-semibold">{qrGroup.join_code}</span>
              </div>
            ) : null}
          </div>

          {qrGroup?.join_code ? (
            <div className="flex justify-center">
              <div className="bg-white rounded-2xl p-4">
                <QRCodeCanvas
                  value={`${window.location.origin}/join/${encodeURIComponent(String(qrGroup.join_code))}`}
                  size={220}
                  includeMargin
                />
              </div>
            </div>
          ) : null}

          {qrGroup?.join_code ? (
            <Button
              className="w-full justify-center"
              variant="secondary"
              onClick={async () => {
                const link = `${window.location.origin}/join/${encodeURIComponent(String(qrGroup.join_code))}`
                try {
                  await navigator.clipboard.writeText(link)
                  toast('Link kopyalandı', 'success')
                } catch {
                  toast('Link kopyalanmadı', 'error')
                }
              }}
            >
              Linki kopyala
            </Button>
          ) : null}
        </div>
      </Modal>
    </div>
  )
}

