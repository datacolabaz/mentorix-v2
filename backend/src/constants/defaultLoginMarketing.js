/** @typedef {{ title: string, body: string }} WhyItem */
/** @typedef {{ step: string, title: string, body: string }} StepItem */
/** @typedef {{ title: string, body: string, accent: string }} FeatureItem */
/** @typedef {{ q: string, a: string }} FaqItem */
/** @typedef {{ lead: string, rest: string }} UseCaseBullet */

const ACCENT_OPTIONS = new Set([
  'from-sky-500/15',
  'from-emerald-500/15',
  'from-amber-500/15',
  'from-purple-500/15',
  'from-rose-500/15',
  'from-cyan-500/15',
])

function defaultLoginMarketingPayload() {
  return {
    version: 1,
    hero: {
      pill: 'Mentorix.io — müəllimlər, təlimçilər və kurslar üçün',
      headline: 'Təhsil idarəetmə platforması — tələbə, imtahan, ödəniş bir yerdə',
      subheadline:
        'Tələbə analizləri, avtomatik ödəniş bildirişləri, imtahanlar və ictimai xəritə profili. SADƏ paket pulsuz — 14 günlük tam sınaq.',
      primary_cta_label: 'Pulsuz başla (14 günlük sınaq)',
      marketplace_cta_label: 'Müəllim / Təlimçi tap (Xəritə ilə)',
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
      section_enabled: true,
      heading: 'İnam göstəriciləri',
      students_suffix: 'tələbə idarə olunur',
      instructors_suffix: 'müəllim istifadə edir',
      attendance_footnote: 'Son ay vs əvvəlki ay — qeydə alınmış dərslər üzrə',
    },
    why: {
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
      heading: 'Top müəllimlər',
      preview_before:
        'Hal-hazırda ilk müəllimlər qoşulur.',
      preview_emphasis: 'Sən də ilk istifadəçilərdən biri ol.',
      preview_after:
        'Aşağıdakı kartlar interfeys prevyusudur (real sıralama gəldikdə avtomatik əvəzlənəcək).',
      description_real:
        'Platformada daha çox aktiv şagirdi olan heyət (canlı statistikadan).',
      rating_fallback: 'Reytinq: dərs qeydləri üzrə',
      pupil_suffix: 'şagird',
    },
    steps: {
      heading: 'Necə işləyir?',
      items: [
        {
          step: '1',
          title: 'Qoşul və qrafiki qur',
          body:
            'Google ilə başla, şagirdləri və həftəlik dərs slotlarını bir neçə dəqiqəyə əlavə et.',
        },
        {
          step: '2',
          title: 'Ödəniş və davamiyyəti izlə',
          body:
            'Ödənişləri və dəftər qeydlərini unudun. Kimin nə vaxt ödədiyini tək ekranda görün.',
        },
        {
          step: '3',
          title: 'Avtomatik xatırlat',
          body:
            'Paket sonu və vacib hadisələr üçün SMS ilə valideyn/tələbəni xəbərdar et, əlavə manual izləmə azalsın.',
        },
        {
          step: '4',
          title: 'Yeni Tələbələr Qazan',
          body:
            'Profilinizi aktiv edin — valideynlər və tələbələr onlara ən yaxın formatda (onlayn və ya canlı) sizi birbaşa xəritədə tapsınlar.',
        },
      ],
    },
    features: {
      heading: 'Mentorix.io ilə',
      items: [
        {
          title: 'Tələbə və qruplar',
          body: 'Tələbələrinizi və qruplarınızı rahat idarə edin — bir paneldə.',
          accent: 'from-sky-500/15',
        },
        {
          title: 'İmtahan və analiz',
          body: 'QR/link ilə imtahan paylaşın; nəticələri avtomatik qiymətləndirin və diaqramlarla izləyin.',
          accent: 'from-emerald-500/15',
        },
        {
          title: 'Ödəniş və SMS',
          body: 'Ödəniş tarixlərini idarə edin; avtomatik xatırlatmalar və imtahan nəticəsi SMS-ləri göndərin.',
          accent: 'from-amber-500/15',
        },
        {
          title: 'Valideyn əlaqəsi',
          body: 'Valideynlərlə tələbənin nəticələrini paylaşın; davamiyyət və zəif mövzuları bir yerdə görün.',
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
          rest:
            'bu günün dərsləri, gecikən ödənişlər və “paket az qaldı” SMS-ləri gözləyir.',
        },
        {
          lead: 'Dərslər bitəndə:',
          rest:
            'davamiyyəti işarələyib növbəti həftə üçün valideynlərə xəbərdarlıq göndərməyə görə daha az WhatsApp qarışığı.',
        },
        {
          lead: 'Ay sonu:',
          rest:
            'hansı şagirdin ödənişinin statusunun dəyişdiyini tarix izi ilə sübut etmək rahatdır.',
        },
      ],
      faq_link: 'FAQ-ya keç →',
    },
    faq: {
      heading: 'FAQ',
      items: [
        {
          q: 'Mentorix məktəb üçün də uyğundur?',
          a:
            'Əsasən fərdi və kiçik qruplarla işləyən müəllimlər üçündür: təqvim, ödəniş izi və davamiyyət bir yerdə toplanır. Böyük strukturlar üçün “əlaqə” ilə konkret ssenariyə uyğunlaşdıra bilərik.',
        },
        {
          q: 'Mobiltelefonda rahatdırmı?',
          a:
            'Əksər müəllimlər telefondan işləyir: qısa süzmə ilə dərslərə baxıb qeydləri təsdiqləyib SMS xatırlatmasını aktiv saxlayırlar.',
        },
        {
          q: 'Ödənişlər və mövsümi paketlər necə?',
          a:
            'Paket əsaslı və ya aylıq qeydə alınan modellərlə tarix və status izləmə — “kim, nə zaman, ödənildi / gözləmədə” qarışığı azaldır.',
        },
      ],
    },
    cta_band: {
      heading: 'Xaos yox. Nəzarət var.',
      subtitle: 'Əvvəl dəyəri gör, sonra ilk 5 şagirdi əlavə edib qurulumu rahat keç.',
    },
  }
}

/** @returns {unknown} cloned default */
function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function trimStr(v, maxLen) {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, maxLen)
  return s
}

/** @returns {unknown} merged safe payload */
function mergeLoginMarketingFromDb(payloadFromDb) {
  const d = defaultLoginMarketingPayload()
  const p = payloadFromDb && typeof payloadFromDb === 'object' && !Array.isArray(payloadFromDb) ? payloadFromDb : {}

  /** @returns {unknown} */
  function patchHero(orig, raw) {
    if (!raw || typeof raw !== 'object') return orig
    const out = { ...orig }
    const heroKeys = [
      ['pill', 600],
      ['headline', 600],
      ['subheadline', 600],
      ['primary_cta_label', 160],
      ['marketplace_cta_label', 200],
      ['secondary_how', 600],
      ['secondary_demo', 600],
      ['existing_account', 600],
    ]
    for (const [k, maxLen] of heroKeys) {
      if (typeof raw[k] !== 'string') continue
      const t = trimStr(raw[k], maxLen)
      if (t) out[k] = t
    }
    return out
  }

  function patchTrust(orig, raw) {
    if (!raw || typeof raw !== 'object') return orig
    const origShown = orig.section_enabled !== false
    let section_enabled = origShown
    if (Object.prototype.hasOwnProperty.call(raw, 'section_enabled')) {
      const v = raw.section_enabled
      if (v === true || v === 1 || v === '1' || v === 'true' || v === 'TRUE') section_enabled = true
      else if (v === false || v === 0 || v === '0' || v === 'false' || v === 'FALSE') section_enabled = false
      else section_enabled = origShown
    }
    return {
      section_enabled,
      heading: trimStr(raw.heading ?? orig.heading, 120) || orig.heading,
      students_suffix: trimStr(raw.students_suffix ?? orig.students_suffix, 80) || orig.students_suffix,
      instructors_suffix:
        trimStr(raw.instructors_suffix ?? orig.instructors_suffix, 80) ||
        orig.instructors_suffix,
      attendance_footnote:
        trimStr(raw.attendance_footnote ?? orig.attendance_footnote, 500) ||
        orig.attendance_footnote,
    }
  }

  function parseCardEnabled(v, defaultTrue = true) {
    if (v === true || v === 1 || v === '1' || v === 'true' || v === 'TRUE') return true
    if (v === false || v === 0 || v === '0' || v === 'false' || v === 'FALSE') return false
    return defaultTrue
  }

  /** @returns {typeof d.why.cards} */
  function mergeWhyCards(cardsRaw, fallback) {
    if (!Array.isArray(cardsRaw) || cardsRaw.length === 0) return fallback
    return cardsRaw
      .slice(0, 20)
      .map((row) =>
        typeof row !== 'object' || !row
          ? null
          : {
              card_enabled: Object.prototype.hasOwnProperty.call(row, 'card_enabled')
                ? parseCardEnabled(row.card_enabled, true)
                : true,
              title: trimStr(row.title, 140) || '—',
              body: trimStr(row.body, 2000) || '',
            },
      )
      .filter(Boolean)
  }

  function mergeSteps(raw, fallback) {
    if (!Array.isArray(raw) || raw.length === 0) return fallback
    return raw.slice(0, 12).map((row, i) => ({
      step: trimStr(row.step, 4) || String(i + 1),
      title: trimStr(row.title, 200) || '—',
      body: trimStr(row.body, 2000) || '',
    }))
  }

  function mergeFeatures(raw, fallback) {
    if (!Array.isArray(raw) || raw.length === 0) return fallback
    return raw.slice(0, 40).map((row) => {
      const accent = typeof row.accent === 'string' && ACCENT_OPTIONS.has(row.accent)
        ? row.accent
        : 'from-sky-500/15'
      return {
        title: trimStr(row.title, 200) || '—',
        body: trimStr(row.body, 2000) || '',
        accent,
      }
    })
  }

  function mergeFaq(raw, fallback) {
    if (!Array.isArray(raw) || raw.length === 0) return fallback
    return raw.slice(0, 50).map((row) => ({
      q: trimStr(row.q, 300) || '—',
      a: trimStr(row.a, 8000) || '',
    }))
  }

  /** @returns {typeof d.mini_preview} */
  function mergeMini(orig, raw) {
    if (!raw || typeof raw !== 'object') return orig
    let days = orig.calendar_days
    if (Array.isArray(raw.calendar_days)) {
      days = raw.calendar_days.slice(0, 14).map((x) => trimStr(String(x), 12) || '—')
    }
    return {
      title: trimStr(raw.title ?? orig.title, 120) || orig.title,
      badge: trimStr(raw.badge ?? orig.badge, 80) || orig.badge,
      col1_label: trimStr(raw.col1_label ?? orig.col1_label, 80) || orig.col1_label,
      col2_label: trimStr(raw.col2_label ?? orig.col2_label, 80) || orig.col2_label,
      col2_value: trimStr(raw.col2_value ?? orig.col2_value, 120) || orig.col2_value,
      col3_label: trimStr(raw.col3_label ?? orig.col3_label, 80) || orig.col3_label,
      col3_value: trimStr(raw.col3_value ?? orig.col3_value, 120) || orig.col3_value,
      calendar_title:
        trimStr(raw.calendar_title ?? orig.calendar_title, 200) || orig.calendar_title,
      calendar_days: days,
      slot1_time: trimStr(raw.slot1_time ?? orig.slot1_time, 20) || orig.slot1_time,
      slot2_time: trimStr(raw.slot2_time ?? orig.slot2_time, 20) || orig.slot2_time,
    }
  }

  function mergeUseCase(orig, raw) {
    if (!raw || typeof raw !== 'object') return orig
    let bullets = orig.bullets
    /** Boş massiv də qəbul olunur — admin bütün güllələri siləndə defolta qayıtmasın */
    if (Array.isArray(raw.bullets)) {
      bullets = raw.bullets.length
        ? raw.bullets.slice(0, 20).map((b) => ({
            lead: trimStr(b.lead, 120) || '',
            rest: trimStr(b.rest, 1200) || '',
          }))
        : []
    }
    const origShown = orig.section_enabled !== false
    let section_enabled = origShown
    if (Object.prototype.hasOwnProperty.call(raw, 'section_enabled')) {
      const v = raw.section_enabled
      if (v === true || v === 1 || v === '1' || v === 'true' || v === 'TRUE') section_enabled = true
      else if (v === false || v === 0 || v === '0' || v === 'false' || v === 'FALSE') section_enabled = false
      else section_enabled = origShown
    }
    return {
      section_enabled,
      heading: trimStr(raw.heading ?? orig.heading, 160) || orig.heading,
      title_line:
        trimStr(raw.title_line ?? orig.title_line, 300) || orig.title_line,
      bullets,
      faq_link: trimStr(raw.faq_link ?? orig.faq_link, 80) || orig.faq_link,
    }
  }

  /** @returns {typeof d.top_teachers} */
  function mergeTop(orig, raw) {
    if (!raw || typeof raw !== 'object') return orig
    return {
      heading: trimStr(raw.heading ?? orig.heading, 160) || orig.heading,
      preview_before: trimStr(raw.preview_before ?? orig.preview_before ?? '', 600) || orig.preview_before,
      preview_emphasis:
        trimStr(raw.preview_emphasis ?? orig.preview_emphasis ?? '', 400) || orig.preview_emphasis,
      preview_after:
        trimStr(raw.preview_after ?? orig.preview_after ?? '', 1200) || orig.preview_after,
      description_real:
        trimStr(raw.description_real ?? orig.description_real, 2000) ||
        orig.description_real,
      rating_fallback:
        trimStr(raw.rating_fallback ?? orig.rating_fallback, 200) ||
        orig.rating_fallback,
      pupil_suffix: trimStr(raw.pupil_suffix ?? orig.pupil_suffix, 40) || orig.pupil_suffix,
    }
  }

  return {
    version: Number.isFinite(Number(p.version)) ? Number(p.version) : d.version,
    hero: patchHero(d.hero, p.hero),
    mini_preview: mergeMini(d.mini_preview, p.mini_preview),
    trust: patchTrust(d.trust, p.trust),
    why: {
      heading: trimStr(p.why?.heading ?? d.why.heading, 160) || d.why.heading,
      cards: mergeWhyCards(p.why?.cards, d.why.cards),
    },
    top_teachers: mergeTop(d.top_teachers, p.top_teachers),
    steps: {
      heading:
        trimStr(p.steps?.heading ?? d.steps.heading, 160) ||
        d.steps.heading,
      items: mergeSteps(p.steps?.items, d.steps.items),
    },
    features: {
      heading:
        trimStr(p.features?.heading ?? d.features.heading, 160) ||
        d.features.heading,
      items: mergeFeatures(p.features?.items, d.features.items),
    },
    use_case: mergeUseCase(d.use_case, p.use_case),
    faq: {
      heading: trimStr(p.faq?.heading ?? d.faq.heading, 160) || d.faq.heading,
      items: mergeFaq(p.faq?.items, d.faq.items),
    },
    cta_band: {
      heading:
        trimStr(p.cta_band?.heading ?? d.cta_band.heading, 300) ||
        d.cta_band.heading,
      subtitle:
        trimStr(p.cta_band?.subtitle ?? d.cta_band.subtitle, 600) ||
        d.cta_band.subtitle,
    },
  }
}

/**
 * Validates + normalizes PUT body payload (stores merged view from client — we re-merge with defaults anyway).
 */
function normalizePutPayload(payload) {
  return mergeLoginMarketingFromDb(payload)
}

module.exports = {
  LOGIN_MARKETING_SLUG: 'login_landing',
  ACCENT_OPTIONS: [...ACCENT_OPTIONS],
  defaultLoginMarketingPayload,
  mergeLoginMarketingFromDb,
  normalizePutPayload,
  deepClone,
}
