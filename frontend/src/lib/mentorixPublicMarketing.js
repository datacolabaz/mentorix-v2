/** İctimai SEO və landing səhifələri üçün rəsmi marketinq mətni */

export const MENTORIX_TAGLINE =
  'Mentorix.io müəllimlər, təlimçilər və kurslar üçün hazırlanmış təhsil idarəetmə platformasıdır.'

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
    title: 'Tələbə analizləri',
    text: 'Diaqramlar və statistik göstəricilər ilə nəticələri izləyin; zəif mövzuları analiz edin.',
  },
  {
    title: 'Avtomatik ödəniş bildirişləri',
    text: 'Ödəniş tarixlərini idarə edin — gecikmə və yaxınlaşan ödənişlər üçün SMS xatırlatmaları.',
  },
  {
    title: 'Müəllim və təlimçilər',
    text: 'Fərdi müəllim, repetitor və kurs profilləri — ictimai xəritədə axtarışa açıq.',
  },
  {
    title: 'İmtahan və davamiyyət',
    text: 'QR/link ilə imtahan paylaşımı, avtomatik qiymətləndirmə, dərs cədvəli və iştirak izləməsi.',
  },
]
