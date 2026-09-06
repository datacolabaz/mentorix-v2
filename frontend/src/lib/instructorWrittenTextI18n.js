import { resolveUiLocale } from './uiLocale.js'
import { replaceAzPhrases } from './azPhraseMatch.js'
import { teachingCategoryPhrases } from './teachingCategoryI18n.js'

const PLACES = [
  { az: 'Bakı', en: 'Baku', ru: 'Баку', wholeWord: true },
  { az: 'Gəncə', en: 'Ganja', ru: 'Гянджа', wholeWord: true },
  { az: 'Sumqayıt', en: 'Sumgait', ru: 'Сумгаит', wholeWord: true },
  { az: 'Naxçıvan', en: 'Nakhchivan', ru: 'Нахичевань', wholeWord: true },
  { az: 'Lənkəran', en: 'Lankaran', ru: 'Ленкорань', wholeWord: true },
  { az: 'Mingəçevir', en: 'Mingachevir', ru: 'Мингечевир', wholeWord: true },
]

const EDUCATION = [
  { az: 'Bakı Dövlət Universiteti', en: 'Baku State University', ru: 'Бакинский государственный университет' },
  { az: 'Azərbaycan Dövlət Pedaqoji Universiteti', en: 'Azerbaijan State Pedagogical University', ru: 'Азербайджанский государственный педагогический университет' },
  { az: 'Azərbaycan Dillər Universiteti', en: 'Azerbaijan University of Languages', ru: 'Азербайджанский университет языков' },
  { az: 'Azərbaycan Dövlət İqtisad Universiteti', en: 'Azerbaijan State University of Economics', ru: 'Азербайджанский государственный экономический университет' },
  { az: 'Azərbaycan Texniki Universiteti', en: 'Azerbaijan Technical University', ru: 'Азербайджанский технический университет' },
  { az: 'Azərbaycan Tibb Universiteti', en: 'Azerbaijan Medical University', ru: 'Азербайджанский медицинский университет' },
  { az: 'Azərbaycan Memarlıq və İnşaat Universiteti', en: 'Azerbaijan University of Architecture and Construction', ru: 'Азербайджанский университет архитектуры и строительства' },
  { az: 'Kompüter Elmləri', en: 'Computer Science', ru: 'Компьютерные науки' },
  { az: 'İnformasiya Texnologiyaları', en: 'Information Technology', ru: 'Информационные технологии' },
  { az: 'Hüquqşünaslıq', en: 'Law', ru: 'Юриспруденция' },
  { az: 'Pedaqogika', en: 'Pedagogy', ru: 'Педагогика' },
  { az: 'Filologiya', en: 'Philology', ru: 'Филология' },
  { az: 'İqtisadiyyat', en: 'Economics', ru: 'Экономика' },
  { az: 'Jurnalistika', en: 'Journalism', ru: 'Журналистика' },
  { az: 'Psixologiya', en: 'Psychology', ru: 'Психология' },
  { az: 'Stomatologiya', en: 'Dentistry', ru: 'Стоматология' },
  { az: 'Əczaçılıq', en: 'Pharmacy', ru: 'Фармация' },
  { az: 'Memarlıq', en: 'Architecture', ru: 'Архитектура' },
  { az: 'Mühəndislik', en: 'Engineering', ru: 'Инженерия' },
  { az: 'Maliyyə', en: 'Finance', ru: 'Финансы' },
  { az: 'Ali təhsil', en: 'Higher education', ru: 'Высшее образование' },
  { az: 'Orta təhsil', en: 'Secondary education', ru: 'Среднее образование' },
  { az: 'Bakalavr dərəcəsi', en: "Bachelor's degree", ru: 'Степень бакалавра' },
  { az: 'Magistr dərəcəsi', en: "Master's degree", ru: 'Степень магистра' },
  { az: 'Bakalavr', en: "Bachelor's", ru: 'Бакалавр' },
  { az: 'Magistratura', en: "Master's", ru: 'Магистратура' },
  { az: 'Doktorantura', en: 'PhD', ru: 'Докторантура' },
  { az: 'Magistr', en: "Master's", ru: 'Магистр' },
  { az: 'Pedaqoji Universiteti', en: 'Pedagogical University', ru: 'Педагогический университет' },
  { az: 'Dövlət Universiteti', en: 'State University', ru: 'Государственный университет' },
  { az: 'Universiteti', en: 'University', ru: 'Университет' },
  { az: 'Universitet', en: 'University', ru: 'Университет' },
  { az: 'Kolleci', en: 'College', ru: 'Колледж' },
  { az: 'Liseyi', en: 'Lyceum', ru: 'Лицей' },
  { az: 'Tibb', en: 'Medicine', ru: 'Медицина', wholeWord: true },
  { az: 'Hüquq', en: 'Law', ru: 'Право', wholeWord: true },
]

const BIO = [
  { az: 'müxtəlif kurslarda təlimlər verirəm', en: 'I teach various courses', ru: 'преподаю на различных курсах' },
  { az: 'təlimlər verirəm', en: 'I teach', ru: 'я преподаю' },
  { az: 'dərs deyirəm', en: 'I teach', ru: 'я преподаю' },
  { az: 'Tələbələrimdən bir çoxu', en: 'Many of my students', ru: 'Многие мои ученики' },
  { az: 'ölkəmizdə və qlobal şirkətlərdə', en: 'in our country and at global companies', ru: 'в нашей стране и в международных компаниях' },
  { az: 'qlobal şirkətlərdə', en: 'at global companies', ru: 'в международных компаниях' },
  { az: 'remote işləyirlər', en: 'work remotely', ru: 'работают удалённо' },
  { az: 'işləyirlər', en: 'work', ru: 'работают' },
  { az: 'Suallara məntiqi yanaşma', en: 'A logical approach to questions', ru: 'Логический подход к вопросам' },
  { az: 'məntiqi yanaşma', en: 'logical approach', ru: 'логический подход' },
  { az: 'qısa anlaşıqlı izah', en: 'short, clear explanations', ru: 'краткие понятные объяснения' },
  { az: 'anlaşıqlı izah', en: 'clear explanations', ru: 'понятные объяснения' },
  { az: 'məsələlər üçün', en: 'for problems', ru: 'для задач' },
  { az: 'qısaldılmış yollar', en: 'shortcuts', ru: 'сокращённые методы' },
  { az: 'tələbələrim', en: 'my students', ru: 'мои ученики' },
  { az: 'kurslarda', en: 'in courses', ru: 'на курсах' },
  { az: 'və s.', en: 'etc.', ru: 'и т.д.' },
  { az: 've.s', en: 'etc.', ru: 'и т.д.' },
  { az: 'və', en: 'and', ru: 'и', wholeWord: true },
]

function applyYearPatterns(text, locale) {
  let out = String(text)
  out = out.replace(/(\d+)\s*il(?:d[əe]n)?\s+art[ıi]q/giu, (_, n) =>
    locale === 'ru' ? `Более ${n} лет` : `More than ${n} years`,
  )
  out = out.replace(/(\d+)\s*il\s+t[əe]cr[üu]b[əe]/giu, (_, n) =>
    locale === 'ru' ? `${n} лет опыта` : `${n} years of experience`,
  )
  // "SQL-dən" / "Tableau-dan" → keep the proper noun
  out = out.replace(/([A-Za-z][A-Za-z0-9+#.]{1,})-d[aəe]n\b/giu, '$1')
  return out
}

/**
 * Localize teacher-written profile fields (about, education, certificates, address)
 * for EN/RU. AZ is returned unchanged. Unknown phrases stay as written.
 */
export function localizeInstructorWrittenText(text, lang) {
  const locale = resolveUiLocale(lang)
  const raw = String(text || '')
  if (!raw.trim() || locale === 'az') return raw

  const phrases = [...EDUCATION, ...BIO, ...PLACES, ...teachingCategoryPhrases()]
  let out = applyYearPatterns(raw, locale)
  out = replaceAzPhrases(out, phrases, locale)
  return out
}
