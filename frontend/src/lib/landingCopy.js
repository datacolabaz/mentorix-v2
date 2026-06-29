import { useMemo } from 'react'
import { ACCENT_OPTIONS, defaultLoginMarketingPayload } from '../constants/defaultLoginMarketing'
import { visibleMarketingItems, visibleWhyCards } from './loginMarketingVisibility'
import {
  getPlanMarketingMeta,
  landingPlanFeatureLines,
  landingPlanPriceLabel,
  normalizePlanId,
} from './subscriptionPlanMarketing'

function isRuLang(i18n) {
  return String(i18n?.language || 'az').toLowerCase().startsWith('ru')
}

function arrayFromT(t, key) {
  const v = t(key, { returnObjects: true })
  return Array.isArray(v) ? v : []
}

/** AZ: admin/API marketing; RU: translation.json landing.hero */
export function useLandingHero(marketing, t, i18n) {
  const isRu = isRuLang(i18n)
  const apiHero = marketing?.hero || {}

  return useMemo(() => {
    if (isRu) {
      return {
        pill: t('landing.hero.pill'),
        headline: t('landing.hero.title'),
        subheadline: t('landing.hero.subtitle'),
        primary_cta_label: t('landing.hero.startFree'),
        secondary_how: t('landing.hero.howItWorks'),
        secondary_demo: t('landing.hero.demo'),
        existing_account: t('landing.hero.haveAccount'),
        marketplace_cta_label: t('landing.hero.marketplaceCta'),
      }
    }
    return {
      pill: apiHero.pill || t('landing.hero.pill'),
      headline: apiHero.headline || t('landing.hero.title'),
      subheadline: apiHero.subheadline || t('landing.hero.subtitle'),
      primary_cta_label: apiHero.primary_cta_label || t('landing.hero.startFree'),
      secondary_how: apiHero.secondary_how || t('landing.hero.howItWorks'),
      secondary_demo: apiHero.secondary_demo || t('landing.hero.demo'),
      existing_account: apiHero.existing_account || t('landing.hero.haveAccount'),
      marketplace_cta_label: apiHero.marketplace_cta_label || t('landing.hero.marketplaceCta'),
    }
  }, [isRu, apiHero, t])
}

export function useLandingWhy(marketing, t, i18n) {
  const isRu = isRuLang(i18n)
  return useMemo(() => {
    if (isRu) {
      return {
        heading: t('landing.why.heading'),
        cards: arrayFromT(t, 'landing.why.cards').map((c) => ({ ...c, card_enabled: true })),
      }
    }
    return {
      heading: marketing?.why?.heading || '',
      cards: visibleWhyCards(marketing?.why?.cards),
    }
  }, [isRu, marketing, t, i18n.language])
}

export function useLandingSteps(marketing, t, i18n) {
  const isRu = isRuLang(i18n)
  return useMemo(() => {
    if (isRu) {
      return {
        heading: t('landing.steps.heading'),
        items: arrayFromT(t, 'landing.steps.items').map((x, i) => ({
          ...x,
          step: x.step || String(i + 1),
          item_enabled: true,
        })),
      }
    }
    const items = Array.isArray(marketing.steps?.items) ? marketing.steps.items : []
    const def = defaultLoginMarketingPayload().steps.items || []
    const base = items.length ? items : def
    return {
      heading: marketing?.steps?.heading || '',
      items: visibleMarketingItems(base),
    }
  }, [isRu, marketing, t, i18n.language])
}

export function useLandingFeatures(marketing, t, i18n) {
  const isRu = isRuLang(i18n)
  return useMemo(() => {
    if (isRu) {
      return {
        heading: t('landing.features.heading'),
        items: arrayFromT(t, 'landing.features.items').map((item, i) => ({
          ...item,
          item_enabled: true,
          accent: item.accent || ACCENT_OPTIONS[i % ACCENT_OPTIONS.length],
        })),
      }
    }
    return {
      heading: marketing?.features?.heading || '',
      items: visibleMarketingItems(marketing?.features?.items || []),
    }
  }, [isRu, marketing, t, i18n.language])
}

export function useLandingFaq(marketing, t, i18n) {
  const isRu = isRuLang(i18n)
  return useMemo(() => {
    if (isRu) {
      return {
        heading: t('landing.faq.heading'),
        items: arrayFromT(t, 'landing.faq.items').map((x) => ({ ...x, item_enabled: true })),
      }
    }
    return {
      heading: marketing?.faq?.heading || '',
      items: visibleMarketingItems(marketing?.faq?.items || []),
    }
  }, [isRu, marketing, t, i18n.language])
}

export function useLandingUseCase(marketing, t, i18n) {
  const isRu = isRuLang(i18n)
  return useMemo(() => {
    if (isRu) {
      return {
        section_enabled: marketing?.use_case?.section_enabled !== false,
        heading: t('landing.useCase.heading'),
        title_line: t('landing.useCase.titleLine'),
        faq_link: t('landing.useCase.faqLink'),
        bullets: arrayFromT(t, 'landing.useCase.bullets'),
      }
    }
    return marketing?.use_case || {}
  }, [isRu, marketing, t, i18n.language])
}

export function useLandingCtaBand(marketing, t, i18n) {
  const isRu = isRuLang(i18n)
  return useMemo(() => {
    if (isRu) {
      return {
        ...marketing?.cta_band,
        section_enabled: marketing?.cta_band?.section_enabled !== false,
        heading: t('landing.ctaBand.heading'),
        subtitle: t('landing.ctaBand.subtitle'),
      }
    }
    return marketing?.cta_band || {}
  }, [isRu, marketing, t, i18n.language])
}

export function useLandingPlanDisplay(p, t, i18n) {
  return useMemo(() => {
    const id = normalizePlanId(p)
    if (!isRuLang(i18n)) {
      return {
        title: p.title,
        meta: getPlanMarketingMeta(p),
        bullets: landingPlanFeatureLines(p),
        priceLabel: landingPlanPriceLabel(p),
      }
    }
    const prefix = `landing.plans.${id}`
    const trialLines = id === 'basic' ? arrayFromT(t, `${prefix}.trialLines`) : []
    const bullets = trialLines.length ? trialLines : arrayFromT(t, `${prefix}.bullets`)
    const v = Number(p?.price_azn)
    const priceLabel =
      !Number.isFinite(v) || v <= 0
        ? t('landing.plans.free')
        : t('landing.plans.pricePerMonth', { price: v })
    const subtitle = t(`${prefix}.subtitle`, { defaultValue: '' })
    const popular = t(`${prefix}.popular`, { defaultValue: '' })
    return {
      title: t(`${prefix}.title`),
      meta: {
        subtitle: subtitle || null,
        popularLabel: popular || null,
        cta: t(`${prefix}.cta`),
      },
      bullets,
      priceLabel,
    }
  }, [p, t, i18n.language])
}
