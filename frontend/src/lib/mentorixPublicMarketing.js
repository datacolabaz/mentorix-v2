/** İctimai SEO və landing səhifələri üçün rəsmi marketinq mətni */

export const MENTORIX_SEO_TITLE = 'Mentorix — Müəllim və Kurs İdarəetmə Platforması'

export const MENTORIX_SEO_DESCRIPTION =
  'Mentorix müəllimlər, kurslar və təlim mərkəzləri üçün tələbə idarəetməsi, dərs cədvəli, davamiyyət, ödəniş izləmə, SMS bildirişləri, imtahan və tapşırıq sistemi, analitika və müəllim axtarışı platformasıdır.'

export const MENTORIX_SEO_KEYWORDS =
  'təhsil idarəetmə platforması, müəllim və kurs idarəetməsi, tələbə idarəetmə sistemi, kurs idarəetmə proqramı, dərs cədvəli, davamiyyət sistemi, ödəniş izləmə, SMS bildirişləri, imtahan platforması, tapşırıq sistemi, müəllim axtarışı, təlim mərkəzi proqramı, Mentorix'

/** Ana səhifədə təbii formada — Google açar sözləri */
export const MENTORIX_SEO_HOMEPAGE_LINE =
  'Mentorix müəllimlər, kurslar və təlim mərkəzləri üçün tələbə idarəetməsi, imtahan və tapşırıq sistemi, ödəniş izləmə, SMS bildirişləri və müəllim axtarışını birləşdirən rəqəmsal tədris platformasıdır.'

export const MENTORIX_TAGLINE = MENTORIX_SEO_HOMEPAGE_LINE

export const MENTORIX_CONTACT = {
  whatsappUrl: 'https://wa.me/994503066626',
  phoneDisplay: '+994 50 306 66 26',
  email: 'support@mentorix.io',
}

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
    text: 'Tələbə və qrupları bir paneldə idarə edin — CRM səviyyəsində müəllim kabineti.',
  },
  {
    title: 'İmtahan və tapşırıqlar',
    text: 'Onlayn imtahan və tapşırıq sistemi: QR kod və ya linklə paylaşın, nəticələri izləyin.',
  },
  {
    title: 'AI yoxlama və analitika',
    text: 'Avtomatik qiymətləndirmə, nəticə analizi, diaqramlar və zəif mövzuların izlənməsi.',
  },
  {
    title: 'Ödəniş və SMS',
    text: 'Ödəniş izləmə, avtomatik SMS xatırlatmaları və valideynlə nəticə paylaşımı.',
  },
  {
    title: 'Müəllim marketplace',
    text: 'Müəllim və təlimçi profilləri ictimai xəritədə — tələbələr üçün axtarış platforması.',
  },
]
