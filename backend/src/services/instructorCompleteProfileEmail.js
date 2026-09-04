const { Resend } = require('resend');
const { sendEmail } = require('./emailService');

function frontendBaseUrl() {
  const base = String(
    process.env.FRONTEND_BASE_URL || process.env.FRONTEND_URL || 'https://mentorix.az',
  )
    .trim()
    .replace(/\/+$/, '');
  return base || 'https://mentorix.az';
}

const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim();
const EMAIL_FROM = String(
  process.env.INSTRUCTOR_COMPLETE_PROFILE_FROM || 'Mentorix <info@mentorix.az>',
).trim();

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function settingsUrl() {
  return `${frontendBaseUrl()}/instructor/settings#discover-profile`;
}

function greetingName(fullName) {
  const n = String(fullName || '').trim();
  return n || null;
}

const COPY = {
  az: {
    subject: 'Mentorix — qeydiyyatınızı tamamlayın',
    greeting: (name) => (name ? `Hörmətli ${name},` : 'Hörmətli müəllim,'),
    intro:
      'Mentorix-ə xoş gəlmisiniz. Hesabınız açılıb, lakin qeydiyyatınız hələ tam deyil. Ona görə də sizi «Müəllim tap» axtarışında ön sırada göstərə və platformanın imkanlarından tam yararlanmağınıza kömək edə bilmirik.',
    why: 'Qeydiyyatı tamamladıqdan sonra valideynlər sizi fənn, şəhər və dərs formatı üzrə tapa bilər, siz isə qrup, imtahan və tələbə əlavə edə bilərsiniz.',
    stepsTitle: 'Nə etməlisiniz:',
    steps: [
      'Tənzimləmələrdə tədris etdiyiniz fənni seçin (məsələn, fizika, riyaziyyat, biologiya).',
      'Şəhər/rayonunuzu və xəritə pinini qoyun — valideynlər sizi xəritədə görsün.',
      'Dərs formatını seçin: online, tələbənin evində və ya sizin ünvanınızda.',
      'İstəyə bağlı: telefon nömrəsini təsdiqləyin. Qrup, imtahan və tələbə əlavə etmək üçün lazımdır; SMS yalnız siz təsdiq istəyəndə göndərilir.',
    ],
    cta: 'Qeydiyyatı tamamla',
    outro: 'Bir neçə dəqiqə çəkir. Tamamlayan kimi axtarışda görünməyə başlayırsınız.',
    sign: 'Hörmətlə,\nMentorix komandası',
  },
  ru: {
    subject: 'Mentorix — завершите регистрацию',
    greeting: (name) => (name ? `Уважаемый(ая) ${name},` : 'Уважаемый преподаватель,'),
    intro:
      'Добро пожаловать в Mentorix. Аккаунт уже создан, но регистрация ещё не завершена. Поэтому мы не можем показать вас в начале поиска «Найти преподавателя» и открыть все возможности платформы.',
    why: 'После заполнения профиля родители смогут найти вас по предмету, городу и формату занятий, а вы — создавать группы, экзамены и добавлять учеников.',
    stepsTitle: 'Что нужно сделать:',
    steps: [
      'В настройках выберите предметы, которые преподаёте (например, физика, математика, биология).',
      'Укажите город/район и поставьте метку на карте — чтобы родители видели вас на карте.',
      'Выберите формат занятий: онлайн, у ученика или по вашему адресу.',
      'По желанию: подтвердите номер телефона. Он нужен, чтобы создавать группы, экзамены и добавлять учеников. SMS отправляется только когда вы сами запрашиваете подтверждение.',
    ],
    cta: 'Завершить регистрацию',
    outro: 'Это займёт несколько минут. После заполнения вы начнёте отображаться в поиске.',
    sign: 'С уважением,\nкоманда Mentorix',
  },
  en: {
    subject: 'Mentorix — complete your registration',
    greeting: (name) => (name ? `Dear ${name},` : 'Dear teacher,'),
    intro:
      'Welcome to Mentorix. Your account is created, but your registration is still incomplete. Until you finish it, we cannot feature you in “Find a teacher” search or unlock the full platform.',
    why: 'Once your profile is complete, parents can find you by subject, city and lesson format, and you can create groups, exams and add students.',
    stepsTitle: 'What to do:',
    steps: [
      'In Settings, add the subjects you teach (for example physics, maths, biology).',
      'Set your city/district and drop a map pin so parents can see you on the map.',
      'Choose your lesson format: online, at the student’s home, or at your address.',
      'Optional: verify your phone number. You need it to create groups, exams and add students. An SMS is sent only when you request verification.',
    ],
    cta: 'Complete registration',
    outro: 'It takes a few minutes. As soon as you finish, you start appearing in search.',
    sign: 'Kind regards,\nThe Mentorix team',
  },
};

function copyFor(locale) {
  if (locale === 'ru') return COPY.ru;
  if (locale === 'en') return COPY.en;
  return COPY.az;
}

function buildCompleteProfileEmail({ locale = 'az', fullName }) {
  const lang = locale === 'ru' ? 'ru' : locale === 'en' ? 'en' : 'az';
  const c = copyFor(lang);
  const link = settingsUrl();
  const greet = c.greeting(greetingName(fullName));
  const stepsText = c.steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const text = [greet, '', c.intro, '', c.why, '', c.stepsTitle, stepsText, '', `${c.cta}: ${link}`, '', c.outro, '', c.sign].join(
    '\n',
  );
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; line-height: 1.55; max-width: 560px; color: #111827;">
      <p style="margin: 0 0 16px;">${escapeHtml(greet)}</p>
      <p style="margin: 0 0 12px;">${escapeHtml(c.intro)}</p>
      <p style="margin: 0 0 16px;">${escapeHtml(c.why)}</p>
      <p style="margin: 0 0 8px; font-weight: 600;">${escapeHtml(c.stepsTitle)}</p>
      <ol style="margin: 0 0 20px; padding-left: 20px;">
        ${c.steps.map((s) => `<li style="margin: 0 0 8px;">${escapeHtml(s)}</li>`).join('')}
      </ol>
      <p style="margin: 0 0 20px;">
        <a href="${link}" style="display: inline-block; background: #00E676; color: #041018; padding: 12px 20px; border-radius: 10px; text-decoration: none; font-weight: 700;">${escapeHtml(c.cta)} →</a>
      </p>
      <p style="margin: 0 0 16px; color: #374151;">${escapeHtml(c.outro)}</p>
      <p style="margin: 0; white-space: pre-line; color: #6b7280; font-size: 13px;">${escapeHtml(c.sign)}</p>
    </div>
  `;
  return { subject: c.subject, text, html, lang, link };
}

function resendReady() {
  return Boolean(RESEND_API_KEY && EMAIL_FROM);
}

async function sendCompleteProfileEmail({ to, locale, fullName }) {
  const payload = buildCompleteProfileEmail({ locale, fullName });
  if (resendReady()) {
    const client = new Resend(RESEND_API_KEY);
    const { data, error } = await client.emails.send({
      from: EMAIL_FROM,
      to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
    if (error) return { ok: false, error: error?.message || 'Resend xətası', ...payload };
    return { ok: true, provider: 'resend', messageId: data?.id || null, ...payload };
  }
  const r = await sendEmail({
    to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
  if (r?.skipped) return { ok: false, skipped: true, reason: 'email_not_configured', ...payload };
  return { ok: true, provider: 'smtp', messageId: r?.messageId || null, ...payload };
}

module.exports = {
  COPY,
  buildCompleteProfileEmail,
  sendCompleteProfileEmail,
  settingsUrl,
};
