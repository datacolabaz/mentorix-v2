/**
 * Account/transactional emails that existed before the notification pipeline.
 * The az copy is the wording that was already in production; en/ru are added so
 * `users.locale` can be honoured where the caller knows it. Links arrive as params
 * (built by the caller from emailConfig); single-use expiring tokens are the only
 * tokens allowed in a link, and they are never logged.
 */

const or = (v, fallback) => {
  const s = v == null ? '' : String(v).trim();
  return s || fallback;
};

const clipText = (s, max = 600) => {
  const t = String(s || '').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

const IGNORE = {
  az: 'Əgər bu müraciəti siz etməmisinizsə, bu e-məktubu nəzərə almayın.',
  en: 'If you did not request this, you can ignore this email.',
  ru: 'Если вы не запрашивали это письмо, просто проигнорируйте его.',
};

const SENT_TO_ACCOUNT = {
  az: 'Bu e-poçtu hesabınıza daxil olduğunuz ünvana göndərdik.',
  en: 'We sent this email to the address you use to sign in.',
  ru: 'Мы отправили это письмо на адрес, с которым вы входите в аккаунт.',
};

const TEMPLATES = {
  email_verification: {
    az: (p, ctx) => ({
      subject: `${ctx.brand.name} — e-poçt təsdiqi`,
      heading: `${ctx.brand.name} — e-poçt təsdiqi`,
      paragraphs: ['Salam!', 'Hesabınızı aktivləşdirmək üçün aşağıdakılardan birini edin:'],
      code: p.code || null,
      cta: { label: 'E-poçtu link ilə təsdiqlə', url: p.url },
      footer: [`Kod və link ${or(p.ttlMinutes, 60)} dəqiqə ərzində etibarlıdır.`, IGNORE.az],
    }),
    en: (p, ctx) => ({
      subject: `${ctx.brand.name} — confirm your email`,
      heading: `${ctx.brand.name} — confirm your email`,
      paragraphs: ['Hello!', 'To activate your account, use the code below or the button:'],
      code: p.code || null,
      cta: { label: 'Confirm email', url: p.url },
      footer: [`The code and link are valid for ${or(p.ttlMinutes, 60)} minutes.`, IGNORE.en],
    }),
    ru: (p, ctx) => ({
      subject: `${ctx.brand.name} — подтверждение e-mail`,
      heading: `${ctx.brand.name} — подтверждение e-mail`,
      paragraphs: ['Здравствуйте!', 'Чтобы активировать аккаунт, введите код ниже или нажмите кнопку:'],
      code: p.code || null,
      cta: { label: 'Подтвердить e-mail', url: p.url },
      footer: [`Код и ссылка действуют ${or(p.ttlMinutes, 60)} минут.`, IGNORE.ru],
    }),
  },

  password_reset: {
    az: (p, ctx) => ({
      subject: `${ctx.brand.name} — parol bərpası`,
      heading: `${ctx.brand.name} — parol bərpası`,
      paragraphs: ['Salam!', 'Parolunuzu yeniləmək üçün aşağıdakı düyməyə klik edin:'],
      cta: { label: 'Parolu yenilə', url: p.url },
      footer: [`Link ${or(p.ttlMinutes, 30)} dəqiqə ərzində etibarlıdır.`, IGNORE.az, p.ref ? `Ref: ${p.ref}` : null],
    }),
    en: (p, ctx) => ({
      subject: `${ctx.brand.name} — password reset`,
      heading: `${ctx.brand.name} — password reset`,
      paragraphs: ['Hello!', 'Click the button below to set a new password:'],
      cta: { label: 'Reset password', url: p.url },
      footer: [`The link is valid for ${or(p.ttlMinutes, 30)} minutes.`, IGNORE.en, p.ref ? `Ref: ${p.ref}` : null],
    }),
    ru: (p, ctx) => ({
      subject: `${ctx.brand.name} — восстановление пароля`,
      heading: `${ctx.brand.name} — восстановление пароля`,
      paragraphs: ['Здравствуйте!', 'Нажмите кнопку ниже, чтобы задать новый пароль:'],
      cta: { label: 'Сменить пароль', url: p.url },
      footer: [`Ссылка действует ${or(p.ttlMinutes, 30)} минут.`, IGNORE.ru, p.ref ? `Ref: ${p.ref}` : null],
    }),
  },

  assignment_new: {
    az: (p, ctx) => ({
      subject: `Yeni tapşırıq — ${or(p.title, 'Tapşırıq')}`,
      eyebrow: 'Yeni tapşırıq',
      heading: or(p.title, 'Tapşırıq'),
      paragraphs: [
        `${or(p.instructorName, 'Müəlliminiz')} sizə platformada yeni ev tapşırığı təyin etdi.`,
        p.dueDate ? `Son tarix: ${ctx.fmtDate(p.dueDate)}` : 'Son tarix təyin olunmayıb',
        clipText(p.description),
      ],
      cta: { label: 'Tapşırıqlarım bölməsinə keç', url: p.url },
      footer: [SENT_TO_ACCOUNT.az],
    }),
    en: (p, ctx) => ({
      subject: `New assignment — ${or(p.title, 'Assignment')}`,
      eyebrow: 'New assignment',
      heading: or(p.title, 'Assignment'),
      paragraphs: [
        `${or(p.instructorName, 'Your teacher')} assigned you a new task.`,
        p.dueDate ? `Due: ${ctx.fmtDate(p.dueDate)}` : 'No due date',
        clipText(p.description),
      ],
      cta: { label: 'Open my assignments', url: p.url },
      footer: [SENT_TO_ACCOUNT.en],
    }),
    ru: (p, ctx) => ({
      subject: `Новое задание — ${or(p.title, 'Задание')}`,
      eyebrow: 'Новое задание',
      heading: or(p.title, 'Задание'),
      paragraphs: [
        `${or(p.instructorName, 'Ваш преподаватель')} назначил(а) вам новое задание.`,
        p.dueDate ? `Срок: ${ctx.fmtDate(p.dueDate)}` : 'Срок не указан',
        clipText(p.description),
      ],
      cta: { label: 'Мои задания', url: p.url },
      footer: [SENT_TO_ACCOUNT.ru],
    }),
  },

  exam_access_approved: {
    az: (p, ctx) => ({
      subject: `${ctx.brand.name} — Müraciətiniz təsdiqləndi`,
      eyebrow: 'Müraciətiniz təsdiqləndi',
      paragraphs: [
        `${or(p.instructorName, 'Müəlliminiz')} «${or(p.examTitle, 'İmtahan')}» imtahanına girişinizi təsdiqlədi.`,
        'İmtahana başlamaq üçün aşağıdakı düyməyə klik edin.',
      ],
      cta: { label: 'İmtahanlar bölməsinə keç', url: p.url },
      footer: [SENT_TO_ACCOUNT.az],
    }),
    en: (p, ctx) => ({
      subject: `${ctx.brand.name} — Your request was approved`,
      eyebrow: 'Request approved',
      paragraphs: [
        `${or(p.instructorName, 'Your teacher')} approved your access to the assessment “${or(p.examTitle, 'Assessment')}”.`,
        'Use the button below to start.',
      ],
      cta: { label: 'Open assessments', url: p.url },
      footer: [SENT_TO_ACCOUNT.en],
    }),
    ru: (p, ctx) => ({
      subject: `${ctx.brand.name} — Ваша заявка одобрена`,
      eyebrow: 'Заявка одобрена',
      paragraphs: [
        `${or(p.instructorName, 'Ваш преподаватель')} открыл(а) вам доступ к экзамену «${or(p.examTitle, 'Экзамен')}».`,
        'Нажмите кнопку ниже, чтобы начать.',
      ],
      cta: { label: 'Перейти к экзаменам', url: p.url },
      footer: [SENT_TO_ACCOUNT.ru],
    }),
  },

  student_profile_completion: {
    az: (p, ctx) => ({
      subject: `${ctx.brand.name} — Qeydiyyatı tamamlayın`,
      eyebrow: 'Qeydiyyatı tamamlayın',
      paragraphs: [
        `Salam, ${or(p.studentName, 'Tələbə')}!`,
        `${or(p.instructorName, 'Müəlliminiz')} sizin qeydiyyatınızı tamamlamağınızı xahiş edir.`,
        'Müraciətiniz müəllimə yalnız ad, soyad və mobil telefon (+994) doldurulduqdan sonra göndəriləcək.',
        'Linkə daxil olun, Google ilə giriş edin və məlumatları doldurun.',
      ],
      cta: { label: 'Linkə keç və tamamla', url: p.url },
    }),
    en: (p, ctx) => ({
      subject: `${ctx.brand.name} — Complete your registration`,
      eyebrow: 'Complete your registration',
      paragraphs: [
        `Hello, ${or(p.studentName, 'student')}!`,
        `${or(p.instructorName, 'Your teacher')} asks you to complete your registration.`,
        'Your request reaches the teacher only after you add your first name, last name and mobile number (+994).',
        'Open the link, sign in with Google and fill in the details.',
      ],
      cta: { label: 'Open and complete', url: p.url },
    }),
    ru: (p, ctx) => ({
      subject: `${ctx.brand.name} — Завершите регистрацию`,
      eyebrow: 'Завершите регистрацию',
      paragraphs: [
        `Здравствуйте, ${or(p.studentName, 'ученик')}!`,
        `${or(p.instructorName, 'Ваш преподаватель')} просит вас завершить регистрацию.`,
        'Заявка попадёт к преподавателю только после того, как вы укажете имя, фамилию и мобильный номер (+994).',
        'Откройте ссылку, войдите через Google и заполните данные.',
      ],
      cta: { label: 'Открыть и заполнить', url: p.url },
    }),
  },

  live_class_started: {
    az: (p) => ({
      subject: `Canlı dərs başladı — ${or(p.roomTitle, 'Canlı dərs')}`,
      eyebrow: 'Canlı dərs',
      heading: or(p.roomTitle, 'Canlı dərs'),
      paragraphs: [`${or(p.instructorName, 'Müəlliminiz')} canlı dərsi başlatdı. İndi qoşula bilərsiniz.`],
      cta: { label: 'Canlı dərsə qoşul', url: p.url },
      footer: [SENT_TO_ACCOUNT.az],
    }),
    en: (p) => ({
      subject: `Live lesson started — ${or(p.roomTitle, 'Live lesson')}`,
      eyebrow: 'Live lesson',
      heading: or(p.roomTitle, 'Live lesson'),
      paragraphs: [`${or(p.instructorName, 'Your teacher')} started the live lesson. You can join now.`],
      cta: { label: 'Join the live lesson', url: p.url },
      footer: [SENT_TO_ACCOUNT.en],
    }),
    ru: (p) => ({
      subject: `Онлайн-урок начался — ${or(p.roomTitle, 'Онлайн-урок')}`,
      eyebrow: 'Онлайн-урок',
      heading: or(p.roomTitle, 'Онлайн-урок'),
      paragraphs: [`${or(p.instructorName, 'Ваш преподаватель')} начал(а) онлайн-урок. Можно подключаться.`],
      cta: { label: 'Подключиться', url: p.url },
      footer: [SENT_TO_ACCOUNT.ru],
    }),
  },

  certificate_issued: {
    az: (p, ctx) => ({
      subject: `${ctx.brand.name} — sertifikatınız hazırdır`,
      eyebrow: 'Sertifikat',
      heading: 'Sertifikatınız hazırdır',
      paragraphs: [
        `Salam, ${or(p.studentName, 'Tələbə')}!`,
        `«${or(p.courseTitle, 'İmtahan')}» üçün sertifikatınız yaradıldı.`,
        p.certificateNo ? `Sertifikat ID: ${p.certificateNo}` : null,
        p.dashboardUrl ? `Sertifikatlar bölməsi: ${p.dashboardUrl}` : null,
      ],
      cta: { label: 'Doğrula', url: p.verifyUrl },
      footer: ['PDF sertifikat bu e-poçta əlavə olunub (mümkündürsə).', SENT_TO_ACCOUNT.az],
    }),
    en: (p, ctx) => ({
      subject: `${ctx.brand.name} — your certificate is ready`,
      eyebrow: 'Certificate',
      heading: 'Your certificate is ready',
      paragraphs: [
        `Hello, ${or(p.studentName, 'student')}!`,
        `Your certificate for “${or(p.courseTitle, 'Assessment')}” has been issued.`,
        p.certificateNo ? `Certificate ID: ${p.certificateNo}` : null,
        p.dashboardUrl ? `Certificates: ${p.dashboardUrl}` : null,
      ],
      cta: { label: 'Verify', url: p.verifyUrl },
      footer: ['The PDF certificate is attached when available.', SENT_TO_ACCOUNT.en],
    }),
    ru: (p, ctx) => ({
      subject: `${ctx.brand.name} — ваш сертификат готов`,
      eyebrow: 'Сертификат',
      heading: 'Ваш сертификат готов',
      paragraphs: [
        `Здравствуйте, ${or(p.studentName, 'ученик')}!`,
        `Сертификат за «${or(p.courseTitle, 'Экзамен')}» выпущен.`,
        p.certificateNo ? `ID сертификата: ${p.certificateNo}` : null,
        p.dashboardUrl ? `Раздел сертификатов: ${p.dashboardUrl}` : null,
      ],
      cta: { label: 'Проверить', url: p.verifyUrl },
      footer: ['PDF-сертификат приложен к письму (если доступен).', SENT_TO_ACCOUNT.ru],
    }),
  },

  catalog_waitlist: {
    az: (p, ctx) => ({
      subject: `${or(p.categoryName, 'Kataloq')} — yeni sertifikatlı imtahan`,
      eyebrow: 'Yeni imtahan',
      heading: or(p.categoryName, 'Kataloq'),
      paragraphs: [`Bu kateqoriyada yeni sertifikatlı imtahan əlavə olundu: ${or(p.examTitle, 'İmtahan')}.`],
      cta: { label: 'İmtahana başla →', url: p.url },
      footer: [`${ctx.brand.name} — sertifikatlı imtahan kataloqu`],
    }),
    en: (p, ctx) => ({
      subject: `${or(p.categoryName, 'Catalog')} — new certified assessment`,
      eyebrow: 'New assessment',
      heading: or(p.categoryName, 'Catalog'),
      paragraphs: [`A new certified assessment was added to this category: ${or(p.examTitle, 'Assessment')}.`],
      cta: { label: 'Start the assessment →', url: p.url },
      footer: [`${ctx.brand.name} — certified assessment catalog`],
    }),
    ru: (p, ctx) => ({
      subject: `${or(p.categoryName, 'Каталог')} — новый сертифицированный экзамен`,
      eyebrow: 'Новый экзамен',
      heading: or(p.categoryName, 'Каталог'),
      paragraphs: [`В этой категории появился новый сертифицированный экзамен: ${or(p.examTitle, 'Экзамен')}.`],
      cta: { label: 'Начать экзамен →', url: p.url },
      footer: [`${ctx.brand.name} — каталог сертифицированных экзаменов`],
    }),
  },
};

module.exports = { TEMPLATES };
