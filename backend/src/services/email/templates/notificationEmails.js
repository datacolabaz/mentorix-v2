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

/*
 * Email-first notifications (spec B). Compact definitions: lines use the in-app template syntax
 * ({{param}}, [[optional section]]). Params are names/titles/dates/counts only — never meeting links,
 * scores, answers or tokens. Meeting links are shown only inside Mentorix after an access check;
 * the CTA opens Mentorix, which then offers the "Dərsə qoşul" button.
 */
const { interpolate } = require('../../notificationTemplates');

function compact(defs) {
  const out = {};
  for (const [lang, d] of Object.entries(defs)) {
    out[lang] = (p) => ({
      subject: interpolate(d.subject, p),
      eyebrow: d.eyebrow,
      heading: interpolate(d.heading || d.subject, p),
      paragraphs: (d.lines || []).map((line) => interpolate(line, p)).filter((s) => s.trim() !== ''),
      ctaLabel: d.cta,
    });
  }
  return out;
}

const EXAM_CTA = { az: 'İmtahana başla', en: 'Start assessment', ru: 'Начать экзамен' };
const RESULT_CTA = { az: 'Nəticələrə bax', en: 'View results', ru: 'Посмотреть результаты' };
const TASK_CTA = { az: 'Tapşırığı aç', en: 'Open assignment', ru: 'Открыть задание' };
const JOIN_CTA = { az: 'Dərsə qoşul', en: 'Join lesson', ru: 'Присоединиться' };
const LESSONS_CTA = { az: 'Dərslərə bax', en: 'View lessons', ru: 'Открыть уроки' };
const PAY_CTA = { az: 'Ödənişə bax', en: 'View payment', ru: 'Открыть оплату' };
const CERT_CTA = { az: 'Sertifikata bax', en: 'View certificate', ru: 'Открыть сертификат' };
const REPORT_CTA = { az: 'Hesabata bax', en: 'View report', ru: 'Открыть отчёт' };
const STORAGE_CTA = { az: 'Yaddaşı idarə et', en: 'Manage storage', ru: 'Управлять хранилищем' };

const LIVE_NOTE = {
  az: 'Dərs Mentorix-də deyil, müəllimin paylaşdığı {{platformName}} linki ilə keçirilir. Link yalnız Mentorix-ə daxil olduqdan sonra görünür.',
  en: 'The lesson takes place on {{platformName}} via the link your teacher shared, not inside Mentorix. The link is shown only after you sign in to Mentorix.',
  ru: 'Урок проходит не в Mentorix, а в {{platformName}} по ссылке преподавателя. Ссылка видна только после входа в Mentorix.',
};

const EMAIL_FIRST_TEMPLATES = {
  exam_assigned: compact({
    az: { subject: 'Yeni imtahan: {{examTitle}}', eyebrow: 'İmtahan', lines: ['«{{examTitle}}» imtahanına dəvət olundunuz.', '[[Vaxt: {{schedule}}]]', '[[Müddət: {{minutes}} dəqiqə]]'], cta: EXAM_CTA.az },
    en: { subject: 'New assessment: {{examTitle}}', eyebrow: 'Assessment', lines: ['You have been invited to the assessment “{{examTitle}}”.', '[[Time: {{schedule}}]]', '[[Duration: {{minutes}} min]]'], cta: EXAM_CTA.en },
    ru: { subject: 'Новый экзамен: {{examTitle}}', eyebrow: 'Экзамен', lines: ['Вас пригласили на экзамен «{{examTitle}}».', '[[Время: {{schedule}}]]', '[[Длительность: {{minutes}} мин]]'], cta: EXAM_CTA.ru },
  }),
  exam_starting_soon: compact({
    az: { subject: 'İmtahan tezliklə başlayır: {{examTitle}}', eyebrow: 'İmtahan', lines: ['«{{examTitle}}» imtahanı {{startsAt}} tarixində başlayır.', '[[Müddət: {{minutes}} dəqiqə]]'], cta: EXAM_CTA.az },
    en: { subject: 'Assessment starts soon: {{examTitle}}', eyebrow: 'Assessment', lines: ['“{{examTitle}}” starts at {{startsAt}}.', '[[Duration: {{minutes}} min]]'], cta: EXAM_CTA.en },
    ru: { subject: 'Экзамен скоро начнётся: {{examTitle}}', eyebrow: 'Экзамен', lines: ['Экзамен «{{examTitle}}» начнётся {{startsAt}}.', '[[Длительность: {{minutes}} мин]]'], cta: EXAM_CTA.ru },
  }),
  exam_result_released: compact({
    az: { subject: 'İmtahan nəticəniz hazırdır', eyebrow: 'Nəticə', lines: ['«{{examTitle}}» imtahanının nəticəsi açıqlandı.'], cta: RESULT_CTA.az },
    en: { subject: 'Your assessment result is ready', eyebrow: 'Result', lines: ['Your result for “{{examTitle}}” is now available.'], cta: RESULT_CTA.en },
    ru: { subject: 'Результат экзамена готов', eyebrow: 'Результат', lines: ['Результат экзамена «{{examTitle}}» опубликован.'], cta: RESULT_CTA.ru },
  }),
  assignment_new: compact({
    az: { subject: 'Yeni tapşırıq: {{assignmentTitle}}', eyebrow: 'Tapşırıq', lines: ['{{instructorName}} sizə «{{assignmentTitle}}» tapşırığını verdi.', '[[Son tarix: {{dueDate}}]]'], cta: TASK_CTA.az },
    en: { subject: 'New assignment: {{assignmentTitle}}', eyebrow: 'Assignment', lines: ['{{instructorName}} assigned “{{assignmentTitle}}” to you.', '[[Due: {{dueDate}}]]'], cta: TASK_CTA.en },
    ru: { subject: 'Новое задание: {{assignmentTitle}}', eyebrow: 'Задание', lines: ['{{instructorName}} выдал(а) вам задание «{{assignmentTitle}}».', '[[Срок: {{dueDate}}]]'], cta: TASK_CTA.ru },
  }),
  assignment_reminder: compact({
    az: { subject: 'Tapşırığın son tarixi yaxınlaşır', eyebrow: 'Tapşırıq', lines: ['«{{assignmentTitle}}» üçün son tarixə 24 saatdan az qalıb ({{dueDate}}).'], cta: TASK_CTA.az },
    en: { subject: 'Assignment due soon', eyebrow: 'Assignment', lines: ['Less than 24 hours left to submit “{{assignmentTitle}}” (due {{dueDate}}).'], cta: TASK_CTA.en },
    ru: { subject: 'Скоро срок сдачи задания', eyebrow: 'Задание', lines: ['До срока сдачи «{{assignmentTitle}}» осталось меньше 24 часов ({{dueDate}}).'], cta: TASK_CTA.ru },
  }),
  assignment_reviewed: compact({
    az: { subject: 'Tapşırığınız yoxlanıldı', eyebrow: 'Nəticə', lines: ['Müəlliminiz «{{assignmentTitle}}» tapşırığını yoxladı.'], cta: RESULT_CTA.az },
    en: { subject: 'Your assignment was reviewed', eyebrow: 'Result', lines: ['Your teacher reviewed “{{assignmentTitle}}”.'], cta: RESULT_CTA.en },
    ru: { subject: 'Задание проверено', eyebrow: 'Результат', lines: ['Преподаватель проверил задание «{{assignmentTitle}}».'], cta: RESULT_CTA.ru },
  }),
  live_lesson_created: compact({
    az: { subject: 'Yeni canlı dərs: {{lessonTitle}}', eyebrow: 'Canlı dərs', lines: ['{{instructorName}} «{{lessonTitle}}» canlı dərsini planladı.', 'Vaxt: {{startsAt}}', 'Platforma: {{platformName}}', '[[Təkrarlanan seriya: {{recurrenceCount}} dərs]]', LIVE_NOTE.az], cta: JOIN_CTA.az },
    en: { subject: 'New live lesson: {{lessonTitle}}', eyebrow: 'Live lesson', lines: ['{{instructorName}} scheduled the live lesson “{{lessonTitle}}”.', 'Time: {{startsAt}}', 'Platform: {{platformName}}', '[[Recurring series: {{recurrenceCount}} lessons]]', LIVE_NOTE.en], cta: JOIN_CTA.en },
    ru: { subject: 'Новый онлайн-урок: {{lessonTitle}}', eyebrow: 'Онлайн-урок', lines: ['{{instructorName}} запланировал(а) онлайн-урок «{{lessonTitle}}».', 'Время: {{startsAt}}', 'Платформа: {{platformName}}', '[[Серия занятий: {{recurrenceCount}}]]', LIVE_NOTE.ru], cta: JOIN_CTA.ru },
  }),
  live_lesson_updated: compact({
    az: { subject: 'Canlı dərsin vaxtı dəyişdi: {{lessonTitle}}', eyebrow: 'Canlı dərs', lines: ['«{{lessonTitle}}» canlı dərsinin məlumatları yeniləndi.', 'Yeni vaxt: {{startsAt}}', '[[Əvvəlki vaxt: {{previousStartsAt}}]]', 'Platforma: {{platformName}}'], cta: JOIN_CTA.az },
    en: { subject: 'Live lesson time changed: {{lessonTitle}}', eyebrow: 'Live lesson', lines: ['The live lesson “{{lessonTitle}}” was updated.', 'New time: {{startsAt}}', '[[Previous time: {{previousStartsAt}}]]', 'Platform: {{platformName}}'], cta: JOIN_CTA.en },
    ru: { subject: 'Время онлайн-урока изменено: {{lessonTitle}}', eyebrow: 'Онлайн-урок', lines: ['Онлайн-урок «{{lessonTitle}}» обновлён.', 'Новое время: {{startsAt}}', '[[Прежнее время: {{previousStartsAt}}]]', 'Платформа: {{platformName}}'], cta: JOIN_CTA.ru },
  }),
  live_lesson_cancelled: compact({
    az: { subject: 'Canlı dərs ləğv edildi: {{lessonTitle}}', eyebrow: 'Canlı dərs', lines: ['{{startsAt}} tarixinə planlanan «{{lessonTitle}}» canlı dərsi ləğv edildi.', '[[Səbəb: {{reason}}]]'], cta: LESSONS_CTA.az },
    en: { subject: 'Live lesson cancelled: {{lessonTitle}}', eyebrow: 'Live lesson', lines: ['The live lesson “{{lessonTitle}}” scheduled for {{startsAt}} was cancelled.', '[[Reason: {{reason}}]]'], cta: LESSONS_CTA.en },
    ru: { subject: 'Онлайн-урок отменён: {{lessonTitle}}', eyebrow: 'Онлайн-урок', lines: ['Онлайн-урок «{{lessonTitle}}», запланированный на {{startsAt}}, отменён.', '[[Причина: {{reason}}]]'], cta: LESSONS_CTA.ru },
  }),
  live_lesson_reminder: compact({
    az: { subject: 'Xatırlatma: {{lessonTitle}} — {{startsAt}}', eyebrow: 'Canlı dərs', lines: ['«{{lessonTitle}}» canlı dərsi {{startsAt}} tarixində başlayır.', 'Platforma: {{platformName}}', LIVE_NOTE.az], cta: JOIN_CTA.az },
    en: { subject: 'Reminder: {{lessonTitle}} — {{startsAt}}', eyebrow: 'Live lesson', lines: ['The live lesson “{{lessonTitle}}” starts at {{startsAt}}.', 'Platform: {{platformName}}', LIVE_NOTE.en], cta: JOIN_CTA.en },
    ru: { subject: 'Напоминание: {{lessonTitle}} — {{startsAt}}', eyebrow: 'Онлайн-урок', lines: ['Онлайн-урок «{{lessonTitle}}» начнётся {{startsAt}}.', 'Платформа: {{platformName}}', LIVE_NOTE.ru], cta: JOIN_CTA.ru },
  }),
  billing_monthly_2d_student: compact({
    az: { subject: 'Ödəniş xatırlatması', eyebrow: 'Ödəniş', lines: ['Aylıq abunəliyinizin bitməsinə 2 gün qalıb. Davam etmək üçün ödənişi yeniləyin.'], cta: PAY_CTA.az },
    en: { subject: 'Payment reminder', eyebrow: 'Payment', lines: ['Your monthly subscription ends in 2 days. Please renew the payment to continue.'], cta: PAY_CTA.en },
    ru: { subject: 'Напоминание об оплате', eyebrow: 'Оплата', lines: ['До окончания месячной подписки осталось 2 дня. Продлите оплату, чтобы продолжить.'], cta: PAY_CTA.ru },
  }),
  billing_pkg_last_lesson_student: compact({
    az: { subject: 'Ödəniş xatırlatması: paket bitir', eyebrow: 'Ödəniş', lines: ['Dərs paketinizdə son dərs qalıb. Davam etmək üçün ödənişi yeniləyin.'], cta: PAY_CTA.az },
    en: { subject: 'Payment reminder: package ending', eyebrow: 'Payment', lines: ['One lesson is left in your package. Please renew the payment to continue.'], cta: PAY_CTA.en },
    ru: { subject: 'Напоминание об оплате: пакет заканчивается', eyebrow: 'Оплата', lines: ['В вашем пакете остался последний урок. Продлите оплату, чтобы продолжить.'], cta: PAY_CTA.ru },
  }),
  certificate_status_changed: compact({
    az: { subject: 'Sertifikatın statusu dəyişdi', eyebrow: 'Sertifikat', lines: ['«{{courseTitle}}» üzrə əvvəlki sertifikatınız artıq etibarlı deyil ({{statusLabel}}).', 'Aktual sertifikat və doğrulama səhifəsi panelinizdədir.'], cta: CERT_CTA.az },
    en: { subject: 'Certificate status changed', eyebrow: 'Certificate', lines: ['Your previous certificate for “{{courseTitle}}” is no longer valid ({{statusLabel}}).', 'The current certificate and its verification page are in your dashboard.'], cta: CERT_CTA.en },
    ru: { subject: 'Статус сертификата изменён', eyebrow: 'Сертификат', lines: ['Ваш предыдущий сертификат по «{{courseTitle}}» больше не действителен ({{statusLabel}}).', 'Актуальный сертификат и страница проверки — в вашем кабинете.'], cta: CERT_CTA.ru },
  }),
  parent_result_summary: compact({
    az: { subject: '{{studentName}}: imtahan nəticəsi hazırdır', eyebrow: 'Valideyn', lines: ['{{studentName}} «{{examTitle}}» imtahanını tamamladı.', 'Nəticəni və ətraflı xülasəni valideyn panelində görə bilərsiniz.'], cta: RESULT_CTA.az },
    en: { subject: '{{studentName}}: assessment result is ready', eyebrow: 'Parent', lines: ['{{studentName}} completed “{{examTitle}}”.', 'See the result and summary in your parent dashboard.'], cta: RESULT_CTA.en },
    ru: { subject: '{{studentName}}: результат экзамена готов', eyebrow: 'Родителям', lines: ['{{studentName}} завершил(а) «{{examTitle}}».', 'Результат и сводка — в кабинете родителя.'], cta: RESULT_CTA.ru },
  }),
  weekly_teacher_digest: compact({
    az: { subject: 'Həftəlik xülasə: {{periodLabel}}', eyebrow: 'Həftəlik xülasə', lines: ['Aktiv tələbələr: {{activeStudents}}', 'İmtahan təqdimatları: {{examSubmissions}}', 'Tapşırıq təqdimatları: {{assignmentSubmissions}}', 'Yoxlama gözləyən işlər: {{pendingReviews}}', 'Canlı dərslər: {{liveLessons}}'], cta: REPORT_CTA.az },
    en: { subject: 'Weekly summary: {{periodLabel}}', eyebrow: 'Weekly summary', lines: ['Active students: {{activeStudents}}', 'Assessment submissions: {{examSubmissions}}', 'Assignment submissions: {{assignmentSubmissions}}', 'Awaiting review: {{pendingReviews}}', 'Live lessons: {{liveLessons}}'], cta: REPORT_CTA.en },
    ru: { subject: 'Итоги недели: {{periodLabel}}', eyebrow: 'Итоги недели', lines: ['Активные ученики: {{activeStudents}}', 'Сдано экзаменов: {{examSubmissions}}', 'Сдано заданий: {{assignmentSubmissions}}', 'Ждут проверки: {{pendingReviews}}', 'Онлайн-уроки: {{liveLessons}}'], cta: REPORT_CTA.ru },
  }),
  storage_limit_warning: compact({
    az: { subject: 'Yaddaş limitinə yaxınlaşırsınız', eyebrow: 'Limit', lines: ['Bulud yaddaşınızın {{percent}}%-i istifadə olunub ({{used}} / {{limit}}).', 'Limitə çatdıqda yeni fayl yükləmək dayanır; mövcud fayllar silinmir.'], cta: STORAGE_CTA.az },
    en: { subject: 'You are nearing your storage limit', eyebrow: 'Limit', lines: ['{{percent}}% of your cloud storage is used ({{used}} / {{limit}}).', 'New uploads stop at the limit; existing files are not deleted.'], cta: STORAGE_CTA.en },
    ru: { subject: 'Хранилище почти заполнено', eyebrow: 'Лимит', lines: ['Облачное хранилище заполнено на {{percent}}% ({{used}} / {{limit}}).', 'При достижении лимита загрузка новых файлов останавливается; файлы не удаляются.'], cta: STORAGE_CTA.ru },
  }),
  storage_limit_reached: compact({
    az: { subject: 'Yaddaş limiti doldu', eyebrow: 'Limit', lines: ['Bulud yaddaşınız doldu ({{used}} / {{limit}}). Mövcud fayllar silinmir.', 'Yeni fayl yükləmək üçün köhnə faylları silin və ya dəstək ilə əlaqə saxlayın[[: {{supportPhone}}]].', '[[Daha geniş paketə də keçə bilərsiniz: {{nextPlan}}.]]'], cta: STORAGE_CTA.az },
    en: { subject: 'Storage limit reached', eyebrow: 'Limit', lines: ['Your cloud storage is full ({{used}} / {{limit}}). Existing files are kept.', 'To upload new files, delete old files or contact support[[: {{supportPhone}}]].', '[[You can also upgrade to {{nextPlan}}.]]'], cta: STORAGE_CTA.en },
    ru: { subject: 'Хранилище заполнено', eyebrow: 'Лимит', lines: ['Облачное хранилище заполнено ({{used}} / {{limit}}). Существующие файлы сохраняются.', 'Чтобы загрузить новые файлы, удалите старые или свяжитесь с поддержкой[[: {{supportPhone}}]].', '[[Также можно перейти на тариф {{nextPlan}}.]]'], cta: STORAGE_CTA.ru },
  }),
  legacy_recordings_retiring: compact({
    az: { subject: 'Köhnə video yazılarınız {{deleteAfter}} tarixindən sonra silinəcək', eyebrow: 'Video yazılar', lines: ['Mentorix-in daxili video otağı dayandırılıb. Sizin {{count}} dərs yazınız ({{size}}) hələ saxlanılır.', 'Onları {{deleteAfter}} tarixinədək yükləyə bilərsiniz: Canlı dərslər → Köhnə dərs yazıları → «Yüklə».', 'Bu tarixdən sonra yazılar silinə bilər. Sualınız varsa dəstək ilə əlaqə saxlayın.'], cta: 'Yazıları yüklə' },
    en: { subject: 'Your old video recordings will be deleted after {{deleteAfter}}', eyebrow: 'Recordings', lines: ['The Mentorix internal video room has been retired. {{count}} of your lesson recordings ({{size}}) are still stored.', 'You can download them until {{deleteAfter}}: Live lessons → Old lesson recordings → “Download”.', 'After that date the recordings may be deleted. Contact support if you have questions.'], cta: 'Download recordings' },
    ru: { subject: 'Ваши старые видеозаписи будут удалены после {{deleteAfter}}', eyebrow: 'Видеозаписи', lines: ['Встроенная видеокомната Mentorix закрыта. У вас ещё хранится {{count}} записей уроков ({{size}}).', 'Их можно скачать до {{deleteAfter}}: Живые уроки → Старые записи уроков → «Скачать».', 'После этой даты записи могут быть удалены. Если есть вопросы, свяжитесь с поддержкой.'], cta: 'Скачать записи' },
  }),
  legacy_plan_migration_notice: compact({
    az: { subject: 'STANDART paketi PROFESSIONAL ilə əvəz olunur', eyebrow: 'Paket', lines: ['Köhnə STANDART paketi ({{oldPrice}}/ay) artıq təklif olunmur. Cari ödənişli dövrünüz dəyişmir[[ ({{periodEnd}} tarixinədək)]].', '[[{{effectiveDate}} tarixindən sonrakı yeniləməniz {{newPlan}} paketi ilə olacaq ({{newPrice}}/ay: 50 tələbə, 20 GB yaddaş).]]', '[[Dövrün bitməsinə {{daysLeft}} gün qaldığı üçün növbəti yeniləməni bir dəfə də {{oldPrice}}-ə (aylıq) edə bilərsiniz; ondan sonrakı yeniləmə {{newPlan}} ({{newPrice}}/ay) olacaq və 14 gün əvvəl yenidən xəbər verəcəyik.]]', 'Avtomatik ödəniş yoxdur — yeniləmə yalnız siz ödəniş etdikdə baş verir.'], cta: 'Paketlərə bax' },
    en: { subject: 'STANDART is being replaced by PROFESSIONAL', eyebrow: 'Plan', lines: ['The old STANDART plan ({{oldPrice}}/month) is no longer offered. Your current paid period does not change[[ (until {{periodEnd}})]].', '[[Your renewal after {{effectiveDate}} will be on the {{newPlan}} plan ({{newPrice}}/month: 50 students, 20 GB storage).]]', '[[Because your period ends in {{daysLeft}} days, you can renew once more at {{oldPrice}} (monthly); the renewal after that will be {{newPlan}} ({{newPrice}}/month) and we will remind you 14 days before.]]', 'There is no automatic charge — a renewal only happens when you make a payment.'], cta: 'View plans' },
    ru: { subject: 'Тариф STANDART заменяется на PROFESSIONAL', eyebrow: 'Тариф', lines: ['Старый тариф STANDART ({{oldPrice}}/мес.) больше не предлагается. Текущий оплаченный период не меняется[[ (до {{periodEnd}})]].', '[[Продление после {{effectiveDate}} будет на тарифе {{newPlan}} ({{newPrice}}/мес.: 50 учеников, 20 ГБ хранилища).]]', '[[Так как до конца периода осталось {{daysLeft}} дн., вы можете ещё один раз продлить за {{oldPrice}} (помесячно); следующее продление будет на {{newPlan}} ({{newPrice}}/мес.), и мы напомним за 14 дней.]]', 'Автоматического списания нет — продление происходит только когда вы сами оплачиваете.'], cta: 'Открыть тарифы' },
  }),
};

Object.assign(TEMPLATES, EMAIL_FIRST_TEMPLATES);

/** One-click unsubscribe line (category-scoped) for preference-controlled emails. */
const UNSUBSCRIBE = {
  az: (url) => `Bu növ e-poçtları almaq istəmirsinizsə: ${url}`,
  en: (url) => `Unsubscribe from this type of email: ${url}`,
  ru: (url) => `Отписаться от таких писем: ${url}`,
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

module.exports = { TEMPLATES, FOOTER, LINK_HINT, UNSUBSCRIBE, EMAIL_FIRST_TEMPLATES };
