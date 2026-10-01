/**
 * In-app bildiriş mətnləri (az/en/ru). Saxlanılan title/body alıcının `users.locale` dilində render olunur;
 * `meta.i18n = { key, params }` də saxlanılır ki, frontend cari dildə yenidən göstərə bilsin
 * (frontend açarları: notificationCenter.events.<key>.title|body).
 * Parametrlərdə gizli məlumat olmamalıdır (cavab açarı, bal, token, şəxsi rəy).
 * `[[ ... ]]` — içindəki parametrlərdən biri boşdursa bütöv hissə atılır (frontend-də bu açarlar yoxdur,
 * orada saxlanılan mətn göstərilir).
 */

const TEMPLATES = Object.freeze({
  join_request: {
    az: {
      title: 'Yeni qoşulma sorğusu',
      body: '{{studentName}} «{{groupName}}» qrupunuza qoşulmaq istəyir. Təsdiqləyin.',
    },
    en: {
      title: 'New join request',
      body: '{{studentName}} wants to join your group “{{groupName}}”. Please review the request.',
    },
    ru: {
      title: 'Новая заявка на вступление',
      body: '{{studentName}} хочет вступить в вашу группу «{{groupName}}». Рассмотрите заявку.',
    },
  },
  exam_access_request: {
    az: {
      title: 'İmtahana giriş sorğusu',
      body: '{{studentName}} «{{examTitle}}» imtahanına qoşulmaq istəyir. Təsdiqləyin.',
    },
    en: {
      title: 'Assessment access request',
      body: '{{studentName}} wants to join the assessment “{{examTitle}}”. Please review the request.',
    },
    ru: {
      title: 'Запрос на доступ к экзамену',
      body: '{{studentName}} хочет получить доступ к экзамену «{{examTitle}}». Рассмотрите запрос.',
    },
  },
  task_access_request: {
    az: {
      title: 'Tapşırıq giriş sorğusu',
      body: '{{studentName}} «{{assignmentTitle}}» tapşırığına qoşulmaq istəyir. Təsdiqləyin.',
    },
    en: {
      title: 'Assignment access request',
      body: '{{studentName}} wants to join the assignment “{{assignmentTitle}}”. Please review the request.',
    },
    ru: {
      title: 'Запрос на доступ к заданию',
      body: '{{studentName}} хочет получить доступ к заданию «{{assignmentTitle}}». Рассмотрите запрос.',
    },
  },
  assignment_submitted: {
    az: {
      title: 'Tapşırıq təslim edildi',
      body: '{{studentName}} «{{assignmentTitle}}» tapşırığını təslim etdi.',
    },
    en: {
      title: 'Assignment submitted',
      body: '{{studentName}} submitted the assignment “{{assignmentTitle}}”.',
    },
    ru: {
      title: 'Задание сдано',
      body: '{{studentName}} сдал(а) задание «{{assignmentTitle}}».',
    },
  },
  assignment_late_submitted: {
    az: {
      title: 'Tapşırıq gecikmə ilə təslim edildi',
      body: '{{studentName}} «{{assignmentTitle}}» tapşırığını son tarixdən sonra təslim etdi.',
    },
    en: {
      title: 'Assignment submitted late',
      body: '{{studentName}} submitted the assignment “{{assignmentTitle}}” after the due date.',
    },
    ru: {
      title: 'Задание сдано с опозданием',
      body: '{{studentName}} сдал(а) задание «{{assignmentTitle}}» после срока.',
    },
  },
  open_grading_pending: {
    az: {
      title: 'Açıq sual qiymətləndirməsi',
      body: '{{count}} tələbənin cavabı təsdiqinizi gözləyir — «{{examTitle}}».',
    },
    en: {
      title: 'Open answers awaiting review',
      body: '{{count}} student answers are waiting for your confirmation — “{{examTitle}}”.',
    },
    ru: {
      title: 'Открытые ответы ждут проверки',
      body: 'Ответы учеников ({{count}}) ждут вашего подтверждения — «{{examTitle}}».',
    },
  },

  /* ---------- Teacher: assessments ---------- */
  exam_submitted: {
    az: { title: 'İmtahan təqdim edildi', body: '{{studentName}} «{{examTitle}}» imtahanını təqdim etdi.' },
    en: { title: 'Assessment submitted', body: '{{studentName}} submitted the assessment “{{examTitle}}”.' },
    ru: { title: 'Экзамен сдан', body: '{{studentName}} сдал(а) экзамен «{{examTitle}}».' },
  },
  exam_submitted_review: {
    az: {
      title: 'İmtahan yoxlama gözləyir',
      body: '{{studentName}} «{{examTitle}}» imtahanını təqdim etdi — açıq cavablar yoxlamanızı gözləyir.',
    },
    en: {
      title: 'Assessment awaiting review',
      body: '{{studentName}} submitted “{{examTitle}}” — open answers are waiting for your review.',
    },
    ru: {
      title: 'Экзамен ждёт проверки',
      body: '{{studentName}} сдал(а) «{{examTitle}}» — открытые ответы ждут вашей проверки.',
    },
  },
  exam_auto_submitted: {
    az: {
      title: 'Vaxt bitdi — avtomatik təqdim edildi',
      body: '{{studentName}} üçün «{{examTitle}}» imtahanının vaxtı bitdi, cavablar avtomatik təqdim edildi.',
    },
    en: {
      title: 'Time ran out — auto-submitted',
      body: 'Time ran out for {{studentName}} on “{{examTitle}}”; the answers were submitted automatically.',
    },
    ru: {
      title: 'Время вышло — отправлено автоматически',
      body: 'У {{studentName}} закончилось время на экзамене «{{examTitle}}», ответы отправлены автоматически.',
    },
  },
  exam_auto_submitted_review: {
    az: {
      title: 'Avtomatik təqdim — yoxlama gözləyir',
      body: '{{studentName}} üçün «{{examTitle}}» imtahanının vaxtı bitdi; açıq cavablar yoxlamanızı gözləyir.',
    },
    en: {
      title: 'Auto-submitted — awaiting review',
      body: 'Time ran out for {{studentName}} on “{{examTitle}}”; open answers are waiting for your review.',
    },
    ru: {
      title: 'Отправлено автоматически — ждёт проверки',
      body: 'У {{studentName}} закончилось время на «{{examTitle}}»; открытые ответы ждут вашей проверки.',
    },
  },
  exam_expired_no_answers: {
    az: {
      title: 'Cavabsız bitən cəhdlər',
      body: '«{{examTitle}}» imtahanında bəzi tələbələrin vaxtı cavab vermədən bitdi.',
    },
    en: {
      title: 'Attempts expired without answers',
      body: 'Some students ran out of time on “{{examTitle}}” without answering.',
    },
    ru: {
      title: 'Попытки истекли без ответов',
      body: 'У некоторых учеников закончилось время на экзамене «{{examTitle}}» без ответов.',
    },
  },
  catalog_exam_approved: {
    az: {
      title: 'Kataloq təsdiqi',
      body: '«{{examTitle}}» imtahanınız təsdiqləndi və sertifikatlı imtahan kataloqunda yayımlandı.',
    },
    en: {
      title: 'Catalog approval',
      body: 'Your assessment “{{examTitle}}” was approved and published in the certified catalog.',
    },
    ru: {
      title: 'Одобрено для каталога',
      body: 'Ваш экзамен «{{examTitle}}» одобрен и опубликован в каталоге сертифицированных экзаменов.',
    },
  },
  catalog_exam_rejected: {
    az: {
      title: 'Kataloq rəddi',
      body:
        '«{{examTitle}}» imtahanınız kataloq üçün rədd edildi: {{reason}}. ' +
        'Düzəliş edib yenidən «Kataloqda göstərilsin» seçimini aktivləşdirə bilərsiniz.',
    },
    en: {
      title: 'Catalog rejection',
      body: 'Your assessment “{{examTitle}}” was not accepted for the catalog: {{reason}}. You can edit it and submit it again.',
    },
    ru: {
      title: 'Отказ в каталоге',
      body: 'Ваш экзамен «{{examTitle}}» не принят в каталог: {{reason}}. Исправьте его и отправьте снова.',
    },
  },

  /* ---------- Student ---------- */
  exam_assigned: {
    az: {
      title: 'Yeni imtahan',
      body: '«{{examTitle}}» imtahanına təyin edildiniz.[[ Vaxt: {{schedule}}.]][[ Müddət: {{minutes}} dəqiqə.]]',
    },
    en: {
      title: 'New assessment',
      body: 'You have been assigned the assessment “{{examTitle}}”.[[ Time: {{schedule}}.]][[ Duration: {{minutes}} min.]]',
    },
    ru: {
      title: 'Новый экзамен',
      body: 'Вам назначен экзамен «{{examTitle}}».[[ Время: {{schedule}}.]][[ Длительность: {{minutes}} мин.]]',
    },
  },
  exam_access_approved: {
    az: {
      title: 'İmtahana giriş təsdiqləndi',
      body: '«{{examTitle}}» üçün müəlliminiz icazə verdi. İndi imtahana başlaya bilərsiniz.',
    },
    en: {
      title: 'Assessment access approved',
      body: 'Your teacher approved your access to “{{examTitle}}”. You can start the assessment now.',
    },
    ru: {
      title: 'Доступ к экзамену открыт',
      body: 'Преподаватель открыл вам доступ к экзамену «{{examTitle}}». Можно начинать.',
    },
  },
  exam_access_rejected: {
    az: { title: 'İmtahana giriş rədd edildi', body: '«{{examTitle}}» üçün müəllim sorğunuzu rədd etdi.' },
    en: { title: 'Assessment access declined', body: 'Your teacher declined your request to join “{{examTitle}}”.' },
    ru: { title: 'В доступе к экзамену отказано', body: 'Преподаватель отклонил ваш запрос на экзамен «{{examTitle}}».' },
  },
  exam_result_released: {
    az: { title: 'Nəticə açıqlandı', body: '«{{examTitle}}» imtahanının nəticəsi açıqlandı.' },
    en: { title: 'Result released', body: 'Your result for “{{examTitle}}” is now available.' },
    ru: { title: 'Результат опубликован', body: 'Результат экзамена «{{examTitle}}» доступен.' },
  },
  task_access_rejected: {
    az: { title: 'Tapşırığa giriş rədd edildi', body: '«{{assignmentTitle}}» üçün müəllim sorğunuzu rədd etdi.' },
    en: { title: 'Assignment access declined', body: 'Your teacher declined your request to join “{{assignmentTitle}}”.' },
    ru: { title: 'В доступе к заданию отказано', body: 'Преподаватель отклонил ваш запрос на задание «{{assignmentTitle}}».' },
  },
  join_request_approved: {
    az: { title: 'Qoşulma sorğusu təsdiqləndi', body: '«{{groupName}}» qrupuna qəbul olundunuz.' },
    en: { title: 'Join request approved', body: 'You have been accepted into the group “{{groupName}}”.' },
    ru: { title: 'Заявка одобрена', body: 'Вас приняли в группу «{{groupName}}».' },
  },
  join_request_rejected: {
    az: { title: 'Qoşulma sorğusu rədd edildi', body: '«{{groupName}}» qrupuna qoşulma sorğunuz rədd edildi.' },
    en: { title: 'Join request declined', body: 'Your request to join the group “{{groupName}}” was declined.' },
    ru: { title: 'Заявка отклонена', body: 'Ваша заявка на вступление в группу «{{groupName}}» отклонена.' },
  },
  assignment_new: {
    az: { title: 'Yeni tapşırıq', body: '«{{assignmentTitle}}» — {{instructorName}} təyin etdi.[[ Son tarix: {{dueDate}}.]]' },
    en: { title: 'New assignment', body: '“{{assignmentTitle}}” was assigned by {{instructorName}}.[[ Due: {{dueDate}}.]]' },
    ru: { title: 'Новое задание', body: '«{{assignmentTitle}}» — задание от {{instructorName}}.[[ Срок: {{dueDate}}.]]' },
  },
  assignment_due_soon: {
    az: {
      title: 'Tapşırıq xatırlatması',
      body: '«{{assignmentTitle}}» üçün son tarixə 24 saatdan az qalıb ({{dueDate}}).',
    },
    en: {
      title: 'Assignment reminder',
      body: 'Less than 24 hours left to submit “{{assignmentTitle}}” (due {{dueDate}}).',
    },
    ru: {
      title: 'Напоминание о задании',
      body: 'До срока сдачи «{{assignmentTitle}}» осталось меньше 24 часов ({{dueDate}}).',
    },
  },
  assignment_overdue: {
    az: {
      title: 'Tapşırıq gecikib',
      body: '«{{assignmentTitle}}» üçün son tarix keçib. Təslim edin və ya müəllimlə əlaqə saxlayın.',
    },
    en: {
      title: 'Assignment overdue',
      body: 'The due date for “{{assignmentTitle}}” has passed. Submit it or contact your teacher.',
    },
    ru: {
      title: 'Задание просрочено',
      body: 'Срок сдачи «{{assignmentTitle}}» прошёл. Сдайте задание или свяжитесь с преподавателем.',
    },
  },
  assignment_reviewed: {
    az: {
      title: 'Tapşırıq yoxlanıldı',
      body: '«{{assignmentTitle}}» üçün müəllim rəy bildirdi. Nəticəni görmək üçün tapşırığı açın.',
    },
    en: {
      title: 'Assignment reviewed',
      body: 'Your teacher reviewed “{{assignmentTitle}}”. Open the assignment to see the result.',
    },
    ru: {
      title: 'Задание проверено',
      body: 'Преподаватель проверил задание «{{assignmentTitle}}». Откройте его, чтобы увидеть результат.',
    },
  },
  assignment_returned: {
    az: {
      title: 'Tapşırıq düzəlişə qaytarıldı',
      body: 'Müəlliminiz «{{assignmentTitle}}» tapşırığını düzəliş üçün qaytardı. Yenidən təslim edin.',
    },
    en: {
      title: 'Assignment returned for revision',
      body: 'Your teacher returned “{{assignmentTitle}}” for revision. Please submit it again.',
    },
    ru: {
      title: 'Задание возвращено на доработку',
      body: 'Преподаватель вернул задание «{{assignmentTitle}}» на доработку. Отправьте его снова.',
    },
  },
  material_shared: {
    az: { title: 'Yeni material', body: '{{instructorName}} sizinlə «{{materialTitle}}» materialını paylaşdı.' },
    en: { title: 'New material', body: '{{instructorName}} shared the material “{{materialTitle}}” with you.' },
    ru: { title: 'Новый материал', body: '{{instructorName}} поделился(-ась) с вами материалом «{{materialTitle}}».' },
  },
  profile_completion: {
    az: {
      title: 'Qeydiyyatı tamamlayın',
      body: 'Müəlliminiz profil məlumatlarınızı (ad, soyad, mobil telefon) tamamlamağınızı xahiş edir.[[ Link: {{url}}]]',
    },
    en: {
      title: 'Complete your registration',
      body: 'Your teacher asks you to complete your profile (first name, last name, mobile phone).[[ Link: {{url}}]]',
    },
    ru: {
      title: 'Завершите регистрацию',
      body: 'Преподаватель просит заполнить профиль (имя, фамилия, мобильный телефон).[[ Ссылка: {{url}}]]',
    },
  },

  /* ---------- Partner ---------- */
  partner_application_approved: {
    az: {
      title: 'Partnyor müraciəti təsdiqləndi',
      body: 'Partnyor proqramına müraciətiniz təsdiqləndi. Referal linkiniz panelinizdə hazırdır.',
    },
    en: {
      title: 'Partner application approved',
      body: 'Your partner program application was approved. Your referral link is ready in your dashboard.',
    },
    ru: {
      title: 'Заявка партнёра одобрена',
      body: 'Ваша заявка в партнёрскую программу одобрена. Реферальная ссылка доступна в кабинете.',
    },
  },
  partner_application_rejected: {
    az: { title: 'Partnyor müraciəti rədd edildi', body: 'Partnyor proqramına müraciətiniz rədd edildi.' },
    en: { title: 'Partner application declined', body: 'Your partner program application was declined.' },
    ru: { title: 'Заявка партнёра отклонена', body: 'Ваша заявка в партнёрскую программу отклонена.' },
  },
  partner_suspended: {
    az: {
      title: 'Partnyor hesabı dayandırıldı',
      body: 'Partnyor hesabınız dayandırıldı. Ətraflı məlumat üçün dəstəklə əlaqə saxlayın.',
    },
    en: { title: 'Partner account suspended', body: 'Your partner account was suspended. Please contact support for details.' },
    ru: { title: 'Партнёрский аккаунт приостановлен', body: 'Ваш партнёрский аккаунт приостановлен. Обратитесь в поддержку.' },
  },
  partner_commission_approved: {
    az: { title: 'Komissiya təsdiqləndi', body: 'Referal ödənişi üzrə {{amount}} ₼ komissiya balansınıza əlavə olundu.' },
    en: { title: 'Commission approved', body: 'A commission of {{amount}} AZN from a referral payment was added to your balance.' },
    ru: { title: 'Комиссия одобрена', body: 'Комиссия {{amount}} AZN за реферальный платёж зачислена на ваш баланс.' },
  },
  partner_payout_approved: {
    az: { title: 'Ödəniş təsdiqləndi', body: '{{amount}} ₼ ödəniş sorğunuz təsdiqləndi.' },
    en: { title: 'Payout approved', body: 'Your payout request of {{amount}} AZN was approved.' },
    ru: { title: 'Выплата одобрена', body: 'Ваш запрос на выплату {{amount}} AZN одобрен.' },
  },
  partner_payout_paid: {
    az: { title: 'Ödəniş uğurlu', body: '{{amount}} ₼ uğurla hesabınıza ödənildi' },
    en: { title: 'Payout sent', body: '{{amount}} AZN was paid to your account' },
    ru: { title: 'Выплата отправлена', body: '{{amount}} AZN выплачено на ваш счёт' },
  },
  partner_payout_rejected: {
    az: {
      title: 'Ödəniş sorğusu rədd edildi',
      body: '{{amount}} ₼ ödəniş sorğunuz rədd edildi. Komissiyalar balansınıza qaytarıldı.',
    },
    en: {
      title: 'Payout request declined',
      body: 'Your payout request of {{amount}} AZN was declined. The commissions are back in your balance.',
    },
    ru: {
      title: 'Запрос на выплату отклонён',
      body: 'Ваш запрос на выплату {{amount}} AZN отклонён. Комиссии возвращены на баланс.',
    },
  },

  /* ---------- Admin ---------- */
  partner_application_submitted: {
    az: { title: 'Yeni partnyor müraciəti', body: '{{partnerName}} partnyor proqramına müraciət etdi.' },
    en: { title: 'New partner application', body: '{{partnerName}} applied to the partner program.' },
    ru: { title: 'Новая заявка партнёра', body: '{{partnerName}} подал(а) заявку в партнёрскую программу.' },
  },
  partner_payout_requested: {
    az: { title: 'Ödəniş sorğusu yoxlama gözləyir', body: '{{partnerName}} {{amount}} ₼ ödəniş tələb etdi.' },
    en: { title: 'Payout request awaiting review', body: '{{partnerName}} requested a payout of {{amount}} AZN.' },
    ru: { title: 'Запрос на выплату ждёт проверки', body: '{{partnerName}} запросил(а) выплату {{amount}} AZN.' },
  },
  notification_delivery_failed: {
    az: {
      title: 'Bildirişlər çatdırılmadı',
      body: '{{from}}–{{to}} (UTC) arasında {{count}} email bildirişi çatdırılmadı.',
    },
    en: {
      title: 'Notification deliveries failed',
      body: '{{count}} notification emails failed to deliver between {{from}} and {{to}} (UTC).',
    },
    ru: {
      title: 'Уведомления не доставлены',
      body: 'С {{from}} до {{to}} (UTC) не доставлено email-уведомлений: {{count}}.',
    },
  },
  admin_login_failures: {
    az: {
      title: 'Admin girişində uğursuz cəhdlər',
      body: '{{account}} admin hesabına son {{minutes}} dəqiqədə {{count}} uğursuz giriş cəhdi olub.',
    },
    en: {
      title: 'Failed admin sign-ins',
      body: '{{count}} failed sign-in attempts on the admin account {{account}} in the last {{minutes}} minutes.',
    },
    ru: {
      title: 'Неудачные входы администратора',
      body: 'Неудачных попыток входа в админ-аккаунт {{account}} за последние {{minutes}} мин: {{count}}.',
    },
  },

  /* ---------- Email-first: exams, live lessons (Meet/Zoom links), certificates, parent, digest, limits ---------- */
  exam_starting_soon: {
    az: { title: 'İmtahan tezliklə başlayır', body: '«{{examTitle}}» imtahanı {{startsAt}} tarixində başlayır.[[ Müddət: {{minutes}} dəqiqə.]]' },
    en: { title: 'Assessment starts soon', body: '“{{examTitle}}” starts at {{startsAt}}.[[ Duration: {{minutes}} min.]]' },
    ru: { title: 'Экзамен скоро начнётся', body: 'Экзамен «{{examTitle}}» начнётся {{startsAt}}.[[ Длительность: {{minutes}} мин.]]' },
  },
  live_lesson_created: {
    az: {
      title: 'Yeni canlı dərs',
      body: '{{instructorName}} «{{lessonTitle}}» canlı dərsini planladı: {{startsAt}} ({{platformName}}).[[ Təkrarlanan seriya: {{recurrenceCount}} dərs.]]',
    },
    en: {
      title: 'New live lesson',
      body: '{{instructorName}} scheduled the live lesson “{{lessonTitle}}”: {{startsAt}} ({{platformName}}).[[ Recurring series: {{recurrenceCount}} lessons.]]',
    },
    ru: {
      title: 'Новый онлайн-урок',
      body: '{{instructorName}} запланировал(а) онлайн-урок «{{lessonTitle}}»: {{startsAt}} ({{platformName}}).[[ Серия занятий: {{recurrenceCount}}.]]',
    },
  },
  live_lesson_updated: {
    az: { title: 'Canlı dərs dəyişdi', body: '«{{lessonTitle}}» canlı dərsinin məlumatları yeniləndi. Yeni vaxt: {{startsAt}}.' },
    en: { title: 'Live lesson changed', body: 'The live lesson “{{lessonTitle}}” was updated. New time: {{startsAt}}.' },
    ru: { title: 'Онлайн-урок изменён', body: 'Онлайн-урок «{{lessonTitle}}» обновлён. Новое время: {{startsAt}}.' },
  },
  live_lesson_cancelled: {
    az: { title: 'Canlı dərs ləğv edildi', body: '{{startsAt}} tarixinə planlanan «{{lessonTitle}}» canlı dərsi ləğv edildi.' },
    en: { title: 'Live lesson cancelled', body: 'The live lesson “{{lessonTitle}}” scheduled for {{startsAt}} was cancelled.' },
    ru: { title: 'Онлайн-урок отменён', body: 'Онлайн-урок «{{lessonTitle}}», запланированный на {{startsAt}}, отменён.' },
  },
  live_lesson_reminder: {
    az: { title: 'Canlı dərs xatırlatması', body: '«{{lessonTitle}}» canlı dərsi {{startsAt}} tarixində başlayır ({{platformName}}).' },
    en: { title: 'Live lesson reminder', body: 'The live lesson “{{lessonTitle}}” starts at {{startsAt}} ({{platformName}}).' },
    ru: { title: 'Напоминание об онлайн-уроке', body: 'Онлайн-урок «{{lessonTitle}}» начнётся {{startsAt}} ({{platformName}}).' },
  },
  certificate_issued: {
    az: { title: 'Sertifikat hazırdır', body: '«{{courseTitle}}» üzrə sertifikatınız yaradıldı.' },
    en: { title: 'Certificate ready', body: 'Your certificate for “{{courseTitle}}” has been issued.' },
    ru: { title: 'Сертификат готов', body: 'Ваш сертификат по «{{courseTitle}}» выдан.' },
  },
  certificate_status_changed: {
    az: {
      title: 'Sertifikatın statusu dəyişdi',
      body: '«{{courseTitle}}» üzrə əvvəlki sertifikatınız artıq etibarlı deyil ({{statusLabel}}). Aktual sertifikatı panelinizdə görə bilərsiniz.',
    },
    en: {
      title: 'Certificate status changed',
      body: 'Your previous certificate for “{{courseTitle}}” is no longer valid ({{statusLabel}}). See the current certificate in your dashboard.',
    },
    ru: {
      title: 'Статус сертификата изменён',
      body: 'Ваш предыдущий сертификат по «{{courseTitle}}» больше не действителен ({{statusLabel}}). Актуальный сертификат — в вашем кабинете.',
    },
  },
  certificate_reinstated: {
    az: {
      title: 'Sertifikatınız yenidən aktivdir',
      body: '«{{courseTitle}}» üzrə sertifikatınız yenidən etibarlıdır. Onu və doğrulama səhifəsini panelinizdə görə bilərsiniz.',
    },
    en: {
      title: 'Your certificate is active again',
      body: 'Your certificate for “{{courseTitle}}” is valid again. See it and its verification page in your dashboard.',
    },
    ru: {
      title: 'Ваш сертификат снова действителен',
      body: 'Ваш сертификат по «{{courseTitle}}» снова действителен. Он и страница проверки — в вашем кабинете.',
    },
  },
  parent_result_summary: {
    az: { title: 'Övladınızın nəticəsi hazırdır', body: '{{studentName}} «{{examTitle}}» imtahanını tamamladı. Nəticəni panelinizdə görə bilərsiniz.' },
    en: { title: 'Your child’s result is ready', body: '{{studentName}} completed “{{examTitle}}”. You can see the result in your dashboard.' },
    ru: { title: 'Результат вашего ребёнка готов', body: '{{studentName}} завершил(а) «{{examTitle}}». Результат доступен в вашем кабинете.' },
  },
  weekly_teacher_digest: {
    az: {
      title: 'Həftəlik xülasə',
      body: '{{periodLabel}}: {{activeStudents}} aktiv tələbə, {{examSubmissions}} imtahan təqdimatı, {{assignmentSubmissions}} tapşırıq təqdimatı, {{pendingReviews}} yoxlama gözləyən iş, {{liveLessons}} canlı dərs.',
    },
    en: {
      title: 'Weekly summary',
      body: '{{periodLabel}}: {{activeStudents}} active students, {{examSubmissions}} assessment submissions, {{assignmentSubmissions}} assignment submissions, {{pendingReviews}} items awaiting review, {{liveLessons}} live lessons.',
    },
    ru: {
      title: 'Итоги недели',
      body: '{{periodLabel}}: активных учеников — {{activeStudents}}, сдано экзаменов — {{examSubmissions}}, сдано заданий — {{assignmentSubmissions}}, ждут проверки — {{pendingReviews}}, онлайн-уроков — {{liveLessons}}.',
    },
  },
  storage_limit_warning: {
    az: { title: 'Yaddaş limitinin {{percent}}%-i doldu', body: 'Bulud yaddaşınızın {{used}} / {{limit}} hissəsi istifadə olunub. Limitə çatdıqda yeni fayl yükləmək dayanır.' },
    en: { title: '{{percent}}% of your storage is used', body: 'You are using {{used}} of {{limit}} cloud storage. New uploads stop when the limit is reached.' },
    ru: { title: 'Хранилище заполнено на {{percent}}%', body: 'Использовано {{used}} из {{limit}} облачного хранилища. При достижении лимита загрузка новых файлов останавливается.' },
  },
  storage_limit_reached: {
    az: {
      title: 'Yaddaş limiti doldu',
      body: 'Bulud yaddaşınız doldu ({{used}} / {{limit}}). Mövcud fayllar silinmir. Yeni fayl yükləmək üçün köhnə faylları silin və ya dəstək ilə əlaqə saxlayın[[ ({{supportPhone}})]].[[ Daha geniş paketə də keçə bilərsiniz: {{nextPlan}}.]]',
    },
    en: {
      title: 'Storage limit reached',
      body: 'Your cloud storage is full ({{used}} / {{limit}}). Existing files are kept. To upload new files, delete old files or contact support[[ ({{supportPhone}})]].[[ You can also upgrade to {{nextPlan}}.]]',
    },
    ru: {
      title: 'Хранилище заполнено',
      body: 'Облачное хранилище заполнено ({{used}} / {{limit}}). Существующие файлы сохраняются. Чтобы загрузить новые файлы, удалите старые или свяжитесь с поддержкой[[ ({{supportPhone}})]].[[ Также можно перейти на тариф {{nextPlan}}.]]',
    },
  },
  legacy_recordings_retiring: {
    az: {
      title: 'Köhnə video yazılarınız {{deleteAfter}} tarixindən sonra silinəcək',
      body: 'Mentorix-in daxili video otağı dayandırılıb. Sizin {{count}} dərs yazınız ({{size}}) hələ saxlanılır. Onları {{deleteAfter}} tarixinədək yükləyə bilərsiniz: Canlı dərslər → Köhnə dərs yazıları → «Yüklə». Bu tarixdən sonra yazılar silinə bilər. Sualınız varsa dəstək ilə əlaqə saxlayın.',
    },
    en: {
      title: 'Your old video recordings will be deleted after {{deleteAfter}}',
      body: 'The Mentorix internal video room has been retired. {{count}} of your lesson recordings ({{size}}) are still stored. You can download them until {{deleteAfter}}: Live lessons → Old lesson recordings → “Download”. After that date the recordings may be deleted. Contact support if you have questions.',
    },
    ru: {
      title: 'Ваши старые видеозаписи будут удалены после {{deleteAfter}}',
      body: 'Встроенная видеокомната Mentorix закрыта. У вас ещё хранится {{count}} записей уроков ({{size}}). Их можно скачать до {{deleteAfter}}: Живые уроки → Старые записи уроков → «Скачать». После этой даты записи могут быть удалены. Если есть вопросы, свяжитесь с поддержкой.',
    },
  },
  legacy_plan_migration_notice: {
    az: {
      title: 'STANDART paketi PROFESSIONAL ilə əvəz olunur',
      body: 'Köhnə STANDART paketi ({{oldPrice}}/ay) artıq təklif olunmur. Cari ödənişli dövrünüz dəyişmir[[ ({{periodEnd}} tarixinədək)]]. [[{{effectiveDate}} tarixindən sonrakı yeniləməniz {{newPlan}} paketi ilə olacaq ({{newPrice}}/ay: 50 tələbə, 20 GB yaddaş).]][[Dövrün bitməsinə {{daysLeft}} gün qaldığı üçün növbəti yeniləməni bir dəfə də {{oldPrice}}-ə (aylıq) edə bilərsiniz; ondan sonrakı yeniləmə {{newPlan}} ({{newPrice}}/ay) olacaq və 14 gün əvvəl yenidən xəbər verəcəyik.]] Avtomatik ödəniş yoxdur — yeniləmə yalnız siz ödəniş etdikdə baş verir.',
    },
    en: {
      title: 'STANDART is being replaced by PROFESSIONAL',
      body: 'The old STANDART plan ({{oldPrice}}/month) is no longer offered. Your current paid period does not change[[ (until {{periodEnd}})]]. [[Your renewal after {{effectiveDate}} will be on the {{newPlan}} plan ({{newPrice}}/month: 50 students, 20 GB storage).]][[Because your period ends in {{daysLeft}} days, you can renew once more at {{oldPrice}} (monthly); the renewal after that will be {{newPlan}} ({{newPrice}}/month) and we will remind you 14 days before.]] There is no automatic charge — a renewal only happens when you make a payment.',
    },
    ru: {
      title: 'Тариф STANDART заменяется на PROFESSIONAL',
      body: 'Старый тариф STANDART ({{oldPrice}}/мес.) больше не предлагается. Текущий оплаченный период не меняется[[ (до {{periodEnd}})]]. [[Продление после {{effectiveDate}} будет на тарифе {{newPlan}} ({{newPrice}}/мес.: 50 учеников, 20 ГБ хранилища).]][[Так как до конца периода осталось {{daysLeft}} дн., вы можете ещё один раз продлить за {{oldPrice}} (помесячно); следующее продление будет на {{newPlan}} ({{newPrice}}/мес.), и мы напомним за 14 дней.]] Автоматического списания нет — продление происходит только когда вы сами оплачиваете.',
    },
  },
});

const LOCALES = ['az', 'en', 'ru'];

function templateLocale(locale) {
  const l = String(locale || '').trim().toLowerCase().slice(0, 2);
  if (LOCALES.includes(l)) return l;
  if (l === 'tr' || l === 'de') return 'en';
  return 'az';
}

function isBlank(v) {
  return v == null || String(v).trim() === '';
}

function interpolate(str, params = {}) {
  const withSections = String(str).replace(/\[\[([\s\S]*?)\]\]/g, (_, section) => {
    const keys = [...section.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]);
    return keys.some((k) => isBlank(params[k])) ? '' : section;
  });
  return withSections.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => {
    const v = params[k];
    return v == null ? '' : String(v);
  });
}

function hasTemplate(key) {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, key);
}

/** @returns {{ title: string, body: string } | null} */
function renderTemplate(key, locale, params = {}) {
  if (!hasTemplate(key)) return null;
  const t = TEMPLATES[key][templateLocale(locale)] || TEMPLATES[key].az;
  return { title: interpolate(t.title, params), body: interpolate(t.body, params) };
}

module.exports = { TEMPLATES, LOCALES, hasTemplate, renderTemplate, templateLocale, interpolate };
