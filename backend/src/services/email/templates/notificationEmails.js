/**
 * Emails for notificationService events (key = notifications.type).
 * Params come from notifications.meta.i18n.params — names and titles only, never scores,
 * answers, feedback text or tokens. Subjects stay generic (no results, no personal data
 * beyond the entity title). The CTA always goes to /notifications?open=<id>, which re-checks
 * access server-side when clicked.
 */

const or = (v, fallback) => {
  const s = v == null ? '' : String(v).trim();
  return s || fallback;
};

const quoteAz = (s) => `«${s}»`;
const quoteEn = (s) => `“${s}”`;
const quoteRu = (s) => `«${s}»`;

const TEMPLATES = {
  join_request: {
    az: (p) => ({
      subject: 'Yeni qoşulma sorğusu',
      eyebrow: 'Qrup',
      heading: 'Yeni qoşulma sorğusu',
      paragraphs: [
        `${or(p.studentName, 'Bir tələbə')} ${quoteAz(or(p.groupName, 'qrupunuza'))} qrupunuza qoşulmaq istəyir.`,
        'Sorğunu təsdiqləyin və ya rədd edin.',
      ],
      ctaLabel: 'Sorğuya bax',
    }),
    en: (p) => ({
      subject: 'New join request',
      eyebrow: 'Group',
      heading: 'New join request',
      paragraphs: [
        `${or(p.studentName, 'A student')} wants to join your group ${quoteEn(or(p.groupName, 'your group'))}.`,
        'Please approve or decline the request.',
      ],
      ctaLabel: 'Review request',
    }),
    ru: (p) => ({
      subject: 'Новая заявка на вступление',
      eyebrow: 'Группа',
      heading: 'Новая заявка на вступление',
      paragraphs: [
        `${or(p.studentName, 'Ученик')} хочет вступить в вашу группу ${quoteRu(or(p.groupName, 'группа'))}.`,
        'Одобрите или отклоните заявку.',
      ],
      ctaLabel: 'Открыть заявку',
    }),
  },

  exam_access_request: {
    az: (p) => ({
      subject: 'İmtahana giriş sorğusu',
      eyebrow: 'İmtahan',
      heading: 'İmtahana giriş sorğusu',
      paragraphs: [
        `${or(p.studentName, 'Bir tələbə')} ${quoteAz(or(p.examTitle, 'imtahan'))} imtahanına qoşulmaq istəyir.`,
        'Sorğunu təsdiqləyin və ya rədd edin.',
      ],
      ctaLabel: 'Sorğuya bax',
    }),
    en: (p) => ({
      subject: 'Assessment access request',
      eyebrow: 'Assessment',
      heading: 'Assessment access request',
      paragraphs: [
        `${or(p.studentName, 'A student')} wants to join the assessment ${quoteEn(or(p.examTitle, 'assessment'))}.`,
        'Please approve or decline the request.',
      ],
      ctaLabel: 'Review request',
    }),
    ru: (p) => ({
      subject: 'Запрос на доступ к экзамену',
      eyebrow: 'Экзамен',
      heading: 'Запрос на доступ к экзамену',
      paragraphs: [
        `${or(p.studentName, 'Ученик')} хочет получить доступ к экзамену ${quoteRu(or(p.examTitle, 'экзамен'))}.`,
        'Одобрите или отклоните запрос.',
      ],
      ctaLabel: 'Открыть запрос',
    }),
  },

  task_access_request: {
    az: (p) => ({
      subject: 'Tapşırıq giriş sorğusu',
      eyebrow: 'Tapşırıq',
      heading: 'Tapşırıq giriş sorğusu',
      paragraphs: [
        `${or(p.studentName, 'Bir tələbə')} ${quoteAz(or(p.assignmentTitle, 'tapşırıq'))} tapşırığına qoşulmaq istəyir.`,
        'Sorğunu təsdiqləyin və ya rədd edin.',
      ],
      ctaLabel: 'Sorğuya bax',
    }),
    en: (p) => ({
      subject: 'Assignment access request',
      eyebrow: 'Assignment',
      heading: 'Assignment access request',
      paragraphs: [
        `${or(p.studentName, 'A student')} wants to join the assignment ${quoteEn(or(p.assignmentTitle, 'assignment'))}.`,
        'Please approve or decline the request.',
      ],
      ctaLabel: 'Review request',
    }),
    ru: (p) => ({
      subject: 'Запрос на доступ к заданию',
      eyebrow: 'Задание',
      heading: 'Запрос на доступ к заданию',
      paragraphs: [
        `${or(p.studentName, 'Ученик')} хочет получить доступ к заданию ${quoteRu(or(p.assignmentTitle, 'задание'))}.`,
        'Одобрите или отклоните запрос.',
      ],
      ctaLabel: 'Открыть запрос',
    }),
  },

  assignment_submitted: {
    az: (p) => ({
      subject: 'Tapşırıq təslim edildi',
      eyebrow: 'Tapşırıq',
      heading: 'Tapşırıq təslim edildi',
      paragraphs: [
        `${or(p.studentName, 'Bir tələbə')} ${quoteAz(or(p.assignmentTitle, 'tapşırıq'))} tapşırığını təslim etdi.`,
        p.when ? `Vaxt: ${p.when}` : null,
      ],
      ctaLabel: 'Təqdimata bax',
    }),
    en: (p) => ({
      subject: 'Assignment submitted',
      eyebrow: 'Assignment',
      heading: 'Assignment submitted',
      paragraphs: [
        `${or(p.studentName, 'A student')} submitted the assignment ${quoteEn(or(p.assignmentTitle, 'assignment'))}.`,
        p.when ? `Time: ${p.when}` : null,
      ],
      ctaLabel: 'View submission',
    }),
    ru: (p) => ({
      subject: 'Задание сдано',
      eyebrow: 'Задание',
      heading: 'Задание сдано',
      paragraphs: [
        `${or(p.studentName, 'Ученик')} сдал(а) задание ${quoteRu(or(p.assignmentTitle, 'задание'))}.`,
        p.when ? `Время: ${p.when}` : null,
      ],
      ctaLabel: 'Открыть работу',
    }),
  },

  open_grading_pending: {
    az: (p) => ({
      subject: 'Cavablar yoxlamanızı gözləyir',
      eyebrow: 'Qiymətləndirmə',
      heading: 'Açıq sual qiymətləndirməsi',
      paragraphs: [
        `${or(p.count, 'Bir neçə')} tələbənin cavabı təsdiqinizi gözləyir — ${quoteAz(or(p.examTitle, 'imtahan'))}.`,
      ],
      ctaLabel: 'Cavabları yoxla',
    }),
    en: (p) => ({
      subject: 'Answers are waiting for your review',
      eyebrow: 'Grading',
      heading: 'Open answers awaiting review',
      paragraphs: [
        `${or(p.count, 'Several')} student answers are waiting for your confirmation — ${quoteEn(or(p.examTitle, 'assessment'))}.`,
      ],
      ctaLabel: 'Review answers',
    }),
    ru: (p) => ({
      subject: 'Ответы ждут вашей проверки',
      eyebrow: 'Оценивание',
      heading: 'Открытые ответы ждут проверки',
      paragraphs: [
        `Ответы учеников (${or(p.count, 'несколько')}) ждут вашего подтверждения — ${quoteRu(or(p.examTitle, 'экзамен'))}.`,
      ],
      ctaLabel: 'Проверить ответы',
    }),
  },

  /** Any other event: the already-safe in-app title/body stored on the notification. */
  notification_generic: {
    az: (p, ctx) => ({
      subject: or(p.title, `${ctx.brand.name} bildirişi`),
      eyebrow: 'Bildiriş',
      heading: or(p.title, 'Yeni bildiriş'),
      paragraphs: [p.body],
      ctaLabel: 'Bildirişə bax',
    }),
    en: (p, ctx) => ({
      subject: or(p.title, `${ctx.brand.name} notification`),
      eyebrow: 'Notification',
      heading: or(p.title, 'New notification'),
      paragraphs: [p.body],
      ctaLabel: 'View notification',
    }),
    ru: (p, ctx) => ({
      subject: or(p.title, `Уведомление ${ctx.brand.name}`),
      eyebrow: 'Уведомление',
      heading: or(p.title, 'Новое уведомление'),
      paragraphs: [p.body],
      ctaLabel: 'Открыть уведомление',
    }),
  },
};

/** Shared footer for every notification email (why + how to change settings). */
const FOOTER = {
  az: (ctx) => [
    `Bu email ${ctx.brand.name} bildiriş ayarlarınıza uyğun göndərildi.`,
    `Ayarları dəyiş: ${ctx.link('/settings/notifications')}`,
  ],
  en: (ctx) => [
    `You received this email because of your ${ctx.brand.name} notification settings.`,
    `Change settings: ${ctx.link('/settings/notifications')}`,
  ],
  ru: (ctx) => [
    `Это письмо отправлено согласно вашим настройкам уведомлений ${ctx.brand.name}.`,
    `Изменить настройки: ${ctx.link('/settings/notifications')}`,
  ],
};

const LINK_HINT = {
  az: 'Düymə işləmirsə, bu linki açın:',
  en: 'If the button does not work, open this link:',
  ru: 'Если кнопка не работает, откройте ссылку:',
};

module.exports = { TEMPLATES, FOOTER, LINK_HINT };
