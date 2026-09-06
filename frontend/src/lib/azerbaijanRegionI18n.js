import { BAKU, formatResultsLocationPhrase as formatAzPhrase, isBakuRegion, normalizeRegionName } from '@shared/azerbaijanRegions.mjs'
import { resolveUiLocale } from './uiLocale'

const REGION_EN = {
  Abşeron: 'Absheron',
  Ağcabədi: 'Aghjabadi',
  Ağdam: 'Aghdam',
  Ağdaş: 'Aghdash',
  Ağstafa: 'Aghstafa',
  Ağsu: 'Aghsu',
  Astara: 'Astara',
  Babək: 'Babek',
  Balakən: 'Balakan',
  [BAKU]: 'Baku',
  Beyləqan: 'Beylagan',
  Bərdə: 'Barda',
  Biləsuvar: 'Bilasuvar',
  Cəbrayıl: 'Jabrayil',
  Cəlilabad: 'Jalilabad',
  Culfa: 'Julfa',
  Daşkəsən: 'Dashkasan',
  Füzuli: 'Fuzuli',
  Gədəbəy: 'Gadabay',
  Gəncə: 'Ganja',
  Goranboy: 'Goranboy',
  Göyçay: 'Goychay',
  Göygöl: 'Goygol',
  Hacıqabul: 'Hajigabul',
  Xaçmaz: 'Khachmaz',
  Xızı: 'Khizi',
  Xocalı: 'Khojaly',
  Xocavənd: 'Khojavend',
  İmişli: 'Imishli',
  İsmayıllı: 'Ismayilli',
  Kəlbəcər: 'Kalbajar',
  Kəngərli: 'Kangarli',
  Kürdəmir: 'Kurdamir',
  Laçın: 'Lachin',
  Lerik: 'Lerik',
  Lənkəran: 'Lankaran',
  Masallı: 'Masally',
  Mingəçevir: 'Mingachevir',
  Naftalan: 'Naftalan',
  Naxçıvan: 'Nakhchivan',
  Neftçala: 'Neftchala',
  Oğuz: 'Oghuz',
  Ordubad: 'Ordubad',
  Qax: 'Gakh',
  Qazax: 'Gazakh',
  Qəbələ: 'Gabala',
  Qobustan: 'Gobustan',
  Quba: 'Guba',
  Qubadlı: 'Gubadli',
  Qusar: 'Gusar',
  Saatlı: 'Saatly',
  Sabirabad: 'Sabirabad',
  Salyan: 'Salyan',
  Samux: 'Samukh',
  Sədərək: 'Sadarak',
  Siyəzən: 'Siyazan',
  Sumqayıt: 'Sumgait',
  Şabran: 'Shabran',
  Şahbuz: 'Shahbuz',
  Şamaxı: 'Shamakhi',
  Şəki: 'Shaki',
  Şəmkir: 'Shamkir',
  Şərur: 'Sharur',
  Şirvan: 'Shirvan',
  Şuşa: 'Shusha',
  Tərtər: 'Tartar',
  Tovuz: 'Tovuz',
  Ucar: 'Ujar',
  Yardımlı: 'Yardimli',
  Yevlax: 'Yevlakh',
  Zaqatala: 'Zagatala',
  Zəngilan: 'Zangilan',
  Zərdab: 'Zardab',
}

const REGION_RU = {
  Abşeron: 'Апшерон',
  Ağcabədi: 'Агджабеди',
  Ağdam: 'Агдам',
  Ağdaş: 'Агдаш',
  Ağstafa: 'Акстафа',
  Ağsu: 'Ахсу',
  Astara: 'Астара',
  Babək: 'Бабек',
  Balakən: 'Белоканы',
  [BAKU]: 'Баку',
  Beyləqan: 'Бейлаган',
  Bərdə: 'Барда',
  Biləsuvar: 'Билясувар',
  Cəbrayıl: 'Джебраил',
  Cəlilabad: 'Джалилабад',
  Culfa: 'Джульфа',
  Daşkəsən: 'Дашкесан',
  Füzuli: 'Физули',
  Gədəbəy: 'Кедабек',
  Gəncə: 'Гянджа',
  Goranboy: 'Геранбой',
  Göyçay: 'Гёйчай',
  Göygöl: 'Гёйгёль',
  Hacıqabul: 'Гаджигабул',
  Xaçmaz: 'Хачмаз',
  Xızı: 'Хызы',
  Xocalı: 'Ходжалы',
  Xocavənd: 'Ходжавенд',
  İmişli: 'Имишли',
  İsmayıllı: 'Исмаиллы',
  Kəlbəcər: 'Кельбаджар',
  Kəngərli: 'Кенгерли',
  Kürdəmir: 'Кюрдамир',
  Laçın: 'Лачин',
  Lerik: 'Лерик',
  Lənkəran: 'Ленкорань',
  Masallı: 'Масаллы',
  Mingəçevir: 'Мингечевир',
  Naftalan: 'Нафталан',
  Naxçıvan: 'Нахичевань',
  Neftçala: 'Нефтечала',
  Oğuz: 'Огуз',
  Ordubad: 'Ордубад',
  Qax: 'Гах',
  Qazax: 'Казах',
  Qəbələ: 'Габала',
  Qobustan: 'Гобустан',
  Quba: 'Губа',
  Qubadlı: 'Губадлы',
  Qusar: 'Гусар',
  Saatlı: 'Саатлы',
  Sabirabad: 'Сабирабад',
  Salyan: 'Сальян',
  Samux: 'Самух',
  Sədərək: 'Садарак',
  Siyəzən: 'Сиазань',
  Sumqayıt: 'Сумгаит',
  Şabran: 'Шабран',
  Şahbuz: 'Шахбуз',
  Şamaxı: 'Шемахы',
  Şəki: 'Шеки',
  Şəmkir: 'Шамкир',
  Şərur: 'Шарур',
  Şirvan: 'Ширван',
  Şuşa: 'Шуша',
  Tərtər: 'Тертер',
  Tovuz: 'Товуз',
  Ucar: 'Уджар',
  Yardımlı: 'Ярдымлы',
  Yevlax: 'Евлах',
  Zaqatala: 'Закаталы',
  Zəngilan: 'Зангелан',
  Zərdab: 'Зардоб',
}

const DISTRICT_RU = {
  Badamdar: 'Бадамдар',
  Binəqədi: 'Бинагади',
  Nizami: 'Низами',
  Nərimanov: 'Нариманов',
  Nəsimi: 'Насими',
  Pirallahı: 'Пираллахи',
  Qaradağ: 'Гарадаг',
  Sabunçu: 'Сабунчи',
  Səbail: 'Сабаиль',
  Suraxanı: 'Сураханы',
  Xətai: 'Хатай',
  Xəzər: 'Хазар',
  Yasamal: 'Ясамаль',
}

export function regionDisplayName(azName, lang) {
  const locale = resolveUiLocale(lang)
  const key = normalizeRegionName(azName)
  if (!key) return ''
  if (locale === 'en') return REGION_EN[key] || key
  if (locale === 'ru') return REGION_RU[key] || key
  return key
}

export function districtDisplayName(azName, lang) {
  const locale = resolveUiLocale(lang)
  const key = normalizeRegionName(azName)
  if (!key) return ''
  if (locale === 'ru') return DISTRICT_RU[key] || key
  return key
}

export function formatResultsLocationPhraseI18n(region, bakuDistrict, lang) {
  const locale = resolveUiLocale(lang)
  if (locale === 'az') return formatAzPhrase(region, bakuDistrict)
  const r = normalizeRegionName(region)
  const d = normalizeRegionName(bakuDistrict)
  if (!r) return ''
  if (isBakuRegion(r) && d) return districtDisplayName(d, locale)
  if (isBakuRegion(r)) return regionDisplayName(BAKU, locale)
  return regionDisplayName(r, locale)
}

export function instructorLocationBadgeI18n(region, bakuDistrict, lang) {
  const locale = resolveUiLocale(lang)
  const r = normalizeRegionName(region)
  const d = normalizeRegionName(bakuDistrict)
  if (isBakuRegion(r) && d) return districtDisplayName(d, locale)
  if (r) return regionDisplayName(r, locale)
  return null
}

/** Region + Baku district names for replacing inside address / free-text. */
export function locationPhrases() {
  const rows = []
  for (const [az, en] of Object.entries(REGION_EN)) {
    rows.push({ az, en, ru: REGION_RU[az], wholeWord: true })
  }
  for (const [az, ru] of Object.entries(DISTRICT_RU)) {
    rows.push({ az, en: az, ru, wholeWord: true })
  }
  return rows
}
