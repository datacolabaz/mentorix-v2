import { useMemo } from 'react'

/** AZ: admin/API marketing; RU: translation.json landing.hero */
export function useLandingHero(marketing, t, i18n) {
  const isRu = String(i18n.language || 'az').toLowerCase().startsWith('ru')
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
