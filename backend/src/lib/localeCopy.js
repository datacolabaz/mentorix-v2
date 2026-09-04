const { normalizeLocale } = require('./userLocale');

const PLAN_NAME = {
  az: { basic: 'SADƏ', pro: 'STANDART', growth: 'PROFESSIONAL', premium: 'PREMİUM' },
  ru: { basic: 'BASIC', pro: 'STANDART', growth: 'PROFESSIONAL', premium: 'PREMIUM' },
  en: { basic: 'BASIC', pro: 'STANDARD', growth: 'PROFESSIONAL', premium: 'PREMIUM' },
};

const MAP_FEATURE = {
  az: {
    basic: '📍 Xəritədə görünür',
    pro: '📍 Xəritədə görünür',
    growth: '⭐ Axtarışda önə çıxır',
    premium: '🔥 Axtarışda həmişə ən yuxarıda (TOP)',
  },
  ru: {
    basic: '📍 Видимость на карте',
    pro: '📍 Видимость на карте',
    growth: '⭐ Выше в поиске',
    premium: '🔥 Всегда в топе поиска (TOP)',
  },
  en: {
    basic: '📍 Visible on the map',
    pro: '📍 Visible on the map',
    growth: '⭐ Featured in search',
    premium: '🔥 Always at the top of search (TOP)',
  },
};

function lang(locale) {
  const l = normalizeLocale(locale);
  return l === 'ru' || l === 'en' ? l : 'az';
}

function planDisplayName(slug, locale) {
  const table = PLAN_NAME[lang(locale)] || PLAN_NAME.az;
  const key = String(slug || '').toLowerCase();
  return table[key] || table.basic;
}

function joinOr(names, locale) {
  const l = lang(locale);
  const conj = l === 'ru' ? 'или' : l === 'en' ? 'or' : 'və ya';
  const unpaid = l === 'ru' ? 'платный' : l === 'en' ? 'paid' : 'ödənişli';
  const clean = (names || []).map((n) => String(n || '').trim()).filter(Boolean);
  if (!clean.length) return unpaid;
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} ${conj} ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')} ${conj} ${clean[clean.length - 1]}`;
}

function higherPlanOrAbove(planName, locale) {
  const l = lang(locale);
  if (l === 'ru') return `${planName} или выше`;
  if (l === 'en') return `${planName} or higher`;
  return `${planName} və ya daha yüksək paket`;
}

function ctaViewPlans(locale) {
  const l = lang(locale);
  if (l === 'ru') return 'Смотреть пакеты';
  if (l === 'en') return 'View plans';
  return 'Paketlərə bax';
}

function ctaSmsTopup(locale) {
  const l = lang(locale);
  if (l === 'ru') return 'Пополнить SMS';
  if (l === 'en') return 'Top up SMS';
  return 'SMS Balansı Artır';
}

function ctaStorageTopup(locale) {
  const l = lang(locale);
  if (l === 'ru') return 'Купить память';
  if (l === 'en') return 'Buy storage';
  return 'Yaddaş al';
}

function ctaUpgrade(locale) {
  const l = lang(locale);
  if (l === 'ru') return 'Повысить пакет';
  if (l === 'en') return 'Upgrade plan';
  return 'Paketi yüksəlt';
}

function mapFeatureLine(planSlug, locale) {
  const table = MAP_FEATURE[lang(locale)] || MAP_FEATURE.az;
  const key = String(planSlug || '').toLowerCase();
  return table[key] || table.basic;
}

function expiredBanner({ onBasic, ipDenied, higherPlan, locale }) {
  const l = lang(locale);
  if (onBasic && ipDenied) {
    if (l === 'ru') {
      return `Бесплатный пробный период BASIC с этого устройства уже использован. Чтобы продолжить, выберите ${higherPlan}.`;
    }
    if (l === 'en') {
      return `The free BASIC trial has already been used on this device. To continue, choose ${higherPlan}.`;
    }
    return `Bu cihazdan artıq pulsuz SADƏ sınaq istifadə olunub. Davam etmək üçün ${higherPlan} seçin.`;
  }
  if (onBasic) {
    if (l === 'ru') {
      return `14-дневный пробный период BASIC истёк. Чтобы продолжить, выберите ${higherPlan}.`;
    }
    if (l === 'en') {
      return `The 14-day BASIC trial has ended. To continue, choose ${higherPlan}.`;
    }
    return `14 günlük SADƏ sınaq müddəti bitib. Davam etmək üçün ${higherPlan} seçin.`;
  }
  if (l === 'ru') {
    return 'Подписка неактивна или срок оплаты истёк. Чтобы продолжить, выберите пакет.';
  }
  if (l === 'en') {
    return 'Your subscription is inactive or payment has expired. Choose a plan to continue.';
  }
  return 'Abunəlik aktiv deyil və ya ödəniş müddəti keçib. Davam etmək üçün paket seçin.';
}

function expiredCode({ onBasic, ipDenied }) {
  if (onBasic && ipDenied) return 'BASIC_TRIAL_IP_DENIED';
  if (onBasic) return 'BASIC_TRIAL_EXPIRED';
  return 'SUBSCRIPTION_EXPIRED';
}

function opportunityTitle(locale) {
  const l = lang(locale);
  if (l === 'ru') return '🔥 Новая возможность: ученик';
  if (l === 'en') return '🔥 New student opportunity';
  return '🔥 Yeni tələbə fürsəti';
}

function opportunityBody({ areaLabel, subjectLabel, plansLabel, locale }) {
  const l = lang(locale);
  const genericArea = !areaLabel || String(areaLabel).trim().toLowerCase() === 'seçilmiş ərazidə';
  const genericSubject = !subjectLabel || String(subjectLabel).trim().toLowerCase() === 'müəllim';
  const subject =
    genericSubject
      ? l === 'ru'
        ? 'учитель'
        : l === 'en'
          ? 'a teacher'
          : 'müəllim'
      : String(subjectLabel).trim();
  const location = genericArea
    ? l === 'ru'
      ? 'в выбранном районе'
      : l === 'en'
        ? 'in the selected area'
        : 'seçilmiş ərazidə'
    : l === 'ru'
      ? `в районе ${String(areaLabel).trim()}`
      : l === 'en'
        ? `in ${String(areaLabel).trim()}`
        : `${String(areaLabel).trim()} rayonunda`;
  const plans = plansLabel || (l === 'ru' ? 'PROFESSIONAL или PREMIUM' : 'PROFESSIONAL və ya PREMİUM');
  if (l === 'ru') {
    return `🔥 Новая возможность: ${location} ищут ${subject}. Повысьте профиль до пакета ${plans} и всегда будьте наверху результатов поиска.`;
  }
  if (l === 'en') {
    return `🔥 New student opportunity: ${subject} is wanted ${location}. Upgrade to ${plans} and stay at the top of search results.`;
  }
  return `🔥 Yeni tələbə fürsəti: ${location} ${subject} axtarılır. Profilinizi ${plans} paketə yüksəldin və axtarış nəticələrində həmişə ən yuxarıda görünün.`;
}

module.exports = {
  lang,
  planDisplayName,
  joinOr,
  higherPlanOrAbove,
  ctaViewPlans,
  ctaSmsTopup,
  ctaStorageTopup,
  ctaUpgrade,
  mapFeatureLine,
  expiredBanner,
  expiredCode,
  opportunityTitle,
  opportunityBody,
};
