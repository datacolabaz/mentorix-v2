import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import Card from '../../components/common/Card'
import Button from '../../components/common/Button'
import { useToast } from '../../components/common/Toast'
import useAuthStore from '../../hooks/useAuth'
import { planTitleOrSlug, nextPlanInList } from '../../lib/subscriptionPlanGuards'
import useUiStore from '../../hooks/useUi'
import { planPriceLabel } from '../../constants/subscriptionPlans'
import { useSubscriptionPlans } from '../../hooks/useSubscriptionPlans'
import { useBillingStatus, BILLING_STATUS_QUERY_KEY } from '../../hooks/useBillingStatus'
import { SUBSCRIPTION_PLANS_QUERY_KEY } from '../../hooks/useSubscriptionPlans'
import PricingBillingIntervalToggle from '../../components/instructor/PricingBillingIntervalToggle'
import InstructorMapPinPicker from '../../components/instructor/InstructorMapPinPicker'
import InstructorMapPreviewModal from '../../components/instructor/InstructorMapPreviewModal'
import InstructorDiscoverSettings from '../../components/instructor/InstructorDiscoverSettings'
import InstructorAvatarUpload from '../../components/instructor/InstructorAvatarUpload'
import { reverseGeocodeLabel } from '../../lib/reverseGeocode'
import { formatAzn, yearlyTotalAzn, YEARLY_DISCOUNT } from '../../lib/pricing'
import { planDetailLines, planLimitsHeadline } from '../../lib/subscriptionPlanCopy'
import { normalizePlanId } from '../../lib/subscriptionPlanMarketing'
import {
  canBuySmsOnCurrentPlan,
  canBuyStorageOnCurrentPlan,
  canRenewBasicPlan,
  hasPendingSmsTopup,
  isBasicTrialActive,
  isBasicTrialExpired,
  isSmsMonthlyLimitReached,
  isStorageLimitReached,
  planDowngradeGuard,
  planRank,
  shouldOfferLimitTopUpChoice,
  nextPlanId,
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
import StorageAddonModal from '../../components/instructor/StorageAddonModal'
import { formatStorageBytesHuman } from '../../lib/storageAddonDisplay'
import { useBillingConfig } from '../../hooks/useBillingConfig'
import { openBillingReceiptWhatsApp } from '../../lib/billingPaymentLabels'
import Modal from '../../components/common/Modal'

function billingPaymentTitleLocalized(p, t) {
  if (p?.product_type === 'sms') return t('settings.billingTitle.sms', { count: p.sms_quantity || 0 })
  if (p?.product_type === 'storage') {
    const mb = Math.round(Number(p.storage_mb) || 0)
    if (mb >= 1024 && mb % 1024 === 0) {
      return t('settings.billingTitle.storageGb', { size: mb / 1024 })
    }
    return t('settings.billingTitle.storageMb', { size: mb })
  }
  const plan = String(p?.plan || '').toUpperCase()
  const interval =
    p?.billing_interval === 'yearly'
      ? t('settings.billingInterval.yearly')
      : p?.billing_interval === 'monthly'
        ? t('settings.billingInterval.monthly')
        : ''
  return t('settings.billingTitle.plan', { plan, interval })
}

function billingStatusLocalized(status, t) {
  const s = String(status || '').toLowerCase()
  if (['pending', 'paid', 'rejected', 'failed', 'expired'].includes(s)) {
    return t(`settings.billingStatus.${s}`)
  }
  return status || '—'
}

function buildSmsUsageDetail(billing, t) {
  const info = smsUsageDisplay(billing)
  const parts = []
  if (info.planBase != null) parts.push(t('settings.smsUsage.plan', { count: info.planBase }))
  if (info.extra > 0) parts.push(t('settings.smsUsage.extra', { count: info.extra }))
  if (info.pending > 0) parts.push(t('settings.smsUsage.pending', { count: info.pending }))
  let detail = parts.length ? parts.join(', ') : null
  if (info.pending > 0 && info.effective != null) {
    const after = info.effective + info.pending
    detail = detail
      ? t('settings.smsUsage.limitAfter', { detail, count: after })
      : t('settings.smsUsage.afterConfirm', { count: after })
  }
  return detail
}

function buildStorageUsageDetail(billing, t) {
  const info = storageUsageDisplay(billing)
  if (!info.detail) return null
  const parts = []
  if (info.planBaseB != null) {
    const mb = Number(info.planBaseB) / (1024 * 1024)
    const size =
      mb >= 1024
        ? t('settings.storageUsage.sizeGb', { size: mb / 1024 })
        : t('settings.storageUsage.sizeMb', { size: Math.round(mb) })
    parts.push(t('settings.storageUsage.plan', { size }))
  }
  if (info.extraB > 0) {
    const mb = Number(info.extraB) / (1024 * 1024)
    const size =
      mb >= 1024
        ? t('settings.storageUsage.sizeGb', { size: mb / 1024 })
        : t('settings.storageUsage.sizeMb', { size: Math.round(mb * 10) / 10 })
    parts.push(t('settings.storageUsage.extra', { size }))
  }
  if (info.pendingMb > 0) {
    const size =
      info.pendingMb >= 1024 && info.pendingMb % 1024 === 0
        ? t('settings.storageUsage.sizeGb', { size: info.pendingMb / 1024 })
        : t('settings.storageUsage.sizeMb', { size: info.pendingMb })
    parts.push(t('settings.storageUsage.pending', { size }))
  }
  let detail = parts.length ? parts.join(', ') : null
  if (info.pendingMb > 0 && info.limit != null) {
    const afterMb = Number(info.limit) / (1024 * 1024) + info.pendingMb
    const after =
      afterMb >= 1024
        ? t('settings.storageUsage.sizeGb', { size: afterMb / 1024 })
        : t('settings.storageUsage.sizeMb', { size: Math.round(afterMb) })
    detail = detail
      ? t('settings.storageUsage.limitAfter', { detail, size: after })
      : t('settings.storageUsage.afterConfirm', { size: after })
  }
  return detail
}

export default function InstructorSettings() {
  const { t, i18n } = useTranslation()
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
  const payriffEnabled = Boolean(billingConfigQ.data?.payriff_enabled)
  const smsPacks = Array.isArray(billingConfigQ.data?.sms_packs) ? billingConfigQ.data.sms_packs : []
  const storagePacks = Array.isArray(billingConfigQ.data?.storage_packs)
    ? billingConfigQ.data.storage_packs
    : []
  const [checkout, setCheckout] = useState(null)
  const [limitChoice, setLimitChoice] = useState(null) // null | { open: true }
  const [storageAddonOpen, setStorageAddonOpen] = useState(false)
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
  const [primarySubjectName, setPrimarySubjectName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [accountName, setAccountName] = useState('')
  const [savingAccountName, setSavingAccountName] = useState(false)
  const [profEducation, setProfEducation] = useState('')
  const [profExperienceYears, setProfExperienceYears] = useState('')
  const [profBio, setProfBio] = useState('')
  const [savingProfessional, setSavingProfessional] = useState(false)
  const [billingInterval, setBillingInterval] = useState('monthly')

  useEffect(() => {
    setAccountName(user?.full_name || '')
  }, [user?.full_name])

  const saveAccountName = async () => {
    const name = accountName.trim()
    if (name.length < 2) {
      toast(t('settings.toasts.nameMin'), 'error')
      return
    }
    setSavingAccountName(true)
    try {
      const res = await api.patch('/auth/profile', { full_name: name })
      if (res?.user) {
        updateUser(res.user)
        toast(t('settings.toasts.nameSaved'), 'success')
      }
    } catch (e) {
      toast(e?.message || t('settings.toasts.saveFailed'), 'error')
    } finally {
      setSavingAccountName(false)
    }
  }

  const saveProfessionalDetails = async () => {
    const bio = profBio.trim()
    if (bio.length > 300) {
      toast(t('settings.toasts.bioMax'), 'error')
      return
    }
    setSavingProfessional(true)
    try {
      const res = await api.patch('/instructor/professional-details', {
        education: profEducation.trim() || null,
        experience_years: profExperienceYears.trim() === '' ? null : profExperienceYears.trim(),
        bio: bio || null,
      })
      setProfEducation(res?.education || '')
      setProfExperienceYears(
        res?.experience_years != null && Number.isFinite(Number(res.experience_years))
          ? String(res.experience_years)
          : '',
      )
      setProfBio(res?.bio || '')
      toast(res?.message || t('settings.toasts.saved'), 'success')
    } catch (e) {
      toast(e?.message || t('settings.toasts.saveFailed'), 'error')
    } finally {
      setSavingProfessional(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [d, prof] = await Promise.all([
        api.get('/instructor/teaching'),
        api.get('/instructor/professional-details').catch(() => ({})),
      ])
      setPublicLabel(d.public_label === 'trainer' ? 'trainer' : 'instructor')
      setProfEducation(prof?.education || '')
      setProfExperienceYears(
        prof?.experience_years != null && Number.isFinite(Number(prof.experience_years))
          ? String(prof.experience_years)
          : '',
      )
      setProfBio(prof?.bio || '')
      setAvatarUrl(d.avatar_url || null)
      const m = d.map || {}
      setMapLat(m.latitude != null && Number.isFinite(Number(m.latitude)) ? String(m.latitude) : '')
      setMapLng(m.longitude != null && Number.isFinite(Number(m.longitude)) ? String(m.longitude) : '')
      setMapKind(m.map_profile_kind === 'trainer' ? 'trainer' : 'teacher')
      setMapVisible(m.map_visible !== false)
      const radius =
        m.map_search_radius_km != null && Number.isFinite(Number(m.map_search_radius_km))
          ? Number(m.map_search_radius_km)
          : 10
      setMapRadiusKm([5, 10, 25].includes(radius) ? radius : 10)
      const subs = Array.isArray(d.subjects) ? d.subjects : []
      setPrimarySubjectName(subs[0]?.name || '')
      savedMapRef.current = {
        lat: m.latitude != null && Number.isFinite(Number(m.latitude)) ? String(m.latitude) : '',
        lng: m.longitude != null && Number.isFinite(Number(m.longitude)) ? String(m.longitude) : '',
        kind: m.map_profile_kind === 'trainer' ? 'trainer' : 'teacher',
        visible: m.map_visible !== false,
        radius: [5, 10, 25].includes(radius) ? radius : 10,
      }
      setMapJustSaved(false)
    } catch (e) {
      toast(e?.message || t('settings.toasts.loadFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (location.state?.openStorageAddon) {
      setStorageAddonOpen(true)
      navigate(location.pathname, { replace: true, state: { scrollTo: location.state?.scrollTo } })
    }
  }, [location.state?.openStorageAddon, location.pathname, navigate])

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
    return (
      s.lat !== mapLat ||
      s.lng !== mapLng ||
      s.kind !== mapKind ||
      s.visible !== mapVisible ||
      s.radius !== mapRadiusKm
    )
  }, [mapLat, mapLng, mapKind, mapVisible, mapRadiusKm, hasMapPin])

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
        setLocationLabel(label || t('settings.locationSelected'))
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
      toast(t('settings.toasts.labelSaved'))
    } catch (e) {
      toast(e?.message || t('settings.toasts.error'), 'error')
    } finally {
      setSavingLabel(false)
    }
  }

  const fillMapFromGeolocation = () => {
    if (!navigator.geolocation) {
      toast(t('settings.toasts.geoUnsupported'), 'error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMapLat(String(pos.coords.latitude.toFixed(6)))
        setMapLng(String(pos.coords.longitude.toFixed(6)))
        setMapFlyKey((k) => k + 1)
        setMapJustSaved(false)
        toast(t('settings.toasts.geoMarked'), 'info')
      },
      () => toast(t('settings.toasts.geoFailed'), 'error'),
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }

  const saveMapProfile = async () => {
    setSavingMap(true)
    try {
      const lat = mapLat.trim() === '' ? null : Number(String(mapLat).replace(',', '.'))
      const lng = mapLng.trim() === '' ? null : Number(String(mapLng).replace(',', '.'))
      if (lat != null && (!Number.isFinite(lat) || lat < -90 || lat > 90)) {
        toast(t('settings.toasts.latInvalid'), 'error')
        return
      }
      if (lng != null && (!Number.isFinite(lng) || lng < -180 || lng > 180)) {
        toast(t('settings.toasts.lngInvalid'), 'error')
        return
      }
      if (mapVisible && (lat == null || lng == null)) {
        toast(t('settings.toasts.pinRequired'), 'error')
        return
      }
      await api.patch('/instructor/map-profile', {
        latitude: lat,
        longitude: lng,
        map_profile_kind: mapKind,
        map_visible: mapVisible,
        map_search_radius_km: mapRadiusKm,
      })
      savedMapRef.current = {
        lat: mapLat,
        lng: mapLng,
        kind: mapKind,
        visible: mapVisible,
        radius: mapRadiusKm,
      }
      setMapJustSaved(true)
      if (mapVisible && lat != null && lng != null) {
        toast(t('settings.toasts.mapSavedVisible'), 'success')
      } else {
        toast(t('settings.toasts.mapSavedHidden'), 'success')
      }
    } catch (e) {
      toast(e?.message || t('settings.toasts.error'), 'error')
    } finally {
      setSavingMap(false)
    }
  }

  const roleWord = publicLabel === 'trainer' ? t('settings.trainer') : t('settings.teacher')
  const currentPlanId = String(billing?.plan || 'basic').toLowerCase()
  const currentPlanObj = plans.find((p) => String(p?.id || '').toLowerCase() === currentPlanId) || null
  const currentPlanTitle = currentPlanObj?.title || String(currentPlanId || '').toUpperCase()
  const basicUpgradePlanId = useMemo(() => nextPlanId(plans, 'basic') || 'pro', [plans])
  const basicUpgradeBtnLabel = useMemo(() => {
    const next = nextPlanInList(plans, 'basic')
    const switchLabel = next ? t('settings.switchToPlan', { plan: planTitleOrSlug(next) }) : null
    return switchLabel ? t('settings.btnUpgradeWithSwitch', { switch: switchLabel }) : t('settings.btnUpgrade')
  }, [plans, t])
  const basicHigherPlansHint = useMemo(() => {
    const next = nextPlanInList(plans, 'basic')
    const name = next ? planTitleOrSlug(next) : t('settings.paidPlanFallback')
    return t('settings.higherPlansLabel', { plan: name })
  }, [plans, t])
  const basicHigherPlansSuffix = useMemo(() => {
    const next = nextPlanInList(plans, 'basic')
    const name = next ? planTitleOrSlug(next) : t('settings.paidPlanFallback')
    return t('settings.higherPlansSuffix', { plan: name })
  }, [plans, t])
  const basicSwitchLabel = useMemo(
    () =>
      (() => {
        const next = nextPlanInList(plans, 'basic')
        return next ? t('settings.switchToPlan', { plan: planTitleOrSlug(next) }) : t('settings.btnSwitchPlan')
      })(),
    [plans, t],
  )
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
        return { main: `${formatAzn(monthly)} AZN`, suffix: t('settings.pricing.perMonth'), hint: null, isPaid: true }
      const y = yearlyTotalAzn(monthly, YEARLY_DISCOUNT)
      return {
        main: `${formatAzn(y)} AZN`,
        suffix: t('settings.pricing.perYear'),
        hint: t('settings.pricing.yearlyHint', {
          monthly: formatAzn(monthly),
          pct: Math.round(YEARLY_DISCOUNT * 100),
        }),
        isPaid: true,
      }
    },
    [billingInterval, t],
  )

  const smsUsageInfo = useMemo(() => smsUsageDisplay(billing), [billing])
  const storageUsageInfo = useMemo(() => storageUsageDisplay(billing), [billing])
  const localizedSmsDetail = useMemo(() => buildSmsUsageDetail(billing, t), [billing, t])
  const localizedStorageDetail = useMemo(() => buildStorageUsageDetail(billing, t), [billing, t])

  const currentPlanPricingLine = useMemo(() => {
    if (!currentPlanObj) return '—'
    const pid = String(currentPlanObj.id || '').toLowerCase()
    if (pid === 'basic') {
      const days = billing?.subscription?.days_left
      if (days != null && days > 0) {
        return t('settings.pricing.trialDaysLeft', { days })
      }
      if (String(billing?.status || '') === 'expired') {
        return t('settings.pricing.trialExpired')
      }
      return t('settings.pricing.trialExtraOnly', { plans: basicHigherPlansSuffix })
    }
    const m = Number(currentPlanObj.price_azn)
    if (!Number.isFinite(m) || m <= 0) return planPriceLabel(currentPlanObj)
    if (billingInterval === 'monthly') return t('settings.pricing.monthly', { amount: formatAzn(m) })
    return t('settings.pricing.yearly', { amount: formatAzn(yearlyTotalAzn(m)), monthly: formatAzn(m) })
  }, [basicHigherPlansSuffix, billing?.status, billing?.subscription?.days_left, billingInterval, currentPlanObj, t])

  useEffect(() => {
    api
      .get('/billing/payments')
      .then((d) => setBillingPayments(Array.isArray(d?.payments) ? d.payments : []))
      .catch(() => {})
  }, [planBusy])

  function openPlanCheckout(planId) {
    const p = plans.find((x) => x && String(x.id).toLowerCase() === String(planId).toLowerCase())
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
          const amount = String((Number(pay?.amount_cents || 0) / 100).toFixed(2))
          const qs = new URLSearchParams({
            account: pay?.manual_transfer_account || manualAccount,
            amount,
            product: 'plan',
          })
          navigate(`/payment/pending?${qs}`)
          openBillingReceiptWhatsApp({ amountAzn: amount, product: 'plan' })
          return
        }
        const url = pay?.payment_url
        if (!url) throw new Error(t('settings.toasts.paymentLinkFailed'))
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
          const amount = String((Number(pay?.amount_cents || 0) / 100).toFixed(2))
          const qs = new URLSearchParams({
            account: pay?.manual_transfer_account || manualAccount,
            amount,
            product: 'storage',
          })
          navigate(`/payment/pending?${qs}`)
          openBillingReceiptWhatsApp({ amountAzn: amount, product: 'storage' })
          return
        }
        const url = pay?.payment_url
        if (!url) throw new Error(t('settings.toasts.paymentLinkFailed'))
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
        const amount = String((Number(pay?.amount_cents || 0) / 100).toFixed(2))
        const qs = new URLSearchParams({
          account: pay?.manual_transfer_account || manualAccount,
          amount,
          product: 'sms',
        })
        navigate(`/payment/pending?${qs}`)
        openBillingReceiptWhatsApp({ amountAzn: amount, product: 'sms' })
        return
      }
      const url = pay?.payment_url
      if (!url) throw new Error(t('settings.toasts.paymentLinkFailed'))
      window.location.href = url
    } catch (e) {
      const msg =
        e?.code === 'PLAN_USAGE_EXCEEDS' || /limitini aşır/i.test(String(e?.message || ''))
          ? e?.message || t('settings.toasts.usageExceeds')
          : e?.code === 'PLAN_NOT_UPGRADE'
            ? t('settings.toasts.notUpgrade')
            : e?.message || t('settings.toasts.paymentFailed')
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
        <h1 className="font-display font-bold text-xl sm:text-2xl text-token-textMain tracking-tight">{t('settings.title')}</h1>
        <p className="text-token-textMuted text-sm mt-1">
          {t('settings.subtitle', { role: roleWord })}
        </p>
      </div>

      <Card id="billing-plans" className={settingsCardCls}>
        <h2 className={cardTitleCls}>{t('settings.changePlan')}</h2>
        <p className={cardTextCls}>
          <span className={theme === 'dark' ? 'text-gray-200' : 'text-token-textMuted'}>{t('settings.activePlan')}</span>{' '}
          <span className="font-semibold text-token-textMain">
            {currentPlanObj?.title || String(currentPlanId || '').toUpperCase()}
          </span>
          <span className={theme === 'dark' ? 'text-gray-500' : 'text-token-textMuted'}> — {currentPlanPricingLine}</span>
        </p>
        <p className={cardTextCls}>
          {t('settings.downgradeNote')}
        </p>
        {billing?.subscription?.downgrade_period_met === false &&
        billing?.subscription?.days_until_downgrade != null ? (
          <p className="text-[11px] text-token-textMuted">
            {t('settings.downgradeInDays', { days: billing.subscription.days_until_downgrade })}
          </p>
        ) : null}
        {billing ? (
          <div className="space-y-2">
            {smsUsageInfo.effective != null ? (
              <p className="text-[11px] text-token-textMuted leading-relaxed">
                {t('settings.smsLimitLine', {
                  label: smsUsageInfo.label,
                  detail: localizedSmsDetail ? ` — ${localizedSmsDetail}` : '',
                  plan: currentPlanTitle,
                })}
              </p>
            ) : null}
            {smsUsageInfo.smsShortfall > 0 ? (
              <p className="text-[11px] text-amber-300/95 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 leading-relaxed">
                {t('settings.smsShortfall', {
                  used: smsUsageInfo.used,
                  effective: smsUsageInfo.effective,
                  plan: currentPlanTitle,
                  shortfall: smsUsageInfo.smsShortfall,
                })}
              </p>
            ) : null}
            {hasPendingSmsTopup(billing) ? (
              <p className="text-[11px] text-sky-300/95 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 leading-relaxed">
                {t('settings.pendingSmsPayment', { plan: currentPlanTitle })}
              </p>
            ) : null}
            {pendingPlanSlug && pendingPlanSlug !== currentPlanId ? (
              <p className="text-[11px] text-sky-300/95 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 leading-relaxed">
                {t('settings.pendingPlan', {
                  plan: pendingPlanObj?.title || pendingPlanSlug.toUpperCase(),
                })}
              </p>
            ) : null}
            {shouldOfferLimitTopUpChoice(billing, {
              smsPacksCount: smsPacks.length,
              storagePacksCount: storagePacks.length,
            }) ? (
              <p className="text-[11px] text-indigo-300/90 rounded-lg border border-indigo-500/25 bg-indigo-500/10 px-3 py-2 leading-relaxed">
                {currentPlanId === 'basic' ? (
                  t('settings.basicLimitHint', { plans: basicHigherPlansHint })
                ) : (
                  t('settings.paidLimitHint')
                )}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 items-stretch">
          {plans.filter(Boolean).map((p) => {
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
            const basicTrialActive = isCurrent && isFree && isBasicTrialActive(billing)
            const basicTrialExpired = isCurrent && isFree && isBasicTrialExpired(billing)

            let btnLabel = t('settings.btnStart')
            if (isCurrent) {
              if (isFree) {
                btnLabel = basicTrialExpired ? basicUpgradeBtnLabel : t('settings.btnActivePlan')
              } else if (limitChoiceOffer) {
                btnLabel = t('settings.btnLimitSolution')
              } else if (
                (canBuySmsOnCurrentPlan(billing, smsPacks.length) ||
                  canBuyStorageOnCurrentPlan(billing, storagePacks.length)) &&
                (smsPacks.length || storagePacks.length)
              )
                btnLabel = t('settings.btnBuyExtra')
              else if (canRenewBasicPlan(billing)) btnLabel = t('settings.btnRenew')
              else btnLabel = t('settings.btnCurrent')
            } else if (usageGuard.blocked) {
              btnLabel =
                usageGuard.reason === 'period'
                  ? t('settings.btnWaitMonth')
                  : isFree
                    ? t('settings.btnFreeStart')
                    : t('settings.btnSwitchBlocked')
            } else if (isFree) {
              btnLabel = t('settings.btnFreeStart')
            } else if (isPendingPlan) {
              btnLabel = t('settings.btnPending')
            } else if (isUpgrade) {
              btnLabel = t('settings.btnUpgrade')
            } else {
              btnLabel = t('settings.btnSwitchPlan')
            }

            const priceBox = displayPriceForPlan(p)

            const planCopyOpts = {
              billing,
              isCurrent,
              t,
              i18n,
              planTitle: t(`landing.plans.${normalizePlanId(p)}.title`, { defaultValue: p.title }),
            }

            const limitsNote =
              typeof p?.limitsNote === 'string' && p.limitsNote.trim()
                ? p.limitsNote.trim()
                : planLimitsHeadline(p, planCopyOpts)
            const detailLines = planDetailLines(p, planCopyOpts)

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
                if (isFree) {
                  if (basicTrialExpired) return openPlanCheckout(basicUpgradePlanId)
                  return
                }
                if (limitChoiceOffer) {
                  openLimitChoiceModal()
                  return
                }
                if (storagePacks.length && isStorageLimitReached(billing)) {
                  setStorageAddonOpen(true)
                  return
                }
                if (storagePacks.length) {
                  setStorageAddonOpen(true)
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
                  t('settings.confirmPlanSwitch', { title }),
                )
              ) {
                return
              }
              return openPlanCheckout(p.id)
            }

            const btnDisabled =
              planBusy || Boolean(usageGuard.blocked) || isPendingPlan || basicTrialActive

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
                  basicTrialExpired
                    ? 'primary'
                    : isCurrent
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
                        {t('settings.badgeActive')}
                      </span>
                    ) : isPendingPlan ? (
                      <span className="rounded-full bg-sky-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-900 dark:text-sky-100 ring-1 ring-sky-500/35">
                        {t('settings.badgePending')}
                      </span>
                    ) : isProHighlight ? (
                      <span className="rounded-full bg-primary/30 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-900 dark:text-indigo-100 ring-1 ring-primary/35">
                        {t('settings.badgePopular')}
                      </span>
                    ) : null}
                  </div>
                  {billingInterval === 'yearly' && priceBox?.isPaid ? (
                    <span className="shrink-0 rounded-full bg-emerald-500/18 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-100">
                      {t('settings.yearlyDiscount')}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 shrink-0 text-base font-display font-bold tracking-tight text-token-textMain">
                  {t(`landing.plans.${normalizePlanId(p)}.title`, { defaultValue: p.title })}
                </div>

                <div className="mt-1 shrink-0 flex flex-wrap items-baseline gap-1">
                  {priceBox?.isPaid ? (
                    <>
                      <span className="text-xl font-display font-bold tracking-tight text-token-textMain">{priceBox.main}</span>
                      <span className="text-xs font-medium text-token-textMuted">{priceBox.suffix}</span>
                    </>
                  ) : (
                    <span className="text-xl font-display font-bold tracking-tight text-token-textMain">{t('settings.free')}</span>
                  )}
                </div>

                {priceBox?.hint ? (
                  <p className="mt-1 shrink-0 text-[11px] leading-snug text-token-textMuted">{priceBox.hint}</p>
                ) : billingInterval === 'yearly' && priceBox?.isPaid ? (
                  <p className="mt-1 shrink-0 text-[11px] leading-snug text-emerald-600/95 dark:text-emerald-300/90">
                    {t('settings.yearlySave')}
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

      {smsPacks.length && canBuySmsOnCurrentPlan(billing, smsPacks.length) ? (
        <Card id="billing-sms-addons" className={settingsCardCls}>
          <h2 className={cardTitleCls}>{t('settings.buySmsTitle')}</h2>
          <p className={cardTextCls}>
            {t('settings.buySmsDesc')}
          </p>
          {extraSmsBalance(billing) > 0 ? (
            <p className="text-xs text-emerald-400/90">
              {t('settings.confirmedExtraSms', {
                count: extraSmsBalance(billing),
                base: planSmsMonthlyLimit(billing) ?? '—',
                limit: billing?.limits?.sms_monthly ?? '—',
              })}
            </p>
          ) : null}
          {pendingSmsQuantity(billing) > 0 ? (
            <p className="text-xs text-sky-400/90">
              {t('settings.pendingExtraSms', { count: pendingSmsQuantity(billing) })}
            </p>
          ) : null}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {smsPacks.filter(Boolean).map((pack) => (
              <div
                key={pack?.quantity ?? pack?.label}
                className="rounded-2xl border border-[color:var(--border-subtle)] p-4 flex flex-col gap-3"
              >
                <div className="font-display font-bold text-token-textMain">{pack?.label ?? '—'}</div>
                <div className="text-lg font-bold text-token-textMain">{formatAzn(pack.price_azn)} AZN</div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full justify-center mt-auto"
                  disabled={planBusy}
                  onClick={() => openSmsCheckout(pack)}
                >
                  {t('settings.buy')}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {storagePacks.length && canBuyStorageOnCurrentPlan(billing, storagePacks.length) ? (
        <Card id="billing-storage-addons" className={settingsCardCls}>
          <h2 className={cardTitleCls}>{t('settings.storageTitle')}</h2>
          <p className={cardTextCls}>
            {t('settings.storageDesc')}
          </p>
          {localizedStorageDetail ? (
            <p className="text-xs text-token-textMuted">{localizedStorageDetail}</p>
          ) : null}
          {extraStorageBytes(billing) > 0 ? (
            <p className="text-xs text-emerald-400/90">
              {t('settings.confirmedExtraStorage', {
                size: formatStorageBytesHuman(extraStorageBytes(billing)),
              })}
            </p>
          ) : null}
          {pendingStorageMb(billing) > 0 ? (
            <p className="text-xs text-sky-400/90">
              {t('settings.pendingExtraStorage', {
                size:
                  pendingStorageMb(billing) >= 1024 && pendingStorageMb(billing) % 1024 === 0
                    ? `${pendingStorageMb(billing) / 1024} GB`
                    : `${pendingStorageMb(billing)} MB`,
              })}
            </p>
          ) : null}
          <Button
            type="button"
            variant="primary"
            className="w-full sm:w-auto justify-center"
            disabled={planBusy}
            onClick={() => setStorageAddonOpen(true)}
          >
            {t('settings.chooseStorage')}
          </Button>
        </Card>
      ) : null}

      <Card id="billing-payments" className={settingsCardCls}>
        <h2 className={cardTitleCls}>{t('settings.billingHistory')}</h2>
        <p className={cardTextCls}>
          {t('settings.billingHistoryDesc')}
        </p>
        {!billingPayments.length ? (
          <p className="text-sm text-token-textMuted">{t('settings.noPayments')}</p>
        ) : (
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {billingPayments.slice(0, 20).map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--border-subtle)] px-3 py-2 text-sm"
              >
                <span className="text-token-textMain">
                  {billingPaymentTitleLocalized(p, t)} · {Number(p.amount || 0).toFixed(2)} ₼
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
                  {p.payment_method === 'cash' ? t('settings.transfer') : t('settings.card')} ·{' '}
                  {billingStatusLocalized(p.status, t)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className={settingsCardCls}>
        <h2 className={cardTitleCls}>{t('settings.nameTitle')}</h2>
        <p className={cardTextCls}>
          {t('settings.nameDesc')}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
          <input
            type="text"
            className={inp}
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder={t('settings.namePlaceholder')}
            maxLength={120}
          />
          <Button
            type="button"
            loading={savingAccountName}
            disabled={!accountName.trim() || accountName.trim() === (user?.full_name || '').trim()}
            onClick={() => void saveAccountName()}
            className="justify-center shrink-0"
          >
            {t('settings.saveName')}
          </Button>
        </div>
      </Card>

      <Card className={settingsCardCls}>
        <h2 className={cardTitleCls}>{t('settings.avatarTitle')}</h2>
        <p className={cardTextCls}>
          {t('settings.avatarDesc')}
        </p>
        <InstructorAvatarUpload
          fullName={user?.full_name}
          avatarUrl={avatarUrl}
          mapKind={mapKind}
          theme={theme}
          onAvatarChange={setAvatarUrl}
        />
      </Card>

      <Card className={settingsCardCls}>
        <h2 className={cardTitleCls}>{t('settings.professionalTitle')}</h2>
        <p className={cardTextCls}>
          {t('settings.professionalDesc')}
        </p>
        <div className="space-y-4 max-w-xl">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
              {t('settings.education')}
            </label>
            <input
              type="text"
              className={inp}
              value={profEducation}
              onChange={(e) => setProfEducation(e.target.value)}
              placeholder={t('settings.educationPh')}
              maxLength={500}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
              {t('settings.experience')}
            </label>
            <input
              type="number"
              min={0}
              max={60}
              className={inp}
              value={profExperienceYears}
              onChange={(e) => setProfExperienceYears(e.target.value)}
              placeholder={t('settings.experiencePh')}
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
              {t('settings.bio')}
            </label>
            <textarea
              className={`${inp} resize-y min-h-[6rem]`}
              value={profBio}
              onChange={(e) => setProfBio(e.target.value.slice(0, 300))}
              placeholder={t('settings.bioPh')}
              maxLength={300}
              rows={4}
            />
            <p className="text-[11px] text-gray-500 mt-1 text-right">{profBio.length}/300</p>
          </div>
          <Button
            type="button"
            loading={savingProfessional}
            onClick={() => void saveProfessionalDetails()}
            className="w-full sm:w-auto justify-center"
          >
            {t('settings.saveProfessional')}
          </Button>
        </div>
      </Card>

      <Card className={settingsCardCls}>
        <h2 className={cardTitleCls}>{t('settings.displayNameTitle')}</h2>
        <p className={cardTextCls}>
          {t('settings.displayNameDesc')}
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
            {t('settings.teacher')}
          </label>
          <label className={['flex items-center gap-2 cursor-pointer text-sm', theme === 'dark' ? 'text-gray-200' : 'text-token-textMain'].join(' ')}>
            <input
              type="radio"
              name="public_label"
              checked={publicLabel === 'trainer'}
              onChange={() => setPublicLabel('trainer')}
              className="accent-indigo-500"
            />
            {t('settings.trainer')}
          </label>
        </div>
        <Button type="button" loading={savingLabel} onClick={() => void saveLabel()} className="w-full sm:w-auto justify-center">
          {t('settings.save')}
        </Button>
      </Card>

      <Card className={settingsCardCls}>
        <h2 className={cardTitleCls}>{t('settings.mapTitle')}</h2>
        <p className={cardTextCls}>
          {t('settings.mapDesc')}
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
            <span className="font-semibold text-white block">{t('settings.mapVisibleTitle')}</span>
            <span className="text-xs text-token-textMuted">
              {mapVisible ? t('settings.mapVisibleOn') : t('settings.mapVisibleOff')}
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
              {locationLoading ? t('settings.locating') : `📍 ${locationLabel || t('settings.locationSelected')}`}
            </p>
            {mapVisible ? (
              <p className="text-xs text-emerald-400/90">{t('settings.pinOk')}</p>
            ) : (
              <p className="text-xs text-amber-400/90">{t('settings.pinHidden')}</p>
            )}
            <p className="text-xs text-token-textMuted">
              {t('settings.searchRadius', { km: mapRadiusKm })}
            </p>
            {mapDirty ? (
              <p className="text-xs text-amber-300 font-medium pt-1">{t('settings.unsaved')}</p>
            ) : mapJustSaved ? (
              <p className="text-xs text-emerald-400 font-medium pt-1">{t('settings.savedOk')}</p>
            ) : null}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 px-4 py-3 text-xs text-token-textMuted">
            {t('settings.noPin')}
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
          <span className="text-xs text-token-textMuted">{t('settings.pinType')}</span>
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
            {t('settings.pinTeacher')}
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
            {t('settings.pinTrainer')}
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 flex-wrap items-center">
          <Button type="button" variant="secondary" onClick={() => fillMapFromGeolocation()} className="justify-center">
            {t('settings.fillFromLocation')}
          </Button>
          <label className="text-xs text-token-textMuted flex items-center gap-1.5">
            {t('settings.visibilityRadius')}
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
            {mapDirty ? t('settings.saveChanges') : t('settings.saveMap')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!hasMapPin}
            onClick={() => setMapPreviewOpen(true)}
            className="flex-1 justify-center"
          >
            {t('settings.previewSearch')}
          </Button>
        </div>

        {mapJustSaved && mapVisible && hasMapPin ? (
          <Link to="/search" className="block text-center text-sm font-semibold text-primary hover:underline py-1">
            {t('settings.viewLiveMap')}
          </Link>
        ) : null}
      </Card>

      <InstructorMapPreviewModal
        open={mapPreviewOpen}
        onClose={() => setMapPreviewOpen(false)}
        fullName={user?.full_name}
        avatarUrl={avatarUrl}
        subject={primarySubjectName}
        mapKind={mapKind}
        latitude={mapLat}
        longitude={mapLng}
        locationLabel={locationLabel}
        mapVisible={mapVisible}
        radiusKm={mapRadiusKm}
      />

      <InstructorDiscoverSettings mapVisible={mapVisible} theme={theme} inp={inp} />

      <Modal
        open={Boolean(limitChoice?.open)}
        onClose={() => setLimitChoice(null)}
        title={t('settings.limitModalTitle', { plan: currentPlanTitle })}
        size="md"
      >
        {limitChoice?.open ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400 leading-relaxed">
              {currentPlanId === 'basic'
                ? t('settings.limitModalBasic', { plans: basicHigherPlansHint })
                : t('settings.limitModalPaid', { plan: currentPlanTitle })}
            </p>
            {localizedSmsDetail ? (
              <p className="text-xs text-gray-500 rounded-lg bg-white/5 px-3 py-2">{localizedSmsDetail}</p>
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
                  {t('settings.buyExtraSms')}
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
                {t('settings.manageStorage')}
              </Button>
              {!billing?.is_highest_tier ? (
                currentPlanId === 'basic' ? (
                  <Button
                    variant="primary"
                    className="w-full justify-center"
                    disabled={planBusy}
                    onClick={() => {
                      setLimitChoice(null)
                      openPlanCheckout(basicUpgradePlanId)
                    }}
                  >
                    {basicSwitchLabel}
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    className="w-full justify-center"
                    disabled={planBusy}
                    onClick={() => {
                      setLimitChoice(null)
                      openPlanCheckout(currentPlanId)
                    }}
                  >
                    {t('settings.renewPlan')}
                  </Button>
                )
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>

      <StorageAddonModal
        open={storageAddonOpen}
        onClose={() => setStorageAddonOpen(false)}
        packs={storagePacks}
        billing={billing}
        busy={planBusy}
        onSelectPack={(pack) => {
          setStorageAddonOpen(false)
          openStorageCheckout(pack)
        }}
      />

      <PaymentMethodModal
        open={Boolean(checkout)}
        onClose={() => setCheckout(null)}
        title={
          checkout?.type === 'sms'
            ? t('settings.checkoutSms')
            : checkout?.type === 'storage'
              ? t('settings.checkoutStorage')
              : t('settings.checkoutPlan')
        }
        subtitle={checkout?.title ? t('settings.checkoutChoice', { title: checkout.title }) : undefined}
        amountAzn={checkout?.amountAzn}
        manualAccount={manualAccount}
        payriffEnabled={payriffEnabled}
        product={checkout?.type === 'sms' ? 'sms' : checkout?.type === 'storage' ? 'storage' : 'plan'}
        busy={planBusy}
        onConfirm={confirmCheckout}
      />

    </div>
  )
}

