/** İctimai SEO və landing səhifələri üçün rəsmi marketinq mətni */

export const MENTORIX_SEO_TITLE =
  'Mentorix.io – Müəllimlər üçün Tələbə İdarəetməsi, İmtahan və Analitika Platforması'

export const MENTORIX_SEO_DESCRIPTION =
  'Mentorix.io müəllim və təlimçilər üçün tələbə idarəetməsi, imtahan və tapşırıqların hazırlanması, nəticələrin analizi, ödəniş xatırlatmaları və repetitor axtarışı imkanları təqdim edən platformadır.'

export const MENTORIX_SEO_KEYWORDS =
  'müəllim paneli, tələbə idarəetmə sistemi, kurs idarəetmə proqramı, repetitor proqramı, davamiyyət sistemi, imtahan platforması, onlayn test sistemi, ödəniş izləmə proqramı, kurs proqramı, hazırlıq kursu proqramı, Mentorix'

/** Ana səhifədə təbii formada — Google açar sözləri */
export const MENTORIX_SEO_HOMEPAGE_LINE =
  'Mentorix.io müəllimlər, repetitorlar, hazırlıq mərkəzləri və kurslar üçün tələbə idarəetmə sistemi, imtahan platforması və ödəniş izləmə proqramıdır.'

export const MENTORIX_TAGLINE = MENTORIX_SEO_HOMEPAGE_LINE

export const MENTORIX_PRICING_PLANS = [
  {
    id: 'basic',
    title: 'SADƏ',
    priceLabel: 'Pulsuz',
    highlight: false,
    items: ['5 tələbə limiti', '5 SMS / ay', '14 günlük tam sınaq imkanı'],
    mapNote: null,
  },
  {
    id: 'pro',
    title: 'PRO',
    priceLabel: '10 AZN / ay',
    highlight: true,
    items: ['50 tələbə limiti', '50 SMS / ay'],
    mapNote: 'Xəritədə görünmə imkanı',
  },
  {
    id: 'growth',
    title: 'GROWTH',
    priceLabel: '20 AZN / ay',
    highlight: false,
    items: ['100 tələbə limiti', '100 SMS / ay'],
    mapNote: 'Axtarış nəticələrində önə çıxma',
  },
  {
    id: 'premium',
    title: 'PREMIUM',
    priceLabel: '30 AZN / ay',
    highlight: false,
    items: ['Limitsiz tələbə', '200 SMS / ay (əlavə balans imkanı)'],
    mapNote: 'Xəritədə TOP görünmə',
  },
]

export const MENTORIX_ANNUAL_DISCOUNT = 'İllik abunəlikdə əlavə 20% qənaət imkanı mövcuddur.'

export const MENTORIX_PLATFORM_BENEFITS = [
  'Tələbələrinizi və qruplarınızı rahat idarə edin',
  'İmtahan və tapşırıqlar hazırlayın, QR kod və ya linklə paylaşın',
  'İmtahan nəticələrini avtomatik qiymətləndirin və analiz edin',
  'Tələbələrin nəticələrini diaqramlar və statistik göstəricilər ilə izləyin',
  'Hansı mövzularda zəiflik olduğunu analiz edin',
  'Dərs saatlarını və tələbə iştirakını izləyin',
  'Ödəniş tarixlərini idarə edin və avtomatik xatırlatmalar göndərin',
  'Valideynlərlə tələbənin nəticələrini paylaşın',
  'Tələbələrə ödəniş və imtahan nəticələri barədə SMS bildirişləri göndərin',
]

/** Qısa SEO blokları (kartlar) */
export const MENTORIX_PLATFORM_FEATURES = [
  {
    title: 'Tələbə idarəetməsi',
    text: 'Tələbə və qrupları bir paneldə idarə edin — müəllim paneli və davamiyyət sistemi.',
  },
  {
    title: 'İmtahan və tapşırıqlar',
    text: 'Onlayn test sistemi: imtahan və tapşırıqları QR kod və ya linklə paylaşın.',
  },
  {
    title: 'AI yoxlama və analitika',
    text: 'Avtomatik qiymətləndirmə, nəticə analizi, diaqramlar və zəif mövzuların izlənməsi.',
  },
  {
    title: 'Ödəniş xatırlatmaları',
    text: 'Ödəniş izləmə proqramı — avtomatik SMS xatırlatmaları və valideynlə nəticə paylaşımı.',
  },
  {
    title: 'Repetitor axtarışı',
    text: 'Müəllim və təlimçi profilləri ictimai xəritədə — repetitor proqramı və kurs proqramı.',
  },
]
