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
      pill: 'Mentorix — müəllimlər və təlimçilər üçün idarəetmə',
      headline: 'Şagirdlərini daha effektiv idarə et',
      subheadline: 'Dərs planlama, ödəniş izləmə və avtomatik xatırlatmalar — hamısı bir platformada',
      primary_cta_label: 'Pulsuz başla — ilk 5 tələbə əlavə et',
      secondary_how: 'Necə işləyir?',
      secondary_demo: 'Demo bax',
      existing_account: 'Artıq hesabım var — girişə keç',
    },
    mini_preview: {
      title: 'İdarə paneli (prevyu)',
      badge: 'bu gün',
      col1_label: 'Tələbələr',
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
      heading: 'İnam göstəriciləri',
      students_suffix: 'tələbə idarə olunur',
      instructors_suffix: 'müəllim istifadə edir',
      attendance_footnote: 'Son ay vs əvvəlki ay — qeydə alınmış dərslər üzrə',
    },
    why: {
      heading: 'Niyə Mentorix?',
      cards: [
        {
          title: 'Excel-dən daha sürətli',
          body: 'Səhifə səhifə cədvəl əvəzinə hazır axın: dərs, ödəniş və mesajlar eyni paneldə.',
        },
        {
          title: 'WhatsApp-dan daha sistemli',
          body: 'Çat qalmaqılmaz “xatırlatma dənizi” yox: qaydalar, tarixlər və statuslar təkrarlanan sualları azaldır.',
        },
        {
          title: 'Manual işləri avtomatlaşdırır',
          body: 'Paket bitməsi, ödəniş təsdiqi və SMS xatırlatmaları üçün təkrarlanan əməliyyatlar avtomatlaşır.',
        },
      ],
    },
    top_teachers: {
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
      heading: 'Necə işləyir?',
      items: [
        {
          step: '1',
          title: 'Qoşul və qrafiki qur',
          body: 'Google ilə başla, şagirdləri və həftəlik dərs slotlarını bir neçə dəqiqəyə əlavə et.',
        },
        {
          step: '2',
          title: 'Ödəniş və davamiyyəti izlə',
          body:
            'Paket/aylıq ödəniş statuslarını və dərs qeydlərini eyni axında saxla — “kim nə vaxt ödədi?” aydın olsun.',
        },
        {
          step: '3',
          title: 'Avtomatik xatırlat',
          body: 'Paket sonu və vacib hadisələr üçün SMS ilə valideyn/tələbəni xəbərdar et, əlavə manual izləmə azalsın.',
        },
      ],
    },
    features: {
      heading: 'İmkanlar',
      items: [
        {
          title: 'Dərs cədvəli',
          body: 'Həftəlik planı bir ekrandan idarə edin və dərsi təqib edin.',
          accent: 'from-sky-500/15',
        },
        {
          title: 'Ödəniş sistemi',
          body: 'Paket və aylıq ödəniş axınlarını strukturlaşdırın, gecikmələri əvvəlcədən görün.',
          accent: 'from-emerald-500/15',
        },
        {
          title: 'SMS xatırlatma',
          body: 'Valideyn/tələbə üçün avtomatik xəbərdarlıq — əlavə yükləmə olmadan.',
          accent: 'from-amber-500/15',
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
      heading: 'FAQ',
      items: [
        {
          q: 'Mentorix məktəb üçün də uyğundur?',
          a: 'Əsasən fərdi və kiçik qruplarla işləyən müəllimlər üçündür: təqvim, ödəniş izi və davamiyyət bir yerdə toplanır. Böyük strukturlar üçün “əlaqə” ilə konkret ssenariyə uyğunlaşdıra bilərik.',
        },
        {
          q: 'Mobiltelefonda rahatdırmı?',
          a: 'Əksər müəllimlər telefondan işləyir: qısa süzmə ilə dərslərə baxıb qeydləri təsdiqləyib SMS xatırlatmasını aktiv saxlayırlar.',
        },
        {
          q: 'Ödənişlər və mövsümi paketlər necə?',
          a: 'Paket əsaslı və ya aylıq qeydə alınan modellərlə tarix və status izləmə — “kim, nə zaman, ödənildi / gözləmədə” qarışığı azaldır.',
        },
      ],
    },
    cta_band: {
      heading: 'Xaos yox. Nəzarət var.',
      subtitle: 'Əvvəl dəyəri gör, sonra ilk 5 şagirdi əlavə edib qurulumu rahat keç.',
    },
  }
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}
