import { resolveUiLocale } from './uiLocale'

/** Canonical AZ category name → { en, ru }. Unlisted names stay as-is (already English). */
const BY_AZ = {
  Abituriyent: { en: 'University applicant prep', ru: 'Абитуриент' },
  ABŞ: { en: 'USA', ru: 'США' },
  'Alman dili': { en: 'German', ru: 'Немецкий язык' },
  Almaniya: { en: 'Germany', ru: 'Германия' },
  'Azərbaycan dili': { en: 'Azerbaijani', ru: 'Азербайджанский язык' },
  'Beynəlxalq Məktəb Proqramları': { en: 'International school programs', ru: 'Международные школьные программы' },
  Biologiya: { en: 'Biology', ru: 'Биология' },
  'Biznes və Marketinq': { en: 'Business and Marketing', ru: 'Бизнес и маркетинг' },
  Coğrafiya: { en: 'Geography', ru: 'География' },
  Çin: { en: 'China', ru: 'Китай' },
  'Çin dili': { en: 'Chinese', ru: 'Китайский язык' },
  'Data Analitika': { en: 'Data Analytics', ru: 'Аналитика данных' },
  'Data və Süni İntellekt': { en: 'Data and AI', ru: 'Данные и ИИ' },
  Digər: { en: 'Other', ru: 'Другое' },
  Doktorantura: { en: 'PhD', ru: 'Докторантура' },
  'Dövlət İmtahanları': { en: 'State exams', ru: 'Государственные экзамены' },
  'Dövlət İmtahanlarına Hazırlıq': { en: 'State exam prep', ru: 'Подготовка к госэкзаменам' },
  'Dövlət Qulluğu': { en: 'Civil service', ru: 'Госслужба' },
  'Erkən İnkişaf': { en: 'Early development', ru: 'Раннее развитие' },
  'Evdə Hazırlıq': { en: 'Home tutoring', ru: 'Домашняя подготовка' },
  'Ərəb dili': { en: 'Arabic', ru: 'Арабский язык' },
  Fizika: { en: 'Physics', ru: 'Физика' },
  Fotoqrafiya: { en: 'Photography', ru: 'Фотография' },
  Fransa: { en: 'France', ru: 'Франция' },
  'Fransız dili': { en: 'French', ru: 'Французский язык' },
  Gitara: { en: 'Guitar', ru: 'Гитара' },
  'Xaricdə Təhsil': { en: 'Study abroad', ru: 'Обучение за рубежом' },
  'Xarici Dillər': { en: 'Foreign languages', ru: 'Иностранные языки' },
  'İncəsənət və Şəxsi İnkişaf': { en: 'Arts and personal development', ru: 'Искусство и развитие' },
  İnformatika: { en: 'Computer science', ru: 'Информатика' },
  'İngilis dili': { en: 'English', ru: 'Английский язык' },
  'İngilis dili imtahanları': { en: 'English exams', ru: 'Экзамены по английскому' },
  'İspan dili': { en: 'Spanish', ru: 'Испанский язык' },
  'İT və Proqramlaşdırma': { en: 'IT and Programming', ru: 'IT и программирование' },
  Kimya: { en: 'Chemistry', ru: 'Химия' },
  'Koreya dili': { en: 'Korean', ru: 'Корейский язык' },
  Liderlik: { en: 'Leadership', ru: 'Лидерство' },
  Magistratura: { en: "Master's", ru: 'Магистратура' },
  'Magistratura (Xaric)': { en: "Master's (abroad)", ru: 'Магистратура (за рубежом)' },
  'Mental Arifmetika': { en: 'Mental arithmetic', ru: 'Ментальная арифметика' },
  'Məktəb Fənləri': { en: 'School subjects', ru: 'Школьные предметы' },
  'Məktəbə Hazırlıq': { en: 'Preschool prep', ru: 'Подготовка к школе' },
  'Məktəbəqədər və İbtidai Təhsil': { en: 'Preschool and primary', ru: 'Дошкольное и начальное образование' },
  Məntiq: { en: 'Logic', ru: 'Логика' },
  MİQ: { en: 'Teacher recruitment exam (MIQ)', ru: 'МИГ' },
  Musiqi: { en: 'Music', ru: 'Музыка' },
  Natiqlik: { en: 'Public speaking', ru: 'Ораторское искусство' },
  Rəsm: { en: 'Drawing', ru: 'Рисование' },
  Riyaziyyat: { en: 'Mathematics', ru: 'Математика' },
  'Rus dili': { en: 'Russian', ru: 'Русский язык' },
  Rusiya: { en: 'Russia', ru: 'Россия' },
  'Sürətli Oxu': { en: 'Speed reading', ru: 'Скорочтение' },
  Sürücülük: { en: 'Driving', ru: 'Вождение' },
  Şahmat: { en: 'Chess', ru: 'Шахматы' },
  Tarix: { en: 'History', ru: 'История' },
  'Türk dili': { en: 'Turkish', ru: 'Турецкий язык' },
  Türkiyə: { en: 'Turkey', ru: 'Турция' },
  'Yapon dili': { en: 'Japanese', ru: 'Японский язык' },
}

function fold(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
}

const BY_AZ_FOLD = new Map()
for (const [az, tr] of Object.entries(BY_AZ)) {
  BY_AZ_FOLD.set(fold(az), tr)
}

export function localizeTeachingCategoryName(name, lang) {
  const locale = resolveUiLocale(lang)
  const raw = String(name || '').trim()
  if (!raw || locale === 'az') return raw
  const tr = BY_AZ_FOLD.get(fold(raw))
  if (!tr) return raw
  return tr[locale] || raw
}

export function localizeTeachingCategoryList(names, lang) {
  if (!Array.isArray(names)) return []
  return names.map((n) => localizeTeachingCategoryName(n, lang)).filter(Boolean)
}

export function categoryNodeLabel(node, lang) {
  return localizeTeachingCategoryName(node?.name_az || node?.name || '', lang)
}
