/** Mentorix knowledge layer — only real product surfaces. Never invent features. */

export const ROLES = ['instructor', 'student', 'admin']

export const NOT_IN_PRODUCT = [
  'calendar session booking / sessiya bronu',
  'in-app payment between student and marketplace teacher',
  'login-screen chatbot',
  'parent/course Digital Mentor tour',
]

export const PAGES = {
  '/instructor': {
    id: 'instructor-home',
    roles: ['instructor'],
    title: { az: 'Müəllim dashboard', ru: 'Панель преподавателя', en: 'Instructor dashboard' },
    summary: {
      az: 'Gəlir, tələbə sayı və imtahan nəticələrinin qısa icmalı. Sol menyudan qrup, imtahan və tənzimləmələrə keçin.',
      ru: 'Краткий обзор дохода, учеников и экзаменов. Слева — группы, экзамены и настройки.',
      en: 'Snapshot of income, students and exams. Use the left menu for groups, exams and settings.',
    },
    actions: ['open-students', 'open-settings', 'open-schedule'],
  },
  '/instructor/settings': {
    id: 'instructor-settings',
    roles: ['instructor'],
    title: { az: 'Tənzimləmələr və axtarış profili', ru: 'Настройки и профиль поиска', en: 'Settings and search profile' },
    summary: {
      az: 'Fənn, şəhər/xəritə pini və dərs formatını doldurun ki, valideynlər sizi «Müəllim tap»-da görsün.',
      ru: 'Укажите предметы, город/пин на карте и формат занятий, чтобы вас находили в поиске.',
      en: 'Add subjects, map pin and lesson format so parents can find you in teacher search.',
    },
    actions: ['complete-discover-profile'],
  },
  '/instructor/students': {
    id: 'instructor-students',
    roles: ['instructor'],
    title: { az: 'Tələbələr', ru: 'Ученики', en: 'Students' },
    summary: {
      az: 'CRM tələbələrini əlavə edin, qrupa bağlayın və paket/ödənişi idarə edin. Telefon təsdiqi bu addımda tələb oluna bilər.',
      ru: 'Добавляйте учеников CRM, привязывайте к группе и тарифу. Может потребоваться подтверждение телефона.',
      en: 'Add CRM students, attach them to a group and plan. Phone verification may be required.',
    },
    actions: ['add-student'],
  },
  '/instructor/schedule': {
    id: 'instructor-schedule',
    roles: ['instructor'],
    title: { az: 'Cədvəl', ru: 'Расписание', en: 'Schedule' },
    summary: {
      az: 'Dərs slotlarını görün və tələbə/qrup dərslərini planlaşdırın. Bu, Mentorix-də «sessiya» əvəzinə istifadə olunan cədvəldir.',
      ru: 'Слоты уроков и расписание групп. Это календарь Mentorix, отдельной страницы «сессии» нет.',
      en: 'Lesson slots and group timetable. Mentorix uses Schedule, not a separate Sessions page.',
    },
    actions: ['view-schedule'],
  },
  '/instructor/exams': {
    id: 'instructor-exams',
    roles: ['instructor'],
    title: { az: 'İmtahanlar', ru: 'Экзамены', en: 'Exams' },
    summary: {
      az: 'İmtahan yaradın, suallar əlavə edin və nəticələrə baxın.',
      ru: 'Создавайте экзамены, добавляйте вопросы и смотрите результаты.',
      en: 'Create exams, add questions and review results.',
    },
    actions: ['create-exam'],
  },
  '/student': {
    id: 'student-home',
    roles: ['student'],
    title: { az: 'Tələbə proqresi', ru: 'Прогресс ученика', en: 'Student progress' },
    summary: {
      az: 'İmtahan və tapşırıq vəziyyətiniz. Növbəti addım: qrup, imtahan və ya cədvəl.',
      ru: 'Экзамены и задания. Дальше: группа, экзамен или расписание.',
      en: 'Exam and assignment status. Next: groups, exams or schedule.',
    },
    actions: ['open-groups', 'open-exams', 'open-schedule'],
  },
  '/student/groups': {
    id: 'student-groups',
    roles: ['student'],
    title: { az: 'Qruplarım', ru: 'Мои группы', en: 'My groups' },
    summary: {
      az: 'Qoşulduğunuz qruplar. Dərs və tapşırıqlar qrup üzrə gəlir.',
      ru: 'Группы, к которым вы присоединились. Уроки и задания идут по группе.',
      en: 'Groups you joined. Lessons and tasks are group-based.',
    },
    actions: ['view-groups'],
  },
  '/student/exams': {
    id: 'student-exams',
    roles: ['student'],
    title: { az: 'İmtahanlarım', ru: 'Мои экзамены', en: 'My exams' },
    summary: {
      az: 'Aktiv və keçmiş imtahanlar. Müəllim link/QR ilə də dəvət edə bilər.',
      ru: 'Активные и прошлые экзамены. Учитель может пригласить ссылкой или QR.',
      en: 'Active and past exams. Your teacher can also invite via link or QR.',
    },
    actions: ['take-exam'],
  },
  '/student/schedule': {
    id: 'student-schedule',
    roles: ['student'],
    title: { az: 'Cədvəlim', ru: 'Моё расписание', en: 'My schedule' },
    summary: {
      az: 'Qrup dərslərinizin vaxtı. Ayrı «sessiya bron» səhifəsi yoxdur — dərs cədvəldə görünür.',
      ru: 'Время уроков группы. Отдельной страницы бронирования сессий нет.',
      en: 'Your group lesson times. There is no separate session-booking page.',
    },
    actions: ['view-schedule'],
  },
  '/search': {
    id: 'mentor-search',
    roles: ['student', 'instructor', 'admin'],
    title: { az: 'Müəllim tap', ru: 'Найти преподавателя', en: 'Find a teacher' },
    summary: {
      az: 'Xəritə və filterlərlə müəllim axtarın. Profilə keçin; əlaqə üçün sorğu göndərin. Sistemdə calendar booking yoxdur.',
      ru: 'Поиск учителей на карте и фильтрами. Откройте профиль и отправьте заявку. Отдельного бронирования слотов нет.',
      en: 'Search teachers on the map and with filters. Open a profile and send an inquiry. There is no calendar booking product.',
    },
    actions: ['filter-teachers', 'open-teacher-profile', 'send-inquiry'],
  },
  '/admin': {
    id: 'admin-home',
    roles: ['admin'],
    title: { az: 'CEO Dashboard', ru: 'CEO Dashboard', en: 'CEO Dashboard' },
    summary: {
      az: 'Platformanın nəbzi: qeydiyyat, onlayn istifadəçilər və növbədəki işlər.',
      ru: 'Пульс платформы: регистрации, онлайн и очередь задач.',
      en: 'Platform pulse: signups, online users and pending work.',
    },
    actions: ['open-analytics', 'open-instructors'],
  },
  '/admin/analytics': {
    id: 'admin-analytics',
    roles: ['admin'],
    title: { az: 'Analitika', ru: 'Аналитика', en: 'Analytics' },
    summary: {
      az: 'Trafik, konversiya və platforma KPI-ləri. Dövr filteri səhifənin yuxarısındadır.',
      ru: 'Трафик, конверсия и KPI платформы. Фильтр периода сверху.',
      en: 'Traffic, conversion and platform KPIs. Period filter is at the top.',
    },
    actions: ['filter-period'],
  },
  '/admin/instructors': {
    id: 'admin-instructors',
    roles: ['admin'],
    title: { az: 'Müəllimlər', ru: 'Преподаватели', en: 'Instructors' },
    summary: {
      az: 'Hesab statusu (Aktiv), paket və marketplace təsdiqi (discover_verified).',
      ru: 'Статус аккаунта, тариф и подтверждение маркетплейса.',
      en: 'Account status, plan and marketplace verification.',
    },
    actions: ['verify-marketplace'],
  },
}

export const FAQ = [
  {
    q: { az: 'müəllim tap axtar filter seç bron', ru: 'найти преподавателя поиск фильтр бронь', en: 'find teacher search filter book session' },
    a: {
      az: 'Açıq səhifə: /search (Müəllim tap). Filter, xəritə və müəllim profili. Sessiya bronu yoxdur — sorğu və ya WhatsApp göndərilir.',
      ru: 'Страница /search. Карта, фильтры и профиль. Бронирования слотов нет — заявка или WhatsApp.',
      en: 'Use /search. Map, filters and profile. No slot booking — send an inquiry or WhatsApp.',
    },
  },
  {
    q: { az: 'telefon sms otp google qeydiyyat', ru: 'телефон смс otp google регистрация', en: 'phone sms otp google signup' },
    a: {
      az: 'Müəllim Google ilə qeydiyyatda SMS almır. Telefon qrup/imtahan/tələbə əlavə edəndə OTP ilə təsdiqlənir.',
      ru: 'При Google-регистрации SMS не уходит. Телефон подтверждается OTP при группе, экзамене или добавлении ученика.',
      en: 'Google signup does not send SMS. Phone OTP is required when creating a group, exam or adding a student.',
    },
  },
  {
    q: { az: 'fənn profil xəritə pin axtarış tənzimləmə', ru: 'предмет профиль карта пин поиск настройки', en: 'subject profile map pin search settings' },
    a: {
      az: 'Müəllim → Tənzimləmələr → axtarış profili. Fənn, format və xəritə pini «Müəllim tap» üçün lazımdır.',
      ru: 'Преподаватель → Настройки → профиль поиска. Предмет, формат и пин нужны для выдачи.',
      en: 'Instructor → Settings → search profile. Subject, format and map pin are required to appear in search.',
    },
  },
  {
    q: { az: 'cədvəl dərs sessiya calendar', ru: 'расписание урок сессия календарь', en: 'schedule lesson session calendar' },
    a: {
      az: 'Dərslər Cədvəl səhifəsində planlaşır (/instructor/schedule və ya /student/schedule). Ayrı «Sessions» və calendar booking yoxdur.',
      ru: 'Уроки в разделе Расписание. Отдельной страницы Sessions нет.',
      en: 'Lessons live under Schedule. There is no separate Sessions or calendar-booking product.',
    },
  },
  {
    q: { az: 'imtahan qr link nəticə', ru: 'экзамен qr ссылка результат', en: 'exam qr link result' },
    a: {
      az: 'Müəllim imtahanı /instructor/exams-də yaradır. Tələbə /student/exams-də görür və ya link/QR ilə qoşulur.',
      ru: 'Учитель создаёт экзамен в /instructor/exams. Ученик видит его в /student/exams или по ссылке/QR.',
      en: 'Teachers create exams at /instructor/exams. Students open /student/exams or join via link/QR.',
    },
  },
  {
    q: { az: 'qrup tələbə əlavə crm', ru: 'группа ученик добавить crm', en: 'group student add crm' },
    a: {
      az: 'Müəllim tələbəni /instructor/students-də əlavə edir və ya dəvət linki göndərir. Tələbə qruplarını /student/groups-də görür.',
      ru: 'Учитель добавляет ученика в /instructor/students или шлёт ссылку. Ученик видит группы в /student/groups.',
      en: 'Teachers add students at /instructor/students or send an invite. Students see groups at /student/groups.',
    },
  },
  {
    q: { az: 'admin analitika marketplace təsdiq aktiv', ru: 'админ аналитика маркетплейс подтверждение актив', en: 'admin analytics marketplace verify active' },
    a: {
      az: 'Admin Dashboard nəbzdir. Analitika trafik üçündür. Müəllimlər səhifəsində Aktiv hesab və Marketplace təsdiqi ayrıdır.',
      ru: 'Админ-дашборд — пульс. Аналитика — трафик. На странице преподавателей Active и marketplace verification разделены.',
      en: 'Admin dashboard is pulse. Analytics is traffic. On Instructors, Active account and marketplace verification are separate.',
    },
  },
]

export function loc(map, locale) {
  if (!map || typeof map === 'string') return map || ''
  const lang = locale === 'ru' ? 'ru' : locale === 'en' ? 'en' : 'az'
  return map[lang] || map.az || map.en || ''
}

export function pageForRoute(pathname) {
  const path = String(pathname || '').replace(/\/+$/, '') || '/'
  if (PAGES[path]) return { route: path, ...PAGES[path] }
  const hit = Object.keys(PAGES)
    .filter((k) => k !== '/' && path.startsWith(k))
    .sort((a, b) => b.length - a.length)[0]
  if (hit) return { route: hit, ...PAGES[hit] }
  return null
}

export function availableActions(role, pathname) {
  const page = pageForRoute(pathname)
  if (!page || (page.roles && !page.roles.includes(role))) return []
  return page.actions || []
}

/** Structured payload the Digital Mentor (and Ask AI) is allowed to use. */
export function buildMentorContext({
  userRole,
  currentRoute,
  onboardingStep = null,
  completedSteps = [],
  locale = 'az',
} = {}) {
  const page = pageForRoute(currentRoute)
  const roleOk = ROLES.includes(userRole)
  return {
    userRole: roleOk ? userRole : null,
    currentRoute: currentRoute || null,
    currentPage: page?.id || null,
    onboardingStep: onboardingStep || null,
    completedSteps: Array.isArray(completedSteps) ? completedSteps : [],
    availableActions: roleOk ? availableActions(userRole, currentRoute) : [],
    pageTitle: page ? loc(page.title, locale) : null,
    pageSummary: page ? loc(page.summary, locale) : null,
    notInProduct: NOT_IN_PRODUCT,
  }
}
