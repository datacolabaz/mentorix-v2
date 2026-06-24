/** İctimai SEO və landing səhifələri üçün rəsmi marketinq mətni */

import { defaultPlatformContact } from './platformContact'

export const MENTORIX_SEO_TITLE = 'Mentorix — Təhsil Ekosistemi: Müəllim, Tələbə və Valideyn'

export const MENTORIX_SEO_DESCRIPTION =
  'Mentorix müəllim, tələbə və valideynləri birləşdirən təhsil platformasıdır: tapşırıq və imtahan, çat, ödəniş izləmə, valideyn bildirişləri və müəllim marketplace — hamısı bir yerdə.'

export const MENTORIX_SEO_KEYWORDS =
  'təhsil platforması, təhsil ekosistemi, müəllim paneli, tələbə kabineti, valideyn kabineti, imtahan sistemi, tapşırıq idarəetməsi, müəllim axtarışı, ödəniş izləmə, SMS bildirişləri, tədris qrupları, Mentorix'

/** Ana səhifədə təbii formada — Google açar sözləri */
export const MENTORIX_SEO_HOMEPAGE_LINE =
  'Fərdi müəllimlər və təhsil xidməti təminatçıları üçün güclü alətlər; tələbə və valideynlər isə pulsuz kabinet və marketplace-dən istifadə edir.'

export const MENTORIX_TAGLINE = MENTORIX_SEO_HOMEPAGE_LINE

const _contact = defaultPlatformContact()

export const MENTORIX_CONTACT = {
  ..._contact,
  whatsappUrl: _contact.whatsapp_url,
  phoneDisplay: _contact.phone_display,
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
    title: 'STANDART',
    priceLabel: '5 AZN / ay',
    highlight: true,
    items: ['50 tələbə limiti', '50 SMS / ay'],
    mapNote: 'Xəritədə görünmə imkanı',
  },
  {
    id: 'growth',
    title: 'PROFESSİONAL',
    priceLabel: '10 AZN / ay',
    highlight: false,
    items: ['100 tələbə limiti', '100 SMS / ay'],
    mapNote: 'Axtarış nəticələrində önə çıxma',
  },
  {
    id: 'premium',
    title: 'PREMİUM',
    priceLabel: '19 AZN / ay',
    highlight: false,
    items: ['Limitsiz tələbə', '200 SMS / ay (əlavə balans imkanı)'],
    mapNote: 'Xəritədə TOP görünmə',
  },
]

export const MENTORIX_ANNUAL_DISCOUNT = 'İllik abunəlikdə əlavə 20% qənaət imkanı mövcuddur.'

export const MENTORIX_PRICING_INTRO =
  'Paketlər müəllimlər və təhsil xidməti təminatçıları üçündür. 14 günlük pulsuz sınaq ilə başlayın; aylıq qiymətlər göstərilir, illik ödənişdə 20% endirim.'

export const MENTORIX_PRICING_AUDIENCE = {
  sectionTitle: 'Kimlər üçün?',
  freeTitle: 'Pulsuz',
  paidTitle: 'Ödənişli paketlər',
  freeItems: [
    'Tələbə kabineti (müəllim dəvəti ilə)',
    'Valideyn kabineti',
    'Müəllim axtarışı (marketplace)',
    'Dəvət ilə imtahan və tapşırıq',
  ],
  paidAudience: 'Müəllimlər və təhsil xidməti təminatçıları',
  paidHint: 'Aşağıdakı paketlər tələbə limiti, SMS, xəritədə görünmə və çat imkanlarını açır.',
  footnote:
    'Paketlər yalnız müəllim və təhsil xidməti təminatçıları üçündür. Tələbə və valideyn hesabları həmişə pulsuzdur.',
  faq: [
    {
      q: 'Kimlər pulsuz istifadə edir?',
      a: 'Tələbələr (müəllim dəvəti ilə), valideynlər (uşağın kabineti), marketplace-də müəllim axtarışı və dəvət linki ilə imtahan/tapşırıq iştirakı — hamısı pulsuzdur.',
    },
    {
      q: 'Kimlər paket almalıdır?',
      a: 'Fərdi müəllimlər və təhsil xidməti təminatçıları: tələbə idarəetməsi, imtahan/tapşırıq yaratmaq, ödəniş izləmə, SMS və marketplace profili üçün abunəlik paketi seçirlər.',
    },
    {
      q: 'Niyə ödənişli paket?',
      a: 'Daha çox tələbə limiti, SMS balansı, xəritədə görünmə, fərdi çat və prioritet dəstək kimi imkanlar paketdən asılıdır. Tələbə və valideyn tərəfi isə ödəniş tələb etmir.',
    },
  ],
}

export const MENTORIX_PLATFORM_BENEFITS = [
  'Tələbələrinizi və tədris qruplarınızı rahat idarə edin',
  'Tapşırıq və imtahan hazırlayın, QR kod və ya linklə paylaşın',
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
    title: 'Tapşırıq idarəetməsi',
    text: 'Ev işi təyini, onlayn təslim, müəllim rəyi və valideyn kabinetində nəticə görünüşü.',
  },
  {
    title: 'İmtahan sistemi',
    text: 'Onlayn testlər: QR kod və ya linklə paylaşın, avtomatik qiymətləndirmə və analitika.',
  },
  {
    title: 'Çat və ünsiyyət',
    text: 'Qrup və fərdi çat — müəllim, tələbə və valideyn arasında sürətli ünsiyyət.',
  },
  {
    title: 'Ödəniş və valideyn bildirişləri',
    text: 'Ödəniş izləmə, avtomatik SMS xatırlatmaları və valideynlə nəticə paylaşımı.',
  },
  {
    title: 'Müəllim marketplace',
    text: 'Müəllim və təlimçi profilləri ictimai xəritədə — tələbələr və valideynlər üçün axtarış.',
  },
]
