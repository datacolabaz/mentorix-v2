/**
 * Public homepage copy (az / en / ru), merged into the `home` namespace key by src/i18n/index.js.
 * `{{brand}}` is interpolated from the central brand config (src/config/brand.js).
 *
 * Every product statement here was checked against the code; see specs/site-audit-report.md
 * ("Məhsul iddialarının kodda yoxlanması"). Do not add user counts, testimonials, logos or
 * absolute claims ("100%") without owner-confirmed data.
 */

export const homeAz = {
  seo: {
    title: '{{brand}} — müəllimlər üçün AI əsaslı test və qiymətləndirmə platforması',
    description:
      'AI ilə dəqiqələr içində test hazırlayın, cavabları avtomatik yoxlayın və nəticələri bir paneldən izləyin. Şagirdlər link və ya QR kodla qoşulur. Pulsuz başlayın.',
    keywords:
      'onlayn test, imtahan platforması, AI sual generatoru, avtomatik qiymətləndirmə, müəllim paneli, test yaratmaq, sertifikat doğrulama',
  },
  skipLink: 'Əsas məzmuna keç',
  sampleLabel: 'Nümunə interfeys · illüstrativ məlumat',
  hero: {
    eyebrow: 'Müəllimlər üçün AI əsaslı qiymətləndirmə platforması',
    title: 'Dəqiqələr içində ağıllı testlər yaradın',
    subtitle:
      'Test hazırlayın, cavabları avtomatik yoxlayın və sinfin nəticələrini bir paneldən anlayın. Sualları AI hazırlayır — son sözü siz deyirsiniz.',
    primaryCta: 'Pulsuz test yarat',
    secondaryCta: 'Necə işlədiyini gör',
    points: [
      'Azərbaycan, rus və ingilis dilində suallar',
      'Şagirdlər tətbiq yükləmədən qoşulur',
      'Kredit kartı tələb olunmur',
    ],
    haveAccount: 'Artıq hesabınız var?',
    login: 'Daxil olun',
  },
  preview: {
    ariaLabel: 'AI sual generatorunun nümunə görünüşü',
    appTitle: 'AI sual generatoru',
    topic: 'Riyaziyyat · 6-cı sinif · Kəsrlər',
    language: 'Dil: Azərbaycan',
    questionCounter: 'Sual 3 / 10',
    difficulty: 'Orta',
    question: '½ + ¼ cəmi neçəyə bərabərdir?',
    options: ['¾', '⅔', '²⁄₆', '1'],
    correct: 'Düzgün cavab',
    edit: 'Redaktə et',
    regenerate: 'Yenidən yarat',
    approve: 'Təsdiqlə',
    approved: 'Müəllim təsdiqi gözlənilir',
    shareTitle: 'Paylaşmağa hazırdır',
    shareHint: 'Link və ya QR kod',
    resultsTitle: 'Nəticələr avtomatik hesablanır',
  },
  steps: {
    kicker: 'Necə işləyir?',
    title: 'Saatlarla sual yazmaq əvəzinə — dörd addım',
    lead: 'Test hazırlığı, yoxlama və nəticə hesabatı bir axında. Siz yalnız yoxlayır və təsdiqləyirsiniz.',
    items: [
      {
        title: 'Mövzu və səviyyəni seçin',
        body: 'Fənni, mövzunu, sinfi və sual sayını qeyd edin, sualların dilini seçin.',
      },
      {
        title: 'AI ilə suallar yaradın və redaktə edin',
        body: 'AI sualları və cavab variantlarını hazırlayır. Hər sualı oxuyun, dəyişin, yenidən yaradın və ya silin.',
      },
      {
        title: 'Link və ya QR kodu paylaşın',
        body: 'Testi sinfə link ilə göndərin və ya şagirdləri qrupa QR kodla dəvət edin. Telefon da, kompüter də olar.',
      },
      {
        title: 'Nəticələri avtomatik görün',
        body: 'Qapalı suallar dərhal yoxlanılır, ballar hesablanır. Nəticələri Excel və ya PDF kimi yükləyin.',
      },
    ],
    form: {
      subject: 'Fənn',
      subjectValue: 'Riyaziyyat',
      topic: 'Mövzu',
      topicValue: 'Kəsrlər',
      level: 'Səviyyə',
      levelValue: '6-cı sinif',
      count: 'Sual sayı',
      countValue: '10',
      language: 'Dil',
      generate: 'Sualları yarat',
    },
    share: {
      linkLabel: 'Test linki',
      copy: 'Kopyala',
      qrAlt: 'Nümunə QR kod',
    },
    results: {
      student: 'Şagird',
      score: 'Bal',
      rows: [
        ['Şagird A', '9 / 10'],
        ['Şagird B', '8 / 10'],
        ['Şagird C', '6 / 10'],
      ],
      exportExcel: 'Excel',
      exportPdf: 'PDF',
    },
    principle: {
      title: 'AI yaradır, müəllim təsdiqləyir',
      body: 'Heç bir sual siz baxmadan şagirdə getmir: AI qaralama hazırlayır, siz yoxlayır, düzəldir və dərc edirsiniz.',
    },
    student: {
      title: 'Şagird tərəfi',
      body: 'Şagird linki açır, Google hesabı ilə bir kliklə daxil olur və testi brauzerdə yazır. Tətbiq yükləmək lazım deyil.',
    },
  },
  features: {
    kicker: 'İmkanlar',
    title: 'Müəllimin vaxtını alan işləri avtomatlaşdırın',
    learnMore: 'Ətraflı bax',
    items: [
      {
        id: 'ai',
        title: 'AI sual generatoru',
        body: 'Mövzunu və çətinliyi seçin — AI sualları Azərbaycan, rus və ya ingilis dilində hazırlayır.',
        benefit: 'Test hazırlığına saatlar yox, dəqiqələr gedir.',
      },
      {
        id: 'grading',
        title: 'Avtomatik yoxlama',
        body: 'Qapalı suallar avtomatik yoxlanılır, ballar dərhal hesablanır; vaxt bitəndə cavablar özü təqdim olunur.',
        benefit: 'Kağız yoxlamağa və bal saymağa vaxt itmir.',
      },
      {
        id: 'join',
        title: 'Tətbiqsiz qoşulma',
        body: 'Şagirdlər link və ya QR kodla brauzerdən qoşulur — heç nə quraşdırmaq lazım deyil.',
        benefit: 'Şagirdlərə texniki izah verməyə ehtiyac qalmır.',
      },
      {
        id: 'results',
        title: 'Nəticələr bir paneldə',
        body: 'Hər şagirdin balını və sinfin ümumi mənzərəsini bir yerdə görün, Excel və ya PDF kimi yükləyin.',
        benefit: 'Növbəti dərsə və valideyn görüşünə hazır məlumat.',
      },
      {
        id: 'review',
        title: 'Yazılı işlərə AI rəyi',
        body: 'Tapşırıqlarda AI güclü və zəif tərəfləri göstərən rəy qaralaması hazırlayır; son qiyməti müəllim verir.',
        benefit: 'Rəy yazmaq üçün hazır başlanğıc nöqtəsi.',
      },
      {
        id: 'certificate',
        title: 'Doğrulana bilən sertifikat',
        body: 'Sertifikatlı imtahanı keçənə seriya nömrəli sertifikat verilir; QR kod onu ictimai səhifədə yoxlamağa imkan verir.',
        benefit: 'Sertifikatın həqiqiliyini istənilən şəxs yoxlaya bilir.',
      },
    ],
  },
  audiences: {
    title: 'Kimlər üçündür?',
    items: {
      teacher: {
        title: 'Müəllim və repetitorlar',
        body: 'Test yaradın, qrupları idarə edin, hər şagirdin nəticəsini izləyin.',
        cta: 'Müəllimlər üçün',
      },
      school: {
        title: 'Məktəb və təhsil mərkəzləri',
        body: 'Təşkilat panelində qruplar, təlimçilər, sual bankı və istifadəçi rolları bir yerdədir.',
        cta: 'Bizimlə əlaqə',
      },
      student: {
        title: 'Şagird və valideynlər',
        body: 'Şagird və valideyn kabineti pulsuzdur: tapşırıqlar, imtahanlar və nəticələr bir yerdə görünür.',
        cta: 'Tələbələr üçün',
      },
      mentorship: {
        title: 'Mentorluq',
        body: 'Məqsədinizə uyğun mentor tapın və inkişaf planı qurun.',
        cta: 'Mentor tap',
      },
    },
  },
  trust: {
    kicker: 'Etibar',
    title: 'Necə işlədiyimizi açıq deyirik',
    items: {
      privacy: {
        title: 'Məlumatların qorunması',
        body: 'Şəxsi məlumatların necə toplandığı və istifadə olunduğu Məxfilik siyasətində və İstifadə şərtlərində açıq yazılıb.',
        privacy: 'Məxfilik siyasəti',
        terms: 'İstifadə şərtləri',
      },
      certificate: {
        title: 'Sertifikat necə doğrulanır?',
        body: 'Hər sertifikatın unikal seriya nömrəsi və QR kodu var. Doğrulama səhifəsi onun etibarlı, yenilənmiş və ya ləğv edilmiş olduğunu göstərir. Sertifikatı {{brand}} platforması verir; bu, dövlət akkreditasiyası deyil.',
        cta: 'Sertifikatlı imtahanlar',
      },
      support: {
        title: 'Azərbaycan dilində dəstək',
        body: 'Platforma, qoşulma və ya hesabla bağlı suallarınız üçün bizə yazın.',
        whatsapp: 'WhatsApp',
        email: 'E-poçt',
      },
    },
    placeholders: {
      badge: 'Placeholder — production-da gizlidir',
      note: 'Real məlumat məhsul sahibi tərəfindən təsdiqlənənə qədər göstərilmir.',
      testimonials: 'Müəllim və məktəb rəyləri (adlı, razılıqla)',
      stats: 'İstifadəçi və yaradılmış test sayı (real məlumatdan)',
      logos: 'Məktəb / tərəfdaş loqoları (yazılı icazə ilə)',
      stories: 'Uğur hekayələri',
      team: 'Şirkət və komanda haqqında qısa məlumat',
    },
  },
  faq: {
    title: 'Tez-tez verilən suallar',
    items: [
      {
        q: '{{brand}} nədir?',
        a: '{{brand}} müəllimlər üçün AI əsaslı test və qiymətləndirmə platformasıdır: sualları hazırlamağa kömək edir, cavabları avtomatik yoxlayır və nəticələri bir paneldə göstərir.',
      },
      {
        q: 'AI-ın hazırladığı sualları dəyişə bilərəmmi?',
        a: 'Bəli. AI qaralama hazırlayır — hər sualı dərc etməzdən əvvəl oxuyub redaktə edə, yenidən yarada və ya silə bilərsiniz. Şagirdə yalnız sizin təsdiqlədiyiniz suallar gedir.',
      },
      {
        q: 'Hansı dillərdə sual yaratmaq olar?',
        a: 'Azərbaycan, rus və ingilis dillərində. İnterfeys də bu üç dildə mövcuddur.',
      },
      {
        q: 'Şagirdlər tətbiq yükləməlidirmi?',
        a: 'Xeyr. Şagird linki və ya QR kodu açır, Google hesabı ilə daxil olur və testi brauzerdə yazır.',
      },
      {
        q: 'Cavablar necə yoxlanılır?',
        a: 'Qapalı suallar avtomatik yoxlanılır və ballar dərhal hesablanır. Açıq cavabları müəllim qiymətləndirir; yazılı tapşırıqlarda AI rəy qaralaması təklif edir.',
      },
      {
        q: 'Sertifikatı kim verir və necə yoxlanılır?',
        a: 'Sertifikatı {{brand}} platforması verir. Üzərindəki QR kod və ya link ictimai doğrulama səhifəsini açır: orada seriya nömrəsi və statusu (etibarlı, yenilənib, ləğv edilib) görünür. Bu, dövlət akkreditasiyası deyil.',
      },
      {
        q: 'Məktəb və ya təhsil mərkəzi kimi istifadə edə bilərikmi?',
        a: 'Bəli. Təşkilat panelində qrupları, təlimçiləri, sual bankını və istifadəçi rollarını bir yerdən idarə edə bilərsiniz.',
      },
      {
        q: 'Pulsuz başlamaq olarmı?',
        a: 'Bəli, qeydiyyat pulsuzdur və kredit kartı tələb olunmur. Paketlər və limitlər Qiymətlər səhifəsindədir.',
      },
    ],
  },
  certified: {
    disclaimer: 'Sertifikatları {{brand}} platforması verir və QR kodla doğrulanır. Bu, dövlət akkreditasiyası deyil.',
  },
  cta: {
    title: 'İlk testinizi bu gün yaradın',
    body: 'Qeydiyyat pulsuzdur, kredit kartı tələb olunmur.',
    primary: 'Pulsuz başla',
    pricing: 'Qiymətlərə bax',
  },
  footer: {
    product: 'Məhsul',
    company: 'Şirkət',
    legal: 'Hüquqi',
    contact: 'Əlaqə',
    discover: 'Kəşf et',
    certifiedExams: 'Sertifikatlı imtahanlar',
    tagline: '{{brand}} — müəllimlər üçün AI əsaslı test və qiymətləndirmə platforması.',
    copyright: '© {{year}} {{brand}}. Bütün hüquqlar qorunur.',
    whatsapp: 'WhatsApp',
    email: 'E-poçt',
  },
}

export const homeEn = {
  seo: {
    title: '{{brand}} — AI-powered testing and assessment platform for teachers',
    description:
      'Create tests in minutes with AI, grade answers automatically and track results in one dashboard. Students join with a link or QR code. Start for free.',
    keywords:
      'online test, exam platform, AI question generator, automatic grading, teacher dashboard, create a test, certificate verification',
  },
  skipLink: 'Skip to main content',
  sampleLabel: 'Sample interface · illustrative data',
  hero: {
    eyebrow: 'AI-powered assessment platform for teachers',
    title: 'Create smart tests in minutes',
    subtitle:
      'Prepare tests, grade answers automatically and understand your class results in one dashboard. AI drafts the questions — you have the final say.',
    primaryCta: 'Create a free test',
    secondaryCta: 'See how it works',
    points: [
      'Questions in Azerbaijani, Russian and English',
      'Students join without installing an app',
      'No credit card required',
    ],
    haveAccount: 'Already have an account?',
    login: 'Log in',
  },
  preview: {
    ariaLabel: 'Sample view of the AI question generator',
    appTitle: 'AI question generator',
    topic: 'Maths · Grade 6 · Fractions',
    language: 'Language: Azerbaijani',
    questionCounter: 'Question 3 / 10',
    difficulty: 'Medium',
    question: 'What is ½ + ¼?',
    options: ['¾', '⅔', '²⁄₆', '1'],
    correct: 'Correct answer',
    edit: 'Edit',
    regenerate: 'Regenerate',
    approve: 'Approve',
    approved: 'Waiting for teacher approval',
    shareTitle: 'Ready to share',
    shareHint: 'Link or QR code',
    resultsTitle: 'Results are calculated automatically',
  },
  steps: {
    kicker: 'How it works',
    title: 'Four steps instead of hours of writing questions',
    lead: 'Preparation, grading and reporting in one flow. You only review and approve.',
    items: [
      {
        title: 'Choose the topic and level',
        body: 'Enter the subject, topic, grade and number of questions, and pick the question language.',
      },
      {
        title: 'Generate and edit questions with AI',
        body: 'AI drafts questions and answer options. Read each one, change it, regenerate it or delete it.',
      },
      {
        title: 'Share a link or QR code',
        body: 'Send the test to your class with a link, or invite students to a group with a QR code. Phones and computers both work.',
      },
      {
        title: 'See results automatically',
        body: 'Closed questions are checked instantly and scores are calculated. Download results as Excel or PDF.',
      },
    ],
    form: {
      subject: 'Subject',
      subjectValue: 'Maths',
      topic: 'Topic',
      topicValue: 'Fractions',
      level: 'Level',
      levelValue: 'Grade 6',
      count: 'Questions',
      countValue: '10',
      language: 'Language',
      generate: 'Generate questions',
    },
    share: {
      linkLabel: 'Test link',
      copy: 'Copy',
      qrAlt: 'Sample QR code',
    },
    results: {
      student: 'Student',
      score: 'Score',
      rows: [
        ['Student A', '9 / 10'],
        ['Student B', '8 / 10'],
        ['Student C', '6 / 10'],
      ],
      exportExcel: 'Excel',
      exportPdf: 'PDF',
    },
    principle: {
      title: 'AI drafts, the teacher approves',
      body: 'No question reaches students before you have seen it: AI prepares a draft, you review, fix and publish it.',
    },
    student: {
      title: 'The student side',
      body: 'Students open the link, sign in with their Google account in one click and take the test in the browser. No app to install.',
    },
  },
  features: {
    kicker: 'Features',
    title: 'Automate the work that eats up teaching time',
    learnMore: 'Learn more',
    items: [
      {
        id: 'ai',
        title: 'AI question generator',
        body: 'Pick a topic and difficulty — AI drafts questions in Azerbaijani, Russian or English.',
        benefit: 'Test preparation takes minutes, not hours.',
      },
      {
        id: 'grading',
        title: 'Automatic grading',
        body: 'Closed questions are checked automatically and scored instantly; when time runs out, answers are submitted for the student.',
        benefit: 'No more marking papers and adding up scores.',
      },
      {
        id: 'join',
        title: 'Join without an app',
        body: 'Students join from the browser with a link or QR code — nothing to install.',
        benefit: 'No technical instructions needed for students.',
      },
      {
        id: 'results',
        title: 'Results in one dashboard',
        body: "See every student's score and the whole class picture in one place, and export it to Excel or PDF.",
        benefit: 'Data ready for the next lesson and parent meetings.',
      },
      {
        id: 'review',
        title: 'AI feedback on written work',
        body: 'For assignments, AI drafts feedback with strengths and weaknesses; the teacher sets the final grade.',
        benefit: 'A ready starting point for writing feedback.',
      },
      {
        id: 'certificate',
        title: 'Verifiable certificates',
        body: 'Passing a certified exam earns a certificate with a serial number; its QR code opens a public verification page.',
        benefit: 'Anyone can check that a certificate is genuine.',
      },
    ],
  },
  audiences: {
    title: 'Who is it for?',
    items: {
      teacher: {
        title: 'Teachers and tutors',
        body: "Create tests, manage groups and follow each student's results.",
        cta: 'For teachers',
      },
      school: {
        title: 'Schools and learning centres',
        body: 'The organisation dashboard brings groups, trainers, a question bank and user roles together.',
        cta: 'Contact us',
      },
      student: {
        title: 'Students and parents',
        body: 'Student and parent accounts are free: assignments, exams and results in one place.',
        cta: 'For students',
      },
      mentorship: {
        title: 'Mentorship',
        body: 'Find a mentor that fits your goal and build a development plan.',
        cta: 'Find a mentor',
      },
    },
  },
  trust: {
    kicker: 'Trust',
    title: 'We are open about how we work',
    items: {
      privacy: {
        title: 'Data protection',
        body: 'How personal data is collected and used is set out in our Privacy Policy and Terms of Use.',
        privacy: 'Privacy Policy',
        terms: 'Terms of Use',
      },
      certificate: {
        title: 'How are certificates verified?',
        body: 'Every certificate has a unique serial number and QR code. The verification page shows whether it is valid, superseded or revoked. Certificates are issued by the {{brand}} platform; they are not state accreditation.',
        cta: 'Certified exams',
      },
      support: {
        title: 'Support in Azerbaijani',
        body: 'Write to us with questions about the platform, joining or your account.',
        whatsapp: 'WhatsApp',
        email: 'Email',
      },
    },
    placeholders: {
      badge: 'Placeholder — hidden in production',
      note: 'Not shown until the product owner confirms real data.',
      testimonials: 'Teacher and school testimonials (named, with consent)',
      stats: 'User and created-test counts (from real data)',
      logos: 'School / partner logos (with written permission)',
      stories: 'Success stories',
      team: 'Short company and team description',
    },
  },
  faq: {
    title: 'Frequently asked questions',
    items: [
      {
        q: 'What is {{brand}}?',
        a: '{{brand}} is an AI-powered testing and assessment platform for teachers: it helps you prepare questions, grades answers automatically and shows results in one dashboard.',
      },
      {
        q: 'Can I edit the questions AI generates?',
        a: 'Yes. AI prepares a draft — before publishing you can read, edit, regenerate or delete every question. Students only receive questions you have approved.',
      },
      {
        q: 'Which languages can questions be generated in?',
        a: 'Azerbaijani, Russian and English. The interface is available in these three languages too.',
      },
      {
        q: 'Do students need to install an app?',
        a: 'No. Students open the link or QR code, sign in with Google and take the test in the browser.',
      },
      {
        q: 'How are answers graded?',
        a: 'Closed questions are graded automatically and scores are calculated instantly. Open answers are graded by the teacher; for written assignments AI suggests draft feedback.',
      },
      {
        q: 'Who issues certificates and how are they verified?',
        a: 'Certificates are issued by the {{brand}} platform. The QR code or link on a certificate opens a public verification page showing its serial number and status (valid, superseded, revoked). They are not state accreditation.',
      },
      {
        q: 'Can a school or learning centre use it?',
        a: 'Yes. The organisation dashboard lets you manage groups, trainers, a question bank and user roles in one place.',
      },
      {
        q: 'Can I start for free?',
        a: 'Yes, sign-up is free and no credit card is required. Plans and limits are on the Pricing page.',
      },
    ],
  },
  certified: {
    disclaimer: 'Certificates are issued by the {{brand}} platform and verified by QR code. They are not state accreditation.',
  },
  cta: {
    title: 'Create your first test today',
    body: 'Sign-up is free, no credit card required.',
    primary: 'Start for free',
    pricing: 'See pricing',
  },
  footer: {
    product: 'Product',
    company: 'Company',
    legal: 'Legal',
    contact: 'Contact',
    discover: 'Discover',
    certifiedExams: 'Certified exams',
    tagline: '{{brand}} — AI-powered testing and assessment platform for teachers.',
    copyright: '© {{year}} {{brand}}. All rights reserved.',
    whatsapp: 'WhatsApp',
    email: 'Email',
  },
}

export const homeRu = {
  seo: {
    title: '{{brand}} — платформа тестирования и оценивания с ИИ для учителей',
    description:
      'Создавайте тесты с ИИ за считанные минуты, проверяйте ответы автоматически и следите за результатами в одной панели. Ученики подключаются по ссылке или QR-коду. Начните бесплатно.',
    keywords:
      'онлайн-тест, платформа для экзаменов, генератор вопросов ИИ, автоматическая проверка, панель учителя, создать тест, проверка сертификата',
  },
  skipLink: 'Перейти к основному содержанию',
  sampleLabel: 'Пример интерфейса · иллюстративные данные',
  hero: {
    eyebrow: 'Платформа оценивания с ИИ для учителей',
    title: 'Создавайте умные тесты за считанные минуты',
    subtitle:
      'Готовьте тесты, проверяйте ответы автоматически и разбирайтесь в результатах класса в одной панели. Вопросы готовит ИИ — последнее слово за вами.',
    primaryCta: 'Создать тест бесплатно',
    secondaryCta: 'Как это работает',
    points: [
      'Вопросы на азербайджанском, русском и английском',
      'Ученики подключаются без установки приложения',
      'Банковская карта не нужна',
    ],
    haveAccount: 'Уже есть аккаунт?',
    login: 'Войти',
  },
  preview: {
    ariaLabel: 'Пример интерфейса генератора вопросов ИИ',
    appTitle: 'Генератор вопросов ИИ',
    topic: 'Математика · 6 класс · Дроби',
    language: 'Язык: азербайджанский',
    questionCounter: 'Вопрос 3 / 10',
    difficulty: 'Средний',
    question: 'Чему равна сумма ½ + ¼?',
    options: ['¾', '⅔', '²⁄₆', '1'],
    correct: 'Правильный ответ',
    edit: 'Изменить',
    regenerate: 'Сгенерировать заново',
    approve: 'Утвердить',
    approved: 'Ожидает утверждения учителем',
    shareTitle: 'Готово к отправке',
    shareHint: 'Ссылка или QR-код',
    resultsTitle: 'Результаты считаются автоматически',
  },
  steps: {
    kicker: 'Как это работает',
    title: 'Четыре шага вместо часов составления вопросов',
    lead: 'Подготовка, проверка и отчёт — в одном процессе. Вам остаётся только проверить и утвердить.',
    items: [
      {
        title: 'Выберите тему и уровень',
        body: 'Укажите предмет, тему, класс и количество вопросов, выберите язык вопросов.',
      },
      {
        title: 'Создайте и отредактируйте вопросы с ИИ',
        body: 'ИИ готовит вопросы и варианты ответов. Прочитайте каждый, измените, сгенерируйте заново или удалите.',
      },
      {
        title: 'Поделитесь ссылкой или QR-кодом',
        body: 'Отправьте тест классу по ссылке или пригласите учеников в группу по QR-коду. Подойдёт и телефон, и компьютер.',
      },
      {
        title: 'Смотрите результаты автоматически',
        body: 'Закрытые вопросы проверяются сразу, баллы подсчитываются. Результаты можно скачать в Excel или PDF.',
      },
    ],
    form: {
      subject: 'Предмет',
      subjectValue: 'Математика',
      topic: 'Тема',
      topicValue: 'Дроби',
      level: 'Уровень',
      levelValue: '6 класс',
      count: 'Вопросов',
      countValue: '10',
      language: 'Язык',
      generate: 'Создать вопросы',
    },
    share: {
      linkLabel: 'Ссылка на тест',
      copy: 'Копировать',
      qrAlt: 'Пример QR-кода',
    },
    results: {
      student: 'Ученик',
      score: 'Балл',
      rows: [
        ['Ученик A', '9 / 10'],
        ['Ученик B', '8 / 10'],
        ['Ученик C', '6 / 10'],
      ],
      exportExcel: 'Excel',
      exportPdf: 'PDF',
    },
    principle: {
      title: 'ИИ создаёт, учитель утверждает',
      body: 'Ни один вопрос не попадёт к ученикам без вашего просмотра: ИИ готовит черновик, вы проверяете, исправляете и публикуете.',
    },
    student: {
      title: 'Со стороны ученика',
      body: 'Ученик открывает ссылку, входит через Google в один клик и проходит тест в браузере. Приложение не нужно.',
    },
  },
  features: {
    kicker: 'Возможности',
    title: 'Автоматизируйте то, что отнимает время учителя',
    learnMore: 'Подробнее',
    items: [
      {
        id: 'ai',
        title: 'Генератор вопросов ИИ',
        body: 'Выберите тему и сложность — ИИ подготовит вопросы на азербайджанском, русском или английском.',
        benefit: 'Подготовка теста занимает минуты, а не часы.',
      },
      {
        id: 'grading',
        title: 'Автоматическая проверка',
        body: 'Закрытые вопросы проверяются автоматически, баллы считаются сразу; когда время вышло, ответы отправляются сами.',
        benefit: 'Не нужно проверять листы и подсчитывать баллы.',
      },
      {
        id: 'join',
        title: 'Без приложения',
        body: 'Ученики подключаются из браузера по ссылке или QR-коду — ничего устанавливать не нужно.',
        benefit: 'Не нужно объяснять ученикам технические детали.',
      },
      {
        id: 'results',
        title: 'Результаты в одной панели',
        body: 'Баллы каждого ученика и общая картина класса в одном месте, с выгрузкой в Excel или PDF.',
        benefit: 'Готовые данные к следующему уроку и встрече с родителями.',
      },
      {
        id: 'review',
        title: 'Отзыв ИИ на письменные работы',
        body: 'В заданиях ИИ готовит черновик отзыва с сильными и слабыми сторонами; итоговую оценку ставит учитель.',
        benefit: 'Готовая основа для отзыва.',
      },
      {
        id: 'certificate',
        title: 'Проверяемые сертификаты',
        body: 'За сертифицированный экзамен выдаётся сертификат с серийным номером; QR-код открывает публичную страницу проверки.',
        benefit: 'Подлинность сертификата может проверить любой.',
      },
    ],
  },
  audiences: {
    title: 'Для кого это?',
    items: {
      teacher: {
        title: 'Учителя и репетиторы',
        body: 'Создавайте тесты, управляйте группами и следите за результатами каждого ученика.',
        cta: 'Для учителей',
      },
      school: {
        title: 'Школы и учебные центры',
        body: 'В панели организации — группы, преподаватели, банк вопросов и роли пользователей.',
        cta: 'Связаться с нами',
      },
      student: {
        title: 'Ученики и родители',
        body: 'Кабинеты ученика и родителя бесплатны: задания, экзамены и результаты в одном месте.',
        cta: 'Для учеников',
      },
      mentorship: {
        title: 'Менторство',
        body: 'Найдите ментора под свою цель и составьте план развития.',
        cta: 'Найти ментора',
      },
    },
  },
  trust: {
    kicker: 'Доверие',
    title: 'Открыто рассказываем, как мы работаем',
    items: {
      privacy: {
        title: 'Защита данных',
        body: 'Как собираются и используются персональные данные, описано в Политике конфиденциальности и Условиях использования.',
        privacy: 'Политика конфиденциальности',
        terms: 'Условия использования',
      },
      certificate: {
        title: 'Как проверяется сертификат?',
        body: 'У каждого сертификата есть уникальный серийный номер и QR-код. Страница проверки показывает, действителен ли он, обновлён или отозван. Сертификаты выдаёт платформа {{brand}}; это не государственная аккредитация.',
        cta: 'Сертифицированные экзамены',
      },
      support: {
        title: 'Поддержка на азербайджанском',
        body: 'Пишите нам по вопросам платформы, подключения или аккаунта.',
        whatsapp: 'WhatsApp',
        email: 'Эл. почта',
      },
    },
    placeholders: {
      badge: 'Заглушка — скрыта в продакшене',
      note: 'Не показывается, пока владелец продукта не подтвердит реальные данные.',
      testimonials: 'Отзывы учителей и школ (с именем и согласием)',
      stats: 'Число пользователей и созданных тестов (из реальных данных)',
      logos: 'Логотипы школ / партнёров (с письменного разрешения)',
      stories: 'Истории успеха',
      team: 'Кратко о компании и команде',
    },
  },
  faq: {
    title: 'Частые вопросы',
    items: [
      {
        q: 'Что такое {{brand}}?',
        a: '{{brand}} — платформа тестирования и оценивания с ИИ для учителей: помогает готовить вопросы, автоматически проверяет ответы и показывает результаты в одной панели.',
      },
      {
        q: 'Можно ли изменить вопросы, созданные ИИ?',
        a: 'Да. ИИ готовит черновик — перед публикацией каждый вопрос можно прочитать, изменить, сгенерировать заново или удалить. Ученики получают только утверждённые вами вопросы.',
      },
      {
        q: 'На каких языках можно создавать вопросы?',
        a: 'На азербайджанском, русском и английском. Интерфейс тоже доступен на этих трёх языках.',
      },
      {
        q: 'Нужно ли ученикам устанавливать приложение?',
        a: 'Нет. Ученик открывает ссылку или QR-код, входит через Google и проходит тест в браузере.',
      },
      {
        q: 'Как проверяются ответы?',
        a: 'Закрытые вопросы проверяются автоматически, баллы считаются сразу. Открытые ответы оценивает учитель; для письменных заданий ИИ предлагает черновик отзыва.',
      },
      {
        q: 'Кто выдаёт сертификат и как его проверить?',
        a: 'Сертификаты выдаёт платформа {{brand}}. QR-код или ссылка на сертификате открывает публичную страницу проверки с серийным номером и статусом (действителен, обновлён, отозван). Это не государственная аккредитация.',
      },
      {
        q: 'Может ли платформой пользоваться школа или учебный центр?',
        a: 'Да. В панели организации можно управлять группами, преподавателями, банком вопросов и ролями пользователей.',
      },
      {
        q: 'Можно ли начать бесплатно?',
        a: 'Да, регистрация бесплатна, банковская карта не нужна. Тарифы и лимиты — на странице «Цены».',
      },
    ],
  },
  certified: {
    disclaimer: 'Сертификаты выдаёт платформа {{brand}}, они проверяются по QR-коду. Это не государственная аккредитация.',
  },
  cta: {
    title: 'Создайте первый тест уже сегодня',
    body: 'Регистрация бесплатна, банковская карта не нужна.',
    primary: 'Начать бесплатно',
    pricing: 'Посмотреть цены',
  },
  footer: {
    product: 'Продукт',
    company: 'Компания',
    legal: 'Правовая информация',
    contact: 'Контакты',
    discover: 'Обзор',
    certifiedExams: 'Сертифицированные экзамены',
    tagline: '{{brand}} — платформа тестирования и оценивания с ИИ для учителей.',
    copyright: '© {{year}} {{brand}}. Все права защищены.',
    whatsapp: 'WhatsApp',
    email: 'Эл. почта',
  },
}
