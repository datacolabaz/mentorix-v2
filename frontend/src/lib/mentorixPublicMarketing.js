import { AI_PLAN_LIMITS } from '../constants/aiPlanLimits'
import { defaultPlatformContact } from './platformContact'

export const MENTORIX_SEO_TITLE = 'mentorix.io — onlayn imtahan və qiymətləndirmə'

export const MENTORIX_SEO_DESCRIPTION =
  'Testlərinizi yaradın, imtahanları idarə edin və nəticələri bir platformadan izləyin. Müəllim, tələbə və valideyn — hamısı bir yerdə. Pulsuz başlayın.'

export const MENTORIX_SEO_KEYWORDS =
  'təhsil platforması, təhsil ekosistemi, müəllim paneli, tələbə kabineti, valideyn kabineti, imtahan sistemi, tapşırıq idarəetməsi, müəllim axtarışı, ödəniş izləmə, e-poçt bildirişləri, tədris qrupları, mentorix.io'

/** Ana səhifədə təbii formada — Google açar sözləri */
export const MENTORIX_SEO_HOMEPAGE_LINE =
  'mentorix.io müəllimləri, tələbələri və valideynləri bir platformada birləşdirərək təhsil prosesini daha rahat və effektiv idarə etməyə kömək edir.'

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
    title: '21 günlük pulsuz sınaq',
    priceLabel: '0 AZN / 21 gün',
    highlight: false,
    items: [
      '5 iştirakçı',
      '3 imtahan',
      '5 tapşırıq',
      `${AI_PLAN_LIMITS.basic.questions} AI sual`,
      `${AI_PLAN_LIMITS.basic.gradings} AI tapşırıq yoxlama`,
      '1 GB bulud yaddaşı',
      'Meet/Zoom linki ilə canlı dərs planlama',
      'Məhdud email bildirişləri',
    ],
    mapNote: null,
  },
  {
    id: 'growth',
    title: 'PROFESSIONAL',
    priceLabel: '10 AZN / ay',
    highlight: true,
    items: [
      '50 tələbə',
      '20 GB bulud yaddaşı',
      '50 imtahan / ay',
      '120 tapşırıq / ay',
      `${AI_PLAN_LIMITS.growth.questions} AI sual / ay`,
      `${AI_PLAN_LIMITS.growth.gradings} AI ilə yoxlanılan açıq-cavab işi / ay`,
      'Google Meet və Zoom linkləri ilə limitsiz canlı dərs planlama',
      'Valideyn e-poçt bildirişləri',
    ],
    mapNote: null,
  },
  {
    id: 'premium',
    title: 'PREMIUM',
    priceLabel: '19 AZN / ay',
    highlight: false,
    items: [
      'Limitsiz tələbə',
      '50 GB bulud yaddaşı',
      'Limitsiz imtahan',
      'Limitsiz tapşırıq',
      `${AI_PLAN_LIMITS.premium.questions} AI sual / ay`,
      `${AI_PLAN_LIMITS.premium.gradings} AI ilə yoxlanılan açıq-cavab işi / ay`,
      'Prioritet dəstək',
    ],
    mapNote: null,
  },
]

export const MENTORIX_ANNUAL_DISCOUNT = 'İllik abunəlikdə əlavə 20% qənaət imkanı mövcuddur.'

export const MENTORIX_PRICING_AUDIENCE = {
  sectionTitle: 'Kimlər üçün?',
  freeTitle: 'Pulsuz',
  freeItems: [
    'Tələbə kabineti (müəllim dəvəti ilə)',
    'Valideyn kabineti',
    'Müəllim axtarışı (marketplace)',
    'Dəvət ilə imtahan və tapşırıq',
  ],
  footnote:
    'Paketlər yalnız müəllim və təhsil xidməti təminatçıları üçündür. Tələbə və valideyn hesabları həmişə pulsuzdur.',
  faq: [
    {
      q: 'Kimlər pulsuz istifadə edir?',
      a: 'Tələbələr (müəllim dəvəti ilə), valideynlər (uşağın kabineti), marketplace-də müəllim axtarışı və dəvət linki ilə imtahan/tapşırıq iştirakı — hamısı pulsuzdur.',
    },
    {
      q: 'Kimlər paket almalıdır?',
      a: 'Fərdi müəllimlər və təhsil xidməti təminatçıları: tələbə idarəetməsi, imtahan/tapşırıq yaratmaq, ödəniş izləmə, valideyn e-poçt bildirişləri və marketplace profili üçün abunəlik paketi seçirlər.',
    },
    {
      q: 'Niyə ödənişli paket?',
      a: 'Daha çox tələbə limiti, bulud yaddaşı, xəritədə görünmə, fərdi çat və prioritet dəstək kimi imkanlar paketdən asılıdır. Tələbə və valideyn tərəfi isə ödəniş tələb etmir.',
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
  'Tələbələrə və valideynlərə ödəniş və imtahan nəticələri barədə e-poçt bildirişləri göndərin',
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
    text: 'Ödəniş izləmə, e-poçt xatırlatmaları və valideynlə nəticə paylaşımı.',
  },
  {
    title: 'Müəllim marketplace',
    text: 'Müəllim və təlimçi profilləri ictimai xəritədə — tələbələr və valideynlər üçün axtarış.',
  },
]
