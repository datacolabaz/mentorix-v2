/** Public SEO landing copy — az / ru / en */

const featuresAz = [
  { title: 'Tapşırıq idarəetməsi', text: 'Ev işi təyini, onlayn təslim, müəllim rəyi və valideyn kabinetində nəticə görünüşü.' },
  { title: 'İmtahan sistemi', text: 'Onlayn testlər: QR kod və ya linklə paylaşın, avtomatik qiymətləndirmə və analitika.' },
  { title: 'Çat və ünsiyyət', text: 'Qrup və fərdi çat — müəllim, tələbə və valideyn arasında sürətli ünsiyyət.' },
  { title: 'Ödəniş və valideyn bildirişləri', text: 'Ödəniş izləmə, avtomatik SMS xatırlatmaları və valideynlə nəticə paylaşımı.' },
  { title: 'Müəllim marketplace', text: 'Müəllim və təlimçi profilləri ictimai xəritədə — tələbələr və valideynlər üçün axtarış.' },
]
const featuresRu = [
  { title: 'Задания', text: 'Домашние задания, онлайн-сдача, отзыв преподавателя и результаты в кабинете родителя.' },
  { title: 'Экзамены', text: 'Онлайн-тесты: делитесь QR-кодом или ссылкой, автоматическая оценка и аналитика.' },
  { title: 'Чат', text: 'Групповой и личный чат — быстрая связь преподавателя, ученика и родителя.' },
  { title: 'Оплаты и уведомления', text: 'Учёт оплат, SMS-напоминания и отправка результатов родителям.' },
  { title: 'Каталог преподавателей', text: 'Профили преподавателей на публичной карте — поиск для учеников и родителей.' },
]
const featuresEn = [
  { title: 'Assignments', text: 'Set homework, collect online submissions, give feedback, and show results in the parent cabinet.' },
  { title: 'Exams', text: 'Online tests: share via QR or link, auto-grade, and review analytics.' },
  { title: 'Chat', text: 'Group and private chat between teacher, student, and parent.' },
  { title: 'Payments and parent alerts', text: 'Track payments, send SMS reminders, and share results with parents.' },
  { title: 'Teacher marketplace', text: 'Teacher profiles on a public map for students and parents to search.' },
]

const benefitsAz = [
  'Tələbələrinizi və tədris qruplarınızı rahat idarə edin',
  'Tapşırıq və imtahan hazırlayın, QR kod və ya linklə paylaşın',
  'İmtahan nəticələrini avtomatik qiymətləndirin və analiz edin',
  'Tələbələrin nəticələrini diaqramlar və statistik göstəricilər ilə izləyin',
  'Hansı mövzularda zəiflik olduğunu analiz edin',
  'Dərs saatlarını və tələbə iştirakını izləyin',
  'Ödəniş tarixlərini idarə edin və avtomatik xatırlatmalar göndərin',
  'Valideynlərlə tələbənin nəticələrini paylaşın',
  'Tələbələrə ödəniş və imtahan nəticələri barədə SMS bildirişləri göndərin',
]
const benefitsRu = [
  'Управляйте учениками и учебными группами',
  'Создавайте задания и экзамены, делитесь QR-кодом или ссылкой',
  'Автоматически оценивайте и анализируйте результаты',
  'Смотрите результаты на графиках и в статистике',
  'Видьте слабые темы учеников',
  'Отслеживайте уроки и посещаемость',
  'Ведите сроки оплаты и отправляйте напоминания',
  'Делитесь результатами с родителями',
  'Отправляйте SMS об оплате и результатах экзаменов',
]
const benefitsEn = [
  'Manage students and teaching groups',
  'Create assignments and exams, share by QR or link',
  'Auto-grade exams and review the results',
  'Track progress with charts and stats',
  'See which topics need more work',
  'Track lessons and attendance',
  'Manage payment dates and send reminders',
  'Share results with parents',
  'Send SMS about payments and exam results',
]

function pagesAz() {
  return {
    muellimler_ucun: {
      title: 'Mentorix — onlayn imtahan və qiymətləndirmə',
      description: 'Testlərinizi yaradın, imtahanları idarə edin və nəticələri bir platformadan izləyin. Müəllim, tələbə və valideyn — hamısı bir yerdə. Pulsuz başlayın.',
      h1: 'Müəllimlər və təhsil xidməti təminatçıları üçün Mentorix',
      intro: [
        'Tapşırıq və imtahan yaradın, çatla ünsiyyət qurun, ödənişləri izləyin və valideynlərə avtomatik bildiriş göndərin.',
        'Testlərinizi yaradın, imtahanları idarə edin və nəticələri bir platformadan izləyin. Müəllim, tələbə və valideyn — hamısı bir yerdə. Pulsuz başlayın.',
      ],
      bullets: [],
      ctaLabel: 'Pulsuz başla — 14 günlük sınaq',
    },
    imtahanlar: {
      title: 'İmtahan və test sistemi — Mentorix',
      description: 'Mentorix imtahan platforması: onlayn testlər hazırlayın, QR kod və ya linklə paylaşın, nəticələri avtomatik qiymətləndirin və analiz edin.',
      h1: 'İmtahan və onlayn test sistemi',
      intro: [
        'Müəllimlər və təhsil xidməti təminatçıları üçün tam funksional imtahan platforması — sual bankı, vaxt limiti, avtomatik yoxlama və nəticə analitikası.',
        'Tələbələr link və ya QR kod ilə qoşula bilər; qonaq iştirakı dəstəklənir.',
      ],
      bullets: [
        'Çoxseçimli, açıq cavab və fayl yükləmə sualları',
        'Avtomatik bal hesablanması və AI dəstəkli yoxlama',
        'Qrup və fərdi imtahan paylaşımı',
      ],
      ctaLabel: 'Müəllim kimi başla',
    },
    tapshiriqlar: {
      title: 'Tapşırıq sistemi — Mentorix',
      description: 'Ev tapşırıqları təyin edin, tələbələr onlayn təslim etsin, müəllim yoxlasın və rəy yazsın.',
      h1: 'Tapşırıq və ev işi sistemi',
      intro: [
        'Tapşırıqları qruplara və ya fərdi tələbələrə təyin edin, son tarix qoyun və təslimləri bir paneldə izləyin.',
        'Link ilə qonaq tələbələr də qoşula bilər.',
      ],
      bullets: ['Tapşırıq faylı və təsvir paylaşımı', 'Təslim, gecikmə və müəllim rəyi', 'Valideyn kabinetində nəticə görünüşü'],
      ctaLabel: 'Tapşırıq yarat',
    },
    kurslar_ve_qruplar: {
      title: 'Qruplar və dərs paketləri — Mentorix',
      description: 'Tədris qrupları, dərs paketləri, cədvəl və tələbə qoşulma linkləri.',
      h1: 'Qruplar və dərs paketləri',
      intro: [
        'Qrup yaradın, paket və qiymət təyin edin, dəvət linki ilə tələbələri qoşun.',
        'Hər qrup üçün ayrıca cədvəl, ödəniş və davamiyyət izləməsi.',
      ],
      bullets: ['8 və 12 dərs paketləri', 'Join link və QR ilə tələbə qəbulu', 'Qrup üzrə imtahan və tapşırıq təyini'],
      ctaLabel: 'Qrup yarat',
    },
    qiymetler: {
      title: 'Qiymətlər — Mentorix paketləri',
      description: 'Müəllim / təlimçi və təşkilat paketləri.',
      h1: 'Qiymətlər',
      intro: ['Paketlər auditoriyaya görə qruplaşdırılıb: müəllim / təlimçi və təşkilat. İştirakçı hesabları pulsuzdur.'],
      bullets: [],
      ctaLabel: 'Pulsuz başla',
    },
    telebeler_ucun: {
      title: 'Tələbələr üçün Mentorix',
      description: 'Tələbə kabineti: imtahan, tapşırıq, cədvəl və ödəniş tarixləri.',
      h1: 'Tələbələr üçün Mentorix',
      intro: [
        'Müəlliminiz sizi Mentorix-ə dəvət edəndə imtahan, tapşırıq və cədvəl bir kabinetdə toplanır.',
        'Link və ya QR kod ilə imtahana və tapşırığa qoşula bilərsiniz — tələbə kabineti pulsuzdur.',
      ],
      bullets: ['İmtahan və tapşırıq təslimi', 'Dərs cədvəli və bildirişlər', 'Ödəniş tarixləri və nəticələr'],
      ctaLabel: 'Tələbə girişi',
    },
    haqqimizda: {
      title: 'Haqqımızda — Mentorix',
      description: 'Mentorix müəllim, tələbə və valideynləri birləşdirən təhsil ekosistemidir.',
      h1: 'Mentorix haqqında',
      intro: [
        'Mentorix sadəcə müəllim paneli deyil — müəllim, tələbə və valideynləri birləşdirən təhsil ekosistemidir.',
        'Müəllimlər tapşırıq və imtahan yaradır, ödənişləri izləyir, valideynlərə bildiriş göndərir; tələbələr və valideynlər isə pulsuz kabinet və marketplace-dən istifadə edir.',
      ],
      bullets: ['Tapşırıq və imtahan idarəetməsi', 'Çat, davamiyyət və analitika', 'Ödəniş izləmə və SMS bildirişləri', 'İctimai müəllim axtarış xəritəsi'],
      ctaLabel: 'Platformanı kəşf et',
    },
    elaqe: {
      title: 'Əlaqə — Mentorix dəstək',
      description: 'Mentorix ilə əlaqə: WhatsApp və e-poçt.',
      h1: 'Bizimlə əlaqə',
      intro: [
        'Mentorix haqqında sualınız, texniki dəstək və ya paket seçimi üçün bizimlə əlaqə saxlayın.',
        'Komanda Azərbaycan, rus və ingilis dillərində dəstək göstərir.',
      ],
      bullets: ['WhatsApp', 'E-poçt', 'Müəllimlər üçün pulsuz 14 günlük sınaq'],
      ctaLabel: 'WhatsApp ilə yazın',
    },
    repetitor_baki: {
      title: 'Repetitor Bakı — müəllim tap | Mentorix',
      description: 'Bakıda repetitor və təlimçi axtarın.',
      h1: 'Bakıda repetitor və müəllim tap',
      intro: [
        'Mentorix ictimai axtarışı Bakı və ətraf ərazilərdə fərdi müəllim, repetitor və təlimçiləri bir xəritədə göstərir.',
        'Onlayn və ya canlı format, fən və məsafəyə görə filtrləyib birbaşa müraciət edə bilərsiniz.',
      ],
      bullets: ['Xəritədə yaxınlığınızdakı müəllimlər', 'Riyaziyyat, ingilis dili, abituriyent və digər fənlər', 'Reytinq və format'],
      ctaLabel: 'Bakıda müəllim axtar',
    },
    universitet_axtarisi: {
      title: 'Universitet və proqram axtarışı | Mentorix',
      description: 'Xaricdə təhsil proqramlarını tapın.',
      h1: 'Universitet proqramı tap',
      intro: [
        'Mentorix Apply ilə xaricdə təhsil proqramlarını ölkə, sahə və büdcəyə görə müqayisə edin.',
        'Uyğun proqramı seçib rəsmi universitet portallarına keçid edin.',
      ],
      bullets: ['BSc, MSc və PhD proqramları', 'Təqaüd və son müraciət tarixi', 'Almaniya, Polşa, Türkiyə, Macarıstan, İtaliya'],
      ctaLabel: 'Proqramları axtar',
    },
    riyaziyyat_repetitoru: {
      title: 'Riyaziyyat repetitoru | Mentorix',
      description: 'Riyaziyyat repetitoru tapın.',
      h1: 'Riyaziyyat repetitoru tap',
      intro: [
        'Məktəb proqramı, DİM və abituriyent hazırlığı üçün riyaziyyat müəllimlərini filtrləyin.',
        'Yaxınlığınızdakı repetitoru seçin və müraciət göndərin.',
      ],
      bullets: ['Riyaziyyat üzrə ixtisaslaşmış müəllimlər', 'Məsafə və reytinqə görə sıralama', 'Onlayn və ya canlı dərslər'],
      ctaLabel: 'Riyaziyyat müəllimlərini gör',
    },
    ingilis_dili_repetitoru: {
      title: 'İngilis dili repetitoru | Mentorix',
      description: 'İngilis dili repetitoru tapın.',
      h1: 'İngilis dili repetitoru tap',
      intro: [
        'Məktəb ingilis dili, IELTS/TOEFL və danışıq dərsləri üçün müəllimləri axtarın.',
        'Format və məsafəyə görə filtrləyin.',
      ],
      bullets: ['Məktəb və imtahan hazırlığı', 'Onlayn və ya canlı format', 'Bakı və digər şəhərlər'],
      ctaLabel: 'İngilis dili müəllimlərini gör',
    },
  }
}

function pagesRu() {
  return {
    muellimler_ucun: {
      title: 'Mentorix — онлайн-экзамены и оценка',
      description: 'Создавайте тесты, проводите экзамены и смотрите результаты на одной платформе. Преподаватель, ученик и родитель — вместе. Начните бесплатно.',
      h1: 'Mentorix для преподавателей и образовательных сервисов',
      intro: [
        'Создавайте задания и экзамены, общайтесь в чате, контролируйте оплаты и автоматически уведомляйте родителей.',
        'Создавайте тесты, проводите экзамены и смотрите результаты на одной платформе. Преподаватель, ученик и родитель — вместе. Начните бесплатно.',
      ],
      bullets: [],
      ctaLabel: 'Начать бесплатно — 14 дней',
    },
    imtahanlar: {
      title: 'Экзамены и тесты — Mentorix',
      description: 'Платформа экзаменов Mentorix: онлайн-тесты, QR или ссылка, автоматическая оценка и аналитика.',
      h1: 'Экзамены и онлайн-тесты',
      intro: [
        'Полноценная экзаменационная платформа для преподавателей: банк вопросов, лимит времени, автопроверка и аналитика.',
        'Ученики подключаются по ссылке или QR; гостевое участие поддерживается.',
      ],
      bullets: [
        'Вопросы с выбором, открытым ответом и файлом',
        'Автоматический подсчёт баллов и проверка с ИИ',
        'Групповые и индивидуальные экзамены',
      ],
      ctaLabel: 'Начать как преподаватель',
    },
    tapshiriqlar: {
      title: 'Задания — Mentorix',
      description: 'Назначайте домашние задания, принимайте сдачу онлайн, проверяйте и пишите отзыв.',
      h1: 'Задания и домашние работы',
      intro: [
        'Назначайте задания группам или ученикам, ставьте срок и смотрите сдачу в одной панели.',
        'Гостевые ученики тоже могут подключиться по ссылке.',
      ],
      bullets: ['Файлы и описание задания', 'Сдача, опоздание и отзыв преподавателя', 'Результаты в кабинете родителя'],
      ctaLabel: 'Создать задание',
    },
    kurslar_ve_qruplar: {
      title: 'Группы и пакеты уроков — Mentorix',
      description: 'Учебные группы, пакеты уроков, расписание и ссылки для учеников.',
      h1: 'Группы и пакеты уроков',
      intro: [
        'Создайте группу, назначьте пакет и цену, пригласите учеников ссылкой.',
        'Отдельное расписание, оплаты и посещаемость для каждой группы.',
      ],
      bullets: ['Пакеты на 8 и 12 уроков', 'Приём по join-ссылке и QR', 'Экзамены и задания по группе'],
      ctaLabel: 'Создать группу',
    },
    qiymetler: {
      title: 'Цены — пакеты Mentorix',
      description: 'Пакеты для преподавателей и организаций.',
      h1: 'Цены',
      intro: ['Пакеты сгруппированы по аудитории: преподаватель / тренер и организация. Кабинеты учеников бесплатны.'],
      bullets: [],
      ctaLabel: 'Начать бесплатно',
    },
    telebeler_ucun: {
      title: 'Mentorix для учеников',
      description: 'Кабинет ученика: экзамены, задания, расписание и оплаты.',
      h1: 'Mentorix для учеников',
      intro: [
        'Когда преподаватель приглашает вас, экзамены, задания и расписание собираются в одном кабинете.',
        'Можно подключиться по ссылке или QR — кабинет ученика бесплатный.',
      ],
      bullets: ['Сдача экзаменов и заданий', 'Расписание и уведомления', 'Сроки оплаты и результаты'],
      ctaLabel: 'Вход для ученика',
    },
    haqqimizda: {
      title: 'О нас — Mentorix',
      description: 'Mentorix объединяет преподавателей, учеников и родителей.',
      h1: 'О Mentorix',
      intro: [
        'Mentorix — не только панель преподавателя, а образовательная экосистема для преподавателя, ученика и родителя.',
        'Преподаватели создают задания и экзамены, ведут оплаты и уведомляют родителей; ученики и родители пользуются бесплатными кабинетами и каталогом.',
      ],
      bullets: ['Задания и экзамены', 'Чат, посещаемость и аналитика', 'Оплаты и SMS', 'Публичная карта преподавателей'],
      ctaLabel: 'Открыть платформу',
    },
    elaqe: {
      title: 'Контакты — поддержка Mentorix',
      description: 'Свяжитесь с Mentorix: WhatsApp и email.',
      h1: 'Связаться с нами',
      intro: [
        'Вопросы о платформе, поддержка или выбор пакета — напишите нам.',
        'Команда отвечает на азербайджанском, русском и английском.',
      ],
      bullets: ['WhatsApp', 'Email', '14 дней бесплатно для преподавателей'],
      ctaLabel: 'Написать в WhatsApp',
    },
    repetitor_baki: {
      title: 'Репетитор в Баку | Mentorix',
      description: 'Найдите репетитора и преподавателя в Баку.',
      h1: 'Найти репетитора и преподавателя в Баку',
      intro: [
        'Публичный поиск Mentorix показывает преподавателей и репетиторов Баку на карте.',
        'Фильтруйте по формату, предмету и расстоянию и отправляйте заявку.',
      ],
      bullets: ['Преподаватели рядом на карте', 'Математика, английский и другие предметы', 'Рейтинг и формат занятий'],
      ctaLabel: 'Искать преподавателя в Баку',
    },
    universitet_axtarisi: {
      title: 'Поиск университетов | Mentorix',
      description: 'Найдите программы обучения за рубежом.',
      h1: 'Найти программу университета',
      intro: [
        'Сравнивайте зарубежные программы по стране, направлению и бюджету.',
        'Выберите программу и перейдите на официальный портал вуза.',
      ],
      bullets: ['Программы BSc, MSc и PhD', 'Стипендии и дедлайны', 'Германия, Польша, Турция, Венгрия, Италия'],
      ctaLabel: 'Искать программы',
    },
    riyaziyyat_repetitoru: {
      title: 'Репетитор по математике | Mentorix',
      description: 'Найдите репетитора по математике.',
      h1: 'Найти репетитора по математике',
      intro: [
        'Фильтруйте преподавателей математики для школы, ДИМ и абитуриентов.',
        'Выберите ближайшего репетитора и отправьте заявку.',
      ],
      bullets: ['Специализация по математике', 'Сортировка по расстоянию и рейтингу', 'Онлайн или очные занятия'],
      ctaLabel: 'Смотреть преподавателей математики',
    },
    ingilis_dili_repetitoru: {
      title: 'Репетитор английского | Mentorix',
      description: 'Найдите преподавателя английского.',
      h1: 'Найти репетитора английского',
      intro: [
        'Ищите преподавателей для школьной программы, IELTS/TOEFL и разговорной практики.',
        'Фильтруйте по формату и расстоянию.',
      ],
      bullets: ['Школа и подготовка к экзаменам', 'Онлайн или очно', 'Баку и другие города'],
      ctaLabel: 'Смотреть преподавателей английского',
    },
  }
}

function pagesEn() {
  return {
    muellimler_ucun: {
      title: 'Mentorix — online exams and assessment',
      description: 'Create tests, run exams, and track results in one place. Teacher, student, and parent — together. Start free.',
      h1: 'Mentorix for teachers and education providers',
      intro: [
        'Create assignments and exams, chat with students, track payments, and notify parents automatically.',
        'Create tests, run exams, and track results in one place. Teacher, student, and parent — together. Start free.',
      ],
      bullets: [],
      ctaLabel: 'Start free — 14-day trial',
    },
    imtahanlar: {
      title: 'Exams and tests — Mentorix',
      description: 'Build online tests, share by QR or link, auto-grade, and review analytics.',
      h1: 'Exams and online tests',
      intro: [
        'A full exam platform for teachers: question bank, time limits, auto-checking, and result analytics.',
        'Students join by link or QR; guest participation is supported.',
      ],
      bullets: [
        'Multiple choice, open answer, and file-upload questions',
        'Auto scoring and AI-assisted checking',
        'Group and individual exam sharing',
      ],
      ctaLabel: 'Start as a teacher',
    },
    tapshiriqlar: {
      title: 'Assignments — Mentorix',
      description: 'Assign homework, collect online submissions, review, and give feedback.',
      h1: 'Assignments and homework',
      intro: [
        'Assign work to groups or students, set due dates, and track submissions in one panel.',
        'Guest students can also join via link.',
      ],
      bullets: ['Share files and descriptions', 'Submissions, late work, and teacher feedback', 'Results in the parent cabinet'],
      ctaLabel: 'Create an assignment',
    },
    kurslar_ve_qruplar: {
      title: 'Groups and lesson packs — Mentorix',
      description: 'Teaching groups, lesson packs, schedules, and join links.',
      h1: 'Groups and lesson packs',
      intro: [
        'Create a group, set a pack and price, and invite students with a link.',
        'Each group has its own schedule, payments, and attendance.',
      ],
      bullets: ['8- and 12-lesson packs', 'Join via link or QR', 'Exams and assignments per group'],
      ctaLabel: 'Create a group',
    },
    qiymetler: {
      title: 'Pricing — Mentorix plans',
      description: 'Plans for teachers and organizations.',
      h1: 'Pricing',
      intro: ['Plans are grouped by audience: teacher / trainer and organization. Participant accounts are free.'],
      bullets: [],
      ctaLabel: 'Start free',
    },
    telebeler_ucun: {
      title: 'Mentorix for students',
      description: 'Student cabinet: exams, assignments, schedule, and payments.',
      h1: 'Mentorix for students',
      intro: [
        'When your teacher invites you, exams, assignments, and the schedule live in one cabinet.',
        'Join exams and assignments by link or QR — the student cabinet is free.',
      ],
      bullets: ['Exam and assignment submission', 'Schedule and notifications', 'Payment dates and results'],
      ctaLabel: 'Student login',
    },
    haqqimizda: {
      title: 'About Mentorix',
      description: 'Mentorix is an education ecosystem for teachers, students, and parents.',
      h1: 'About Mentorix',
      intro: [
        'Mentorix is more than a teacher panel — it connects teachers, students, and parents.',
        'Teachers create assignments and exams, track payments, and notify parents; students and parents use free cabinets and the marketplace.',
      ],
      bullets: ['Assignments and exams', 'Chat, attendance, and analytics', 'Payments and SMS', 'Public teacher map'],
      ctaLabel: 'Explore the platform',
    },
    elaqe: {
      title: 'Contact — Mentorix support',
      description: 'Reach Mentorix on WhatsApp and email.',
      h1: 'Contact us',
      intro: [
        'Questions about the platform, support, or plan choice — get in touch.',
        'The team supports Azerbaijani, Russian, and English.',
      ],
      bullets: ['WhatsApp', 'Email', '14-day free trial for teachers'],
      ctaLabel: 'Message on WhatsApp',
    },
    repetitor_baki: {
      title: 'Tutors in Baku | Mentorix',
      description: 'Find a tutor or teacher in Baku.',
      h1: 'Find a tutor and teacher in Baku',
      intro: [
        'Mentorix public search shows tutors and teachers in Baku on a map.',
        'Filter by format, subject, and distance, then apply.',
      ],
      bullets: ['Teachers near you on the map', 'Math, English, and other subjects', 'Rating and lesson format'],
      ctaLabel: 'Search teachers in Baku',
    },
    universitet_axtarisi: {
      title: 'University program search | Mentorix',
      description: 'Find study programs abroad.',
      h1: 'Find a university program',
      intro: [
        'Compare programs abroad by country, field, and budget.',
        'Pick a program and go to the official university portal.',
      ],
      bullets: ['BSc, MSc, and PhD programs', 'Scholarships and deadlines', 'Germany, Poland, Turkey, Hungary, Italy'],
      ctaLabel: 'Search programs',
    },
    riyaziyyat_repetitoru: {
      title: 'Math tutor | Mentorix',
      description: 'Find a math tutor.',
      h1: 'Find a math tutor',
      intro: [
        'Filter math teachers for school, DİM, and university prep.',
        'Choose a nearby tutor and send a request.',
      ],
      bullets: ['Math specialists', 'Sort by distance and rating', 'Online or in person'],
      ctaLabel: 'See math teachers',
    },
    ingilis_dili_repetitoru: {
      title: 'English tutor | Mentorix',
      description: 'Find an English teacher.',
      h1: 'Find an English tutor',
      intro: [
        'Search teachers for school English, IELTS/TOEFL, and speaking practice.',
        'Filter by format and distance.',
      ],
      bullets: ['School and exam prep', 'Online or in person', 'Baku and other cities'],
      ctaLabel: 'See English teachers',
    },
  }
}

function bundle(pages, features, benefits, ui) {
  return {
    publicLandings: {
      ...ui,
      features,
      benefits,
      pages,
    },
  }
}

export const publicLandingsAz = bundle(pagesAz(), featuresAz, benefitsAz, {
  ecosystem: 'təhsil ekosistemi',
  searchEyebrow: 'ictimai axtarış',
  featuresKicker: 'Əsas imkanlar',
  featuresTitle: 'Platformada nə edə bilərsiniz',
  howKicker: 'Necə işləyir',
  howTitle: 'Boş paneldən nəticəyə',
  panelFoot: 'Fərdi müəllim və ya təhsil xidməti təminatçısı — sizə uyğun paketi seçin.',
  teacherSearch: 'İctimai müəllim axtarışı',
  infoFoot: 'Mentorix müəllim, tələbə və valideynləri birləşdirən təhsil ekosistemidir.',
  freeSignup: 'Pulsuz qeydiyyat',
  infoFootAfter: 'ilə müəllim profilinizi yarada bilərsiniz.',
})

export const publicLandingsRu = bundle(pagesRu(), featuresRu, benefitsRu, {
  ecosystem: 'образовательная экосистема',
  searchEyebrow: 'публичный поиск',
  featuresKicker: 'Возможности',
  featuresTitle: 'Что можно делать на платформе',
  howKicker: 'Как это работает',
  howTitle: 'От пустой панели к результату',
  panelFoot: 'Для преподавателей и образовательных сервисов — выберите подходящий пакет.',
  teacherSearch: 'Публичный поиск преподавателей',
  infoFoot: 'Mentorix объединяет преподавателей, учеников и родителей.',
  freeSignup: 'Бесплатная регистрация',
  infoFootAfter: 'поможет создать профиль преподавателя.',
})

export const publicLandingsEn = bundle(pagesEn(), featuresEn, benefitsEn, {
  ecosystem: 'education ecosystem',
  searchEyebrow: 'public search',
  featuresKicker: 'Key features',
  featuresTitle: 'What you can do on the platform',
  howKicker: 'How it works',
  howTitle: 'From an empty panel to results',
  panelFoot: 'For individual teachers and education providers — pick the plan that fits.',
  teacherSearch: 'Public teacher search',
  infoFoot: 'Mentorix connects teachers, students, and parents.',
  freeSignup: 'Free sign-up',
  infoFootAfter: 'lets you create a teacher profile.',
})
