/** Role-based UI walkthrough. Targets must exist as data-mentor-id in the live UI. */

export const FLOWS = {
  instructor: [
    {
      id: 'welcome',
      route: '/instructor',
      target: null,
      title: { az: 'Xoş gəlmisiniz', ru: 'Добро пожаловать', en: 'Welcome' },
      body: {
        az: 'Mən Mentorix Digital Mentoram. Qısa tur: dashboard, axtarış profili, tələbələr və cədvəl. İstəyəndə keçin və ya sonra davam edin.',
        ru: 'Я Digital Mentor Mentorix. Короткий тур: панель, профиль поиска, ученики и расписание. Можно пропустить и продолжить позже.',
        en: 'I am the Mentorix Digital Mentor. A short tour: dashboard, search profile, students and schedule. Skip anytime and resume later.',
      },
    },
    {
      id: 'dashboard',
      route: '/instructor',
      target: 'page:instructor-home',
      title: { az: 'Dashboard nə üçündür', ru: 'Зачем нужна панель', en: 'What the dashboard is for' },
      body: {
        az: 'Burada bu ayın gəliri, aktiv tələbələr və imtahan ortalaması görünür. Növbəti vacib addım: axtarışda görünmək üçün profili doldurmaq.',
        ru: 'Здесь доход, ученики и средний балл. Следующий шаг — заполнить профиль поиска.',
        en: 'Income, active students and exam average live here. Next: complete your search profile so parents can find you.',
      },
    },
    {
      id: 'nav-settings',
      route: '/instructor',
      target: 'nav:/instructor/settings',
      waitForClick: true,
      title: { az: 'Tənzimləmələrə keçin', ru: 'Откройте настройки', en: 'Open Settings' },
      body: {
        az: 'Soldakı «Tənzimləmələr»ə klikləyin. Fənn və xəritə pini oradadır.',
        ru: 'Нажмите «Настройки» слева. Там предметы и пин на карте.',
        en: 'Click Settings in the sidebar. Subjects and map pin are there.',
      },
    },
    {
      id: 'discover-profile',
      route: '/instructor/settings',
      target: 'page:discover-profile',
      title: { az: 'Axtarış profili', ru: 'Профиль поиска', en: 'Search profile' },
      body: {
        az: 'Ən azı bir fənn, dərs formatı və xəritə pini seçin. Bunlar olmadan «Müəllim tap»-da zəif görünürsünüz.',
        ru: 'Выберите предмет, формат и пин. Без этого вас слабо видно в поиске.',
        en: 'Add at least one subject, a lesson format and a map pin. Otherwise you barely appear in Find a teacher.',
      },
    },
    {
      id: 'nav-students',
      route: '/instructor/settings',
      target: 'nav:/instructor/students',
      waitForClick: true,
      title: { az: 'Tələbələr', ru: 'Ученики', en: 'Students' },
      body: {
        az: 'Tələbə əlavə etmək üçün bu menyuya keçin. İlk dəfə telefon OTP istəyə bilər — qeydiyyat SMS-i deyil.',
        ru: 'Чтобы добавить ученика, откройте этот пункт. Может запросить OTP телефона — это не SMS регистрации.',
        en: 'Open Students to add learners. Phone OTP may appear — that is not a signup SMS.',
      },
    },
    {
      id: 'students',
      route: '/instructor/students',
      target: 'page:instructor-students',
      title: { az: 'Tələbə siyahısı', ru: 'Список учеников', en: 'Student list' },
      body: {
        az: 'CRM tələbələrini əlavə edin, qrupa bağlayın, paketi seçin. Dəvət linki də buradandır.',
        ru: 'Добавляйте учеников CRM, привязывайте к группе и тарифу. Есть и ссылка-приглашение.',
        en: 'Add CRM students, attach a group and plan. Invite links are here too.',
      },
    },
    {
      id: 'nav-schedule',
      route: '/instructor/students',
      target: 'nav:/instructor/schedule',
      waitForClick: true,
      title: { az: 'Cədvəl', ru: 'Расписание', en: 'Schedule' },
      body: {
        az: 'Dərslər burada planlaşır. Ayrı «sessiya bron» ekranı yoxdur.',
        ru: 'Уроки планируются здесь. Отдельного бронирования сессий нет.',
        en: 'Lessons are planned here. There is no separate session-booking screen.',
      },
    },
    {
      id: 'schedule',
      route: '/instructor/schedule',
      target: 'page:instructor-schedule',
      title: { az: 'Dərs cədvəli', ru: 'Сетка уроков', en: 'Lesson grid' },
      body: {
        az: 'Həftəlik slotlar və qrup dərsləri. Valideynlə calendar booking yoxdur — cədvəl sizin panelinizdir.',
        ru: 'Недельная сетка и уроки групп. Календарной записи для родителей нет.',
        en: 'Weekly slots and group lessons. There is no parent-facing calendar booking.',
      },
    },
    {
      id: 'finish',
      route: '/instructor',
      target: null,
      title: { az: 'Hazırsınız', ru: 'Готово', en: 'You are set' },
      body: {
        az: 'Əsas menyunu tanıdınız. Sualınız olanda yaşıl Mentor düyməsindən «AI-dən soruş» seçin — yalnız real Mentorix funksiyalarını izah edirəm.',
        ru: 'Базовое меню вы знаете. Вопросы — кнопка Mentor → Спросить ИИ. Я не выдумываю функции.',
        en: 'You know the core menu. Use Mentor → Ask AI for questions. I only explain real Mentorix features.',
      },
    },
  ],
  student: [
    {
      id: 'welcome',
      route: '/student',
      target: null,
      title: { az: 'Xoş gəlmisiniz', ru: 'Добро пожаловать', en: 'Welcome' },
      body: {
        az: 'Mentorix tələbə paneli: qrup, imtahan, tapşırıq və cədvəl. Qısa turla tanış olaq.',
        ru: 'Панель ученика: группа, экзамен, задания и расписание.',
        en: 'Student panel: groups, exams, tasks and schedule. A short tour.',
      },
    },
    {
      id: 'dashboard',
      route: '/student',
      target: 'page:student-home',
      title: { az: 'Proqresiniz', ru: 'Ваш прогресс', en: 'Your progress' },
      body: {
        az: 'Bu səhifə imtahan və nəticələrin icmalıdır. Növbəti vacib yer: Qruplarım.',
        ru: 'Обзор экзаменов и результатов. Дальше — «Мои группы».',
        en: 'This is your exam overview. Next important place: My groups.',
      },
    },
    {
      id: 'nav-groups',
      route: '/student',
      target: 'nav:/student/groups',
      waitForClick: true,
      title: { az: 'Qruplarım', ru: 'Мои группы', en: 'My groups' },
      body: {
        az: 'Dərs və tapşırıqlar qrup üzrə gəlir. Müəllim sizi qrupa əlavə edir və ya dəvət linki göndərir.',
        ru: 'Уроки и задания идут по группе. Учитель добавляет вас или шлёт ссылку.',
        en: 'Lessons and tasks are per group. Your teacher adds you or sends an invite link.',
      },
    },
    {
      id: 'groups',
      route: '/student/groups',
      target: 'page:student-groups',
      title: { az: 'Qrup siyahısı', ru: 'Список групп', en: 'Group list' },
      body: {
        az: 'Aktiv qrupu seçin. Çat, tapşırıq və imtahan bu qrupa bağlıdır.',
        ru: 'Выберите активную группу. Чат, задания и экзамены привязаны к ней.',
        en: 'Pick the active group. Chat, tasks and exams are scoped to it.',
      },
    },
    {
      id: 'nav-exams',
      route: '/student/groups',
      target: 'nav:/student/exams',
      waitForClick: true,
      title: { az: 'İmtahanlar', ru: 'Экзамены', en: 'Exams' },
      body: {
        az: 'Aktiv imtahanlar buradadır. Link/QR ilə də qoşula bilərsiniz.',
        ru: 'Активные экзамены здесь. Можно войти по ссылке или QR.',
        en: 'Active exams live here. You can also join via link or QR.',
      },
    },
    {
      id: 'exams',
      route: '/student/exams',
      target: 'page:student-exams',
      title: { az: 'İmtahanlarım', ru: 'Мои экзамены', en: 'My exams' },
      body: {
        az: 'Başlamaq, nəticəyə baxmaq və materialı oxumaq bu siyahıdandır.',
        ru: 'Старт, результаты и материалы — в этом списке.',
        en: 'Start, results and materials are in this list.',
      },
    },
    {
      id: 'nav-schedule',
      route: '/student/exams',
      target: 'nav:/student/schedule',
      waitForClick: true,
      title: { az: 'Cədvəl', ru: 'Расписание', en: 'Schedule' },
      body: {
        az: 'Dərs saatları burada. Mentorix-də ayrıca «sessiya bron et» yoxdur.',
        ru: 'Время уроков здесь. Отдельной записи на сессию нет.',
        en: 'Lesson times are here. Mentorix has no separate session booking.',
      },
    },
    {
      id: 'schedule',
      route: '/student/schedule',
      target: 'page:student-schedule',
      title: { az: 'Dərs vaxtları', ru: 'Время уроков', en: 'Lesson times' },
      body: {
        az: 'Qrupunuzun həftəlik dərsləri. Vaxtı müəllim təyin edir.',
        ru: 'Недельные уроки вашей группы. Время задаёт учитель.',
        en: 'Your group’s weekly lessons. Your teacher sets the times.',
      },
    },
    {
      id: 'mentor-search',
      route: '/search',
      target: 'page:mentor-search',
      title: { az: 'Müəllim tap', ru: 'Найти преподавателя', en: 'Find a teacher' },
      body: {
        az: 'Filter və xəritə ilə müəllim seçin, profilə keçin, sorğu göndərin. Calendar booking yoxdur.',
        ru: 'Фильтры и карта, затем профиль и заявка. Бронирования слотов нет.',
        en: 'Filter and map, open a profile, send an inquiry. No calendar booking.',
      },
    },
    {
      id: 'finish',
      route: '/student',
      target: null,
      title: { az: 'Hazırsınız', ru: 'Готово', en: 'You are set' },
      body: {
        az: 'Əsas yerləri bildiniz. Sual üçün yaşıl Mentor düyməsi → AI-dən soruş.',
        ru: 'Базовые разделы вы знаете. Вопросы — Mentor → Спросить ИИ.',
        en: 'You know the core areas. Questions: Mentor → Ask AI.',
      },
    },
  ],
  admin: [
    {
      id: 'welcome',
      route: '/admin',
      target: null,
      title: { az: 'Xoş gəlmisiniz', ru: 'Добро пожаловать', en: 'Welcome' },
      body: {
        az: 'Admin paneli platformanın idarəsidir. Dashboard, analitika və müəllimlər — qısa tur.',
        ru: 'Админ-панель. Короткий тур: дашборд, аналитика, преподаватели.',
        en: 'Admin console. Short tour: dashboard, analytics, instructors.',
      },
    },
    {
      id: 'dashboard',
      route: '/admin',
      target: 'page:admin-home',
      title: { az: 'CEO Dashboard', ru: 'CEO Dashboard', en: 'CEO Dashboard' },
      body: {
        az: 'Bu günün qeydiyyatı, onlayn istifadəçilər və növbədəki işlər. Detallı trafik üçün Analitika.',
        ru: 'Регистрации, онлайн и очередь. Трафик — в Аналитике.',
        en: 'Today’s signups, online users and pending work. Traffic lives in Analytics.',
      },
    },
    {
      id: 'nav-analytics',
      route: '/admin',
      target: 'nav:/admin/analytics',
      waitForClick: true,
      title: { az: 'Analitika', ru: 'Аналитика', en: 'Analytics' },
      body: {
        az: 'Soldan Analitika açın. Dövr filteri, ziyarətçi KPI və funnel oradadır.',
        ru: 'Откройте Аналитику слева. Фильтр периода, KPI и воронка.',
        en: 'Open Analytics in the sidebar. Period filter, visitor KPIs and funnel.',
      },
    },
    {
      id: 'analytics',
      route: '/admin/analytics',
      target: 'page:admin-analytics',
      title: { az: 'Trafik KPI', ru: 'KPI трафика', en: 'Traffic KPIs' },
      body: {
        az: 'Dövrü yuxarıdakı tapdan seçin. Kartlar gündüz rejimində də oxunaqlıdır.',
        ru: 'Период — вкладками сверху. Карточки читаются и в светлой теме.',
        en: 'Pick the period with the tabs at the top. Cards stay readable in light mode.',
      },
    },
    {
      id: 'nav-instructors',
      route: '/admin/analytics',
      target: 'nav:/admin/instructors',
      waitForClick: true,
      title: { az: 'Müəllimlər', ru: 'Преподаватели', en: 'Instructors' },
      body: {
        az: 'Aktiv hesab, paket və marketplace təsdiqi buradadır.',
        ru: 'Активность, тариф и подтверждение маркетплейса.',
        en: 'Active accounts, plans and marketplace verification.',
      },
    },
    {
      id: 'instructors',
      route: '/admin/instructors',
      target: 'page:admin-instructors',
      title: { az: 'Müəllim idarəsi', ru: 'Управление преподавателями', en: 'Instructor admin' },
      body: {
        az: '«Aktiv» hesabı açır/bağlayır. «Marketplace təsdiqli» isə axtarışda görünməyə aiddir.',
        ru: '«Актив» включает аккаунт. Marketplace verification — для выдачи в поиске.',
        en: 'Active toggles the account. Marketplace verification is about search visibility.',
      },
    },
    {
      id: 'finish',
      route: '/admin',
      target: null,
      title: { az: 'Hazırsınız', ru: 'Готово', en: 'You are set' },
      body: {
        az: 'Sual olanda Mentor → AI-dən soruş. Yalnız real admin səhifələrini izah edirəm.',
        ru: 'Вопросы — Mentor → Спросить ИИ. Только реальные разделы админки.',
        en: 'Questions: Mentor → Ask AI. I only cover real admin pages.',
      },
    },
  ],
}

export function flowForRole(role) {
  const steps = FLOWS[role]
  return Array.isArray(steps) ? { role, steps } : null
}

export function stepIndex(role, stepId) {
  const flow = flowForRole(role)
  if (!flow) return -1
  return flow.steps.findIndex((s) => s.id === stepId)
}
