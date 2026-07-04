/** slug → { az, ru, en? } for exam_categories */
const CATEGORY_TRANSLATIONS = {
  'beynelxalq-imtahanlar': {
    az: 'Beynəlxalq İmtahanlara Hazırlıq',
    ru: 'Подготовка к международным экзаменам',
  },
  'dil-imtahanlari': { az: 'Dil İmtahanları', ru: 'Языковые экзамены' },
  'universitet-qebulu': { az: 'Universitet Qəbulu', ru: 'Поступление в университет' },
  'alman-dili': { az: 'Alman Dili', ru: 'Немецкий язык' },
  'fransiz-dili': { az: 'Fransız Dili', ru: 'Французский язык' },
  'it-proqramlasdirma': { az: 'İT və Proqramlaşdırma', ru: 'IT и программирование' },
  python: { az: 'Python', ru: 'Python' },
  'sql-it': { az: 'SQL', ru: 'SQL' },
  'web-development': { az: 'Web Development', ru: 'Веб-разработка' },
  'ai-it': { az: 'AI', ru: 'Искусственный интеллект' },
  'data-analytics': { az: 'Data Analytics', ru: 'Аналитика данных' },
  'data-analytics-core': { az: 'Data & Analytics', ru: 'Данные и аналитика' },
  'cloud-devops': { az: 'Cloud & DevOps', ru: 'Cloud и DevOps' },
  'cloud-platforms': { az: 'Cloud Platforms', ru: 'Облачные платформы' },
  'devops-tools': { az: 'DevOps Tools', ru: 'Инструменты DevOps' },
  'cyber-security': { az: 'Cyber Security', ru: 'Кибербезопасность' },
  'cyber-security-core': { az: 'Security', ru: 'Безопасность' },
  'biznes-idareetme': { az: 'Biznes və Layihə İdarəetməsi', ru: 'Бизнес и управление проектами' },
  'biznes-core': { az: 'Management', ru: 'Менеджмент' },
  'ofis-bacariqlari': { az: 'Ofis Bacarıqları', ru: 'Офисные навыки' },
  'microsoft-office': { az: 'Microsoft Office', ru: 'Microsoft Office' },
  'google-workspace': { az: 'Google Workspace', ru: 'Google Workspace' },
  dizayn: { az: 'Dizayn', ru: 'Дизайн' },
  'design-tools': { az: 'Design Tools', ru: 'Инструменты дизайна' },
  'reqemsal-marketinq': { az: 'Rəqəmsal Marketinq', ru: 'Цифровой маркетинг' },
  'marketing-core': { az: 'Marketing', ru: 'Маркетинг' },
  'maliyye-muhasibat': { az: 'Maliyyə və Mühasibat', ru: 'Финансы и бухгалтерия' },
  'finance-core': { az: 'Finance', ru: 'Финансы' },
  'diger-bacariqlar': { az: 'Digər Bacarıqlar', ru: 'Другие навыки' },
  'other-core': { az: 'Professional Skills', ru: 'Профессиональные навыки' },
};

const CAREER_PATH_TRANSLATIONS = {
  'data-analyst': {
    az: 'Data Analyst',
    ru: 'Аналитик данных',
    descriptionAz: 'Excel-dən Power BI və statistikaya qədər tam data analyst yolu.',
    descriptionRu: 'Полный путь аналитика данных: от Excel до Power BI и статистики.',
  },
  'frontend-developer': {
    az: 'Frontend Developer',
    ru: 'Frontend-разработчик',
    descriptionAz: 'HTML-dən React-ə qədər frontend inkişaf yolu.',
    descriptionRu: 'Путь frontend-разработчика: от HTML до React.',
  },
};

/** exam title (exact match) → { az, ru } */
const EXAM_TITLE_TRANSLATIONS = {
  'IELTS Preparation': { az: 'IELTS Hazırlığı', ru: 'Подготовка к IELTS' },
  'TOEFL Preparation': { az: 'TOEFL Hazırlığı', ru: 'Подготовка к TOEFL' },
  'SAT Preparation': { az: 'SAT Hazırlığı', ru: 'Подготовка к SAT' },
  'ACT Preparation': { az: 'ACT Hazırlığı', ru: 'Подготовка к ACT' },
  'Goethe A1': { az: 'Goethe A1', ru: 'Goethe A1' },
  'Goethe B1': { az: 'Goethe B1', ru: 'Goethe B1' },
  'Python Fundamentals': { az: 'Python Əsasları', ru: 'Основы Python' },
  'Advanced Python': { az: 'Python (İrəli)', ru: 'Python (продвинутый)' },
  'SQL Basics': { az: 'SQL Əsasları', ru: 'Основы SQL' },
  'HTML': { az: 'HTML', ru: 'HTML' },
  'CSS': { az: 'CSS', ru: 'CSS' },
  'JavaScript': { az: 'JavaScript', ru: 'JavaScript' },
  'React': { az: 'React', ru: 'React' },
  'Data Analytics Fundamentals': { az: 'Data Analytics Əsasları', ru: 'Основы аналитики данных' },
  'Statistics Fundamentals': { az: 'Statistika Əsasları', ru: 'Основы статистики' },
  'Excel Fundamentals': { az: 'Excel Əsasları', ru: 'Основы Excel' },
  'Advanced Excel': { az: 'Excel (İrəli)', ru: 'Excel (продвинутый)' },
  'Power BI': { az: 'Power BI', ru: 'Power BI' },
  'Data Analyst Skill Assessment': {
    az: 'Data Analyst Skill Assessment',
    ru: 'Оценка навыков Data Analyst',
  },
  'AWS Fundamentals': { az: 'AWS Əsasları', ru: 'Основы AWS' },
  'Cyber Security Fundamentals': { az: 'Kiber Təhlükəsizlik Əsasları', ru: 'Основы кибербезопасности' },
  'Agile Fundamentals': { az: 'Agile Əsasları', ru: 'Основы Agile' },
  'Microsoft Excel': { az: 'Microsoft Excel', ru: 'Microsoft Excel' },
  'Digital Marketing': { az: 'Rəqəmsal Marketinq', ru: 'Цифровой маркетинг' },
  'Accounting Basics': { az: 'Mühasibat Əsasları', ru: 'Основы бухгалтерии' },
  'First Aid Basics': { az: 'İlk Yardım Əsasları', ru: 'Основы первой помощи' },
};

function ruNameForCategory(slug, fallbackName) {
  const m = CATEGORY_TRANSLATIONS[slug];
  return m?.ru || fallbackName;
}

function ruNameForCareerPath(slug, fallbackName) {
  const m = CAREER_PATH_TRANSLATIONS[slug];
  return m?.ru || fallbackName;
}

function ruDescriptionForCareerPath(slug, fallbackDesc) {
  const m = CAREER_PATH_TRANSLATIONS[slug];
  return m?.descriptionRu || fallbackDesc;
}

function ruTitleForExam(title) {
  const m = EXAM_TITLE_TRANSLATIONS[title];
  return m?.ru || title;
}

function translationsJsonForCategory(slug, fallbackName) {
  const m = CATEGORY_TRANSLATIONS[slug];
  if (!m) return JSON.stringify({ az: fallbackName, ru: fallbackName });
  return JSON.stringify({ az: m.az || fallbackName, ru: m.ru || fallbackName });
}

function translationsJsonForCareerPath(slug, fallbackName, fallbackDesc) {
  const m = CAREER_PATH_TRANSLATIONS[slug];
  if (!m) return JSON.stringify({ az: fallbackName, ru: fallbackName, description_az: fallbackDesc, description_ru: fallbackDesc });
  return JSON.stringify({
    az: m.az || fallbackName,
    ru: m.ru || fallbackName,
    description_az: m.descriptionAz || fallbackDesc,
    description_ru: m.descriptionRu || fallbackDesc,
  });
}

function translationsJsonForExamTitle(title) {
  const m = EXAM_TITLE_TRANSLATIONS[title];
  if (!m) return JSON.stringify({ az: title, ru: title });
  return JSON.stringify({ az: m.az || title, ru: m.ru || title });
}

module.exports = {
  CATEGORY_TRANSLATIONS,
  CAREER_PATH_TRANSLATIONS,
  EXAM_TITLE_TRANSLATIONS,
  ruNameForCategory,
  ruNameForCareerPath,
  ruDescriptionForCareerPath,
  ruTitleForExam,
  translationsJsonForCategory,
  translationsJsonForCareerPath,
  translationsJsonForExamTitle,
};
