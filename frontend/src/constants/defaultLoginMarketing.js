/** Mirrors backend/src/constants/defaultLoginMarketing.js defaults for offline / API-fail fallback */

export const ACCENT_OPTIONS = [
  'from-sky-500/15',
  'from-emerald-500/15',
  'from-amber-500/15',
  'from-purple-500/15',
  'from-rose-500/15',
  'from-cyan-500/15',
]

export function defaultLoginMarketingPayload() {
  return {
    version: 1,
    hero: {
      pill: 'Təhsil ekosistemi — Mentorix',
      headline: 'Müəllim, tələbə və valideyn — bir təhsil platformasında',
      subheadline:
        'Tapşırıq və imtahan, çat, ödəniş izləmə, valideyn bildirişləri və müəllim axtarışı — hamısı bir yerdə.',
      primary_cta_label: 'Pulsuz başla (14 günlük sınaq)',
      marketplace_cta_label: 'Müəllim / Təlimçi tap (Xəritə ilə)',
      secondary_how: 'Necə işləyir?',
      secondary_demo: 'Demo bax',
      existing_account: 'Artıq hesabım var — girişə keç',
    },
    mini_preview: {
      section_enabled: true,
      title: 'İdarə paneli (prevyu)',
      badge: 'bu gün',
      col1_label: 'Platformada tələbə',
      col1_value: '24',
      col2_label: 'Bu ay',
      col2_value: 'Ödənişlər',
      col3_label: 'SMS',
      col3_value: 'Aktiv',
      calendar_title: 'Bu həftə — dərs qrafiki',
      calendar_days: ['Pn', 'Ç', 'Çr', 'Ca', 'Cm'],
      slot1_time: '18:30',
      slot2_time: '19:45',
    },
    trust: {
      section_enabled: false,
      heading: 'İnam göstəriciləri',
      students_suffix: 'tələbə idarə olunur',
      instructors_suffix: 'müəllim istifadə edir',
      attendance_footnote: 'Son ay vs əvvəlki ay — qeydə alınmış dərslər üzrə',
    },
    why: {
      section_enabled: true,
      heading: 'Niyə Mentorix?',
      cards: [
        {
          card_enabled: true,
          title: 'Excel-dən daha sürətli',
          body: 'Səhifə səhifə cədvəl əvəzinə hazır axın: dərs, ödəniş və mesajlar eyni paneldə.',
        },
        {
          card_enabled: true,
          title: 'WhatsApp-dan daha sistemli',
          body: 'Çat qalmaqılmaz “xatırlatma dənizi” yox: qaydalar, tarixlər və statuslar təkrarlanan sualları azaldır.',
        },
        {
          card_enabled: true,
          title: 'Manual işləri avtomatlaşdırır',
          body: 'Paket bitməsi, ödəniş təsdiqi və SMS xatırlatmaları üçün təkrarlanan əməliyyatlar avtomatlaşır.',
        },
      ],
    },
    top_teachers: {
      section_enabled: true,
      heading: 'Top müəllimlər',
      preview_before: 'Hal-hazırda ilk müəllimlər qoşulur.',
      preview_emphasis: 'Sən də ilk istifadəçilərdən biri ol.',
      preview_after:
        'Aşağıdakı kartlar interfeys prevyusudur (real sıralama gəldikdə avtomatik əvəzlənəcək).',
      description_real: 'Platformada daha çox aktiv şagirdi olan heyət (canlı statistikadan).',
      rating_fallback: 'Reytinq: dərs qeydləri üzrə',
      pupil_suffix: 'şagird',
    },
    steps: {
      section_enabled: true,
      heading: 'Necə işləyir?',
      items: [
        {
          item_enabled: true,
          step: '1',
          title: 'Qoşul və qrafiki qur',
          body: 'Google ilə başla, şagirdləri və həftəlik dərs slotlarını bir neçə dəqiqəyə əlavə et.',
        },
        {
          item_enabled: true,
          step: '2',
          title: 'Ödəniş və davamiyyəti izlə',
          body:
            'Ödənişləri və dəftər qeydlərini unudun. Kimin nə vaxt ödədiyini tək ekranda görün.',
        },
        {
          item_enabled: true,
          step: '3',
          title: 'Avtomatik xatırlat',
          body: 'Paket sonu və vacib hadisələr üçün SMS ilə valideyn/tələbəni xəbərdar et, əlavə manual izləmə azalsın.',
        },
        {
          item_enabled: true,
          step: '4',
          title: 'Yeni Tələbələr Qazan',
          body:
            'Profilinizi aktiv edin — valideynlər və tələbələr onlara ən yaxın formatda (onlayn və ya canlı) sizi birbaşa xəritədə tapsınlar.',
        },
      ],
    },
    features: {
      section_enabled: true,
      heading: 'Mentorix.io ilə',
      items: [
        {
          item_enabled: true,
          title: 'Tapşırıq idarəetməsi',
          body: 'Ev işi təyini, onlayn təslim və müəllim rəyi — tələbə və valideyn kabinetində görünür.',
          accent: 'from-sky-500/15',
        },
        {
          item_enabled: true,
          title: 'İmtahan və analiz',
          body: 'QR/link ilə imtahan paylaşın; nəticələri avtomatik qiymətləndirin və diaqramlarla izləyin.',
          accent: 'from-emerald-500/15',
        },
        {
          item_enabled: true,
          title: 'Çat və ünsiyyət',
          body: 'Qrup və fərdi çat — müəllim, tələbə və valideyn arasında sürətli ünsiyyət.',
          accent: 'from-cyan-500/15',
        },
        {
          item_enabled: true,
          title: 'Ödəniş və valideyn bildirişləri',
          body: 'Ödəniş tarixlərini idarə edin; avtomatik SMS xatırlatmaları və valideynlə nəticə paylaşımı.',
          accent: 'from-amber-500/15',
        },
        {
          item_enabled: true,
          title: 'Müəllim marketplace',
          body: 'Profilinizi xəritədə paylaşın — tələbələr və valideynlər uyğun müəllimi tapsın.',
          accent: 'from-purple-500/15',
        },
      ],
    },
    use_case: {
      section_enabled: true,
      heading: 'Real ssenari',
      title_line: 'Fərdi hazırlıq müəllimi — həftədə 25 şagird',
      bullets: [
        {
          lead: 'Səhər 5 dəqiqə:',
          rest: 'bu günün dərsləri, gecikən ödənişlər və “paket az qaldı” SMS-ləri gözləyir.',
        },
        {
          lead: 'Dərslər bitəndə:',
          rest: 'davamiyyəti işarələyib növbəti həftə üçün valideynlərə xəbərdarlıq göndərməyə görə daha az WhatsApp qarışığı.',
        },
        {
          lead: 'Ay sonu:',
          rest: 'hansı şagirdin ödənişinin statusunun dəyişdiyini tarix izi ilə sübut etmək rahatdır.',
        },
      ],
      faq_link: 'FAQ-ya keç →',
    },
    faq: {
      section_enabled: true,
      heading: 'FAQ',
      items: [
        {
          item_enabled: true,
          q: 'Mentorix məktəb üçün də uyğundur?',
          a: 'Əsasən fərdi və kiçik qruplarla işləyən müəllimlər üçündür: təqvim, ödəniş izi və davamiyyət bir yerdə toplanır. Böyük strukturlar üçün “əlaqə” ilə konkret ssenariyə uyğunlaşdıra bilərik.',
        },
        {
          item_enabled: true,
          q: 'Mobiltelefonda rahatdırmı?',
          a: 'Əksər müəllimlər telefondan işləyir: qısa süzmə ilə dərslərə baxıb qeydləri təsdiqləyib SMS xatırlatmasını aktiv saxlayırlar.',
        },
        {
          item_enabled: true,
          q: 'Ödənişlər və mövsümi paketlər necə?',
          a: 'Paket əsaslı və ya aylıq qeydə alınan modellərlə tarix və status izləmə — “kim, nə zaman, ödənildi / gözləmədə” qarışığı azaldır.',
        },
      ],
    },
    cta_band: {
      section_enabled: true,
      heading: 'Təhsil bir ekosistem kimi işləsin.',
      subtitle:
        'Müəllim idarə etsin, tələbə öyrənsin, valideyn izləsin — əvvəl dəyəri gör, sonra 14 günlük sınaqla başla.',
    },
    marketplace: {
      section_enabled: true,
    },
    universities: {
      section_enabled: true,
    },
    pricing: {
      section_enabled: true,
      audience_explainer_enabled: true,
    },
  }
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}
