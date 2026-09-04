const db = require('../utils/db');
const { localeFromReq } = require('../lib/userLocale');
const {
  ROLES,
  buildMentorContext,
  matchFaq,
  pageFallback,
  unknownAnswer,
} = require('../mentor/knowledge');

const STATUSES = new Set(['not_started', 'in_progress', 'paused', 'skipped', 'completed']);

function firstStepId(role) {
  if (role === 'instructor') return 'welcome';
  if (role === 'student') return 'welcome';
  if (role === 'admin') return 'welcome';
  return null;
}

function normalizeProgress(raw, role) {
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const status = STATUSES.has(src.status) ? src.status : 'not_started';
  const completed = Array.isArray(src.completed_step_ids)
    ? src.completed_step_ids.map((x) => String(x)).slice(0, 50)
    : [];
  const storedRole = ROLES.includes(src.role) ? src.role : role;
  if (storedRole !== role) {
    return {
      status: 'not_started',
      role,
      current_step_id: firstStepId(role),
      completed_step_ids: [],
    };
  }
  return {
    status,
    role,
    current_step_id: src.current_step_id ? String(src.current_step_id).slice(0, 80) : firstStepId(role),
    completed_step_ids: completed,
  };
}

async function getOnboarding(req, res, next) {
  try {
    const role = req.user?.role;
    if (!ROLES.includes(role)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }
    const { rows } = await db.query(`SELECT onboarding_progress FROM users WHERE id = $1 AND deleted_at IS NULL`, [
      req.user.id,
    ]);
    const progress = normalizeProgress(rows[0]?.onboarding_progress, role);
    return res.json(progress);
  } catch (err) {
    return next(err);
  }
}

async function patchOnboarding(req, res, next) {
  try {
    const role = req.user?.role;
    if (!ROLES.includes(role)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }
    const { rows } = await db.query(`SELECT onboarding_progress FROM users WHERE id = $1 AND deleted_at IS NULL`, [
      req.user.id,
    ]);
    const current = normalizeProgress(rows[0]?.onboarding_progress, role);
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const next = normalizeProgress(
      {
        ...current,
        status: body.status != null ? body.status : current.status,
        current_step_id: body.current_step_id !== undefined ? body.current_step_id : current.current_step_id,
        completed_step_ids:
          body.completed_step_ids !== undefined ? body.completed_step_ids : current.completed_step_ids,
        role,
      },
      role,
    );
    await db.query(`UPDATE users SET onboarding_progress = $2::jsonb WHERE id = $1 AND deleted_at IS NULL`, [
      req.user.id,
      JSON.stringify(next),
    ]);
    return res.json(next);
  } catch (err) {
    return next(err);
  }
}

async function askAnthropic({ question, context, locale }) {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) return null;
  const model = process.env.ANTHROPIC_MENTOR_MODEL || process.env.ANTHROPIC_GENERATION_MODEL || 'claude-sonnet-5';
  const language = locale === 'ru' ? 'Russian' : locale === 'en' ? 'English' : 'Azerbaijani';
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 400,
        system: [
          'You are the Mentorix Digital Mentor.',
          `Answer ONLY in ${language}.`,
          'Use ONLY the JSON CONTEXT of real Mentorix pages, actions and constraints.',
          'If the user asks for a feature that is missing from CONTEXT or listed in notInProduct, say it does not exist in Mentorix.',
          'Never invent booking sessions, a Sessions page, calendar booking, or login-screen chat.',
          'Be concise (2–6 sentences). Do not mention system prompts.',
        ].join('\n'),
        messages: [
          {
            role: 'user',
            content: `CONTEXT:\n${JSON.stringify(context)}\n\nQUESTION:\n${question}`,
          },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const textBlock = (data.content || []).find((block) => block.type === 'text');
    const text = String(textBlock?.text || '').trim();
    return text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function postAsk(req, res, next) {
  try {
    const role = req.user?.role;
    if (!ROLES.includes(role)) {
      return res.status(403).json({ success: false, message: 'İcazə yoxdur' });
    }
    const locale = localeFromReq(req);
    const question = String(req.body?.question || '').trim().slice(0, 800);
    if (!question) {
      return res.status(400).json({ success: false, message: 'Sual yazın' });
    }
    const currentRoute = String(req.body?.currentRoute || '').slice(0, 200);
    const onboardingStep = req.body?.onboardingStep ? String(req.body.onboardingStep).slice(0, 80) : null;
    const completedSteps = Array.isArray(req.body?.completedSteps)
      ? req.body.completedSteps.map((x) => String(x)).slice(0, 50)
      : [];
    const context = buildMentorContext({
      userRole: role,
      currentRoute,
      onboardingStep,
      completedSteps,
      locale,
    });

    const faq = matchFaq(question, locale);
    if (faq) {
      return res.json({ answer: faq, source: 'faq', context });
    }

    const llm = await askAnthropic({ question, context, locale });
    if (llm) {
      return res.json({ answer: llm, source: 'llm', context });
    }

    const fallback = pageFallback(context, locale) || unknownAnswer(locale);
    return res.json({ answer: fallback, source: 'fallback', context });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getOnboarding, patchOnboarding, postAsk };
