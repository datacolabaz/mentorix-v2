import { useMemo } from 'react'
import { ACCENT_OPTIONS } from '../constants/defaultLoginMarketing'
import {
  landingPlanFeatureLines,
  landingPlanPriceLabel,
  normalizePlanId,
} from './subscriptionPlanMarketing'

function arrayFromT(t, key) {
  const v = t(key, { returnObjects: true })
  return Array.isArray(v) ? v : []
}

function translateOptional(t, key) {
  const value = t(key, { defaultValue: '' })
  if (!value || value === key) return null
  return value
}

/** Homepage copy comes from translation.json (AZ / RU / EN). CMS only toggles section visibility. */
export function useLandingHero(marketing, t, i18n) {
  return useMemo(
    () => ({
      pill: t('landing.hero.pill'),
      headline: t('landing.hero.title'),
      subheadline: t('landing.hero.subtitle'),
      primary_cta_label: t('landing.hero.startFree'),
      secondary_how: t('landing.hero.howItWorks'),
      secondary_demo: t('landing.hero.demo'),
      existing_account: t('landing.hero.haveAccount'),
      marketplace_cta_label: t('landing.hero.marketplaceCta'),
    }),
    [t, i18n.language],
  )
}

export function useLandingWhy(marketing, t, i18n) {
  return useMemo(
    () => ({
      heading: t('landing.why.heading'),
      cards: arrayFromT(t, 'landing.why.cards').map((c) => ({ ...c, card_enabled: true })),
    }),
    [t, i18n.language],
  )
}

export function useLandingSteps(marketing, t, i18n) {
  return useMemo(
    () => ({
      heading: t('landing.steps.heading'),
      items: arrayFromT(t, 'landing.steps.items').map((x, i) => ({
        ...x,
        step: x.step || String(i + 1).padStart(2, '0'),
        item_enabled: true,
      })),
    }),
    [t, i18n.language],
  )
}

export function useLandingFeatures(marketing, t, i18n) {
  return useMemo(
    () => ({
      heading: t('landing.features.heading'),
      items: arrayFromT(t, 'landing.features.items').map((item, i) => ({
        ...item,
        item_enabled: true,
        accent: item.accent || ACCENT_OPTIONS[i % ACCENT_OPTIONS.length],
      })),
    }),
    [t, i18n.language],
  )
}

export function useLandingFaq(marketing, t, i18n) {
  return useMemo(
    () => ({
      heading: t('landing.faq.heading'),
      items: arrayFromT(t, 'landing.faq.items').map((x) => ({ ...x, item_enabled: true })),
    }),
    [t, i18n.language],
  )
}

export function useLandingCtaBand(marketing, t, i18n) {
  return useMemo(
    () => ({
      ...marketing?.cta_band,
      section_enabled: marketing?.cta_band?.section_enabled !== false,
      heading: t('landing.ctaBand.heading'),
      subtitle: t('landing.ctaBand.subtitle'),
    }),
    [marketing?.cta_band, t, i18n.language],
  )
}

export function useLandingPlanDisplay(p, t, i18n) {
  return useMemo(() => {
    const id = normalizePlanId(p)
    const prefix = `landing.plans.${id}`
    const trialLines = id === 'basic' ? arrayFromT(t, `${prefix}.trialLines`) : []
    const bullets = trialLines.length ? trialLines : arrayFromT(t, `${prefix}.bullets`)
    const v = Number(p?.price_azn)
    const priceLabel =
      !Number.isFinite(v) || v <= 0
        ? t('landing.plans.free')
        : t('landing.plans.pricePerMonth', { price: v })
    const subtitle = translateOptional(t, `${prefix}.subtitle`)
    return {
      title: t(`${prefix}.title`),
      meta: {
        subtitle: subtitle || null,
        popularLabel: null,
        cta: t(`${prefix}.cta`),
      },
      bullets: bullets.length ? bullets : landingPlanFeatureLines(p),
      priceLabel: priceLabel || landingPlanPriceLabel(p),
    }
  }, [p, t, i18n.language])
}
