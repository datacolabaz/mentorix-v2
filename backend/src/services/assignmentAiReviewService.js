const path = require('path');
const { readAssignmentFileBuffer } = require('./assignmentFileStorage');
const {
  hasAnthropicKey,
  resolveAnthropicApiKey,
  resolveGradingModel,
  gradingTimeoutMs,
} = require('../config/aiModels');

const MAX_EXTRACT_CHARS = 14000;
const OPENAI_MODEL = process.env.OPENAI_ASSIGNMENT_MODEL || 'gpt-4o-mini';
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function filenameFromApiUrl(url) {
  const s = String(url || '').trim();
  const prefix = '/api/uploads/assignments/';
  if (!s.startsWith(prefix)) return null;
  const filename = path.basename(s);
  if (!filename || filename === '.' || filename.includes('..')) return null;
  return filename;
}

async function extractTextFromBuffer(buf, ext) {
  const e = String(ext || '').toLowerCase();
  if (e === '.pdf') {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buf);
    return String(data.text || '').trim();
  }
  if (e === '.docx' || e === '.doc') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer: buf });
    return String(result.value || '').trim();
  }
  if (['.txt', '.csv'].includes(e)) {
    return buf.toString('utf8').trim();
  }
  return '';
}

async function collectSubmissionText({ answer_text, attachment_urls }) {
  const parts = [];
  const answer = stripHtml(answer_text);
  if (answer) parts.push(`[Mətn cavabı]\n${answer}`);

  const urls = Array.isArray(attachment_urls) ? attachment_urls : [];
  for (const url of urls) {
    const fn = filenameFromApiUrl(url);
    if (!fn) continue;
    const ext = path.extname(fn).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
      parts.push(`[Şəkil faylı: ${fn} — mətn çıxarılmadı, müəllim fayla baxsın]`);
      continue;
    }
    try {
      const hit = await readAssignmentFileBuffer(fn);
      if (!hit) {
        parts.push(`[Fayl: ${fn} — tapılmadı]`);
        continue;
      }
      const buf = Buffer.isBuffer(hit) ? hit : hit.buffer;
      const text = await extractTextFromBuffer(buf, ext);
      if (text) parts.push(`[Fayl: ${fn}]\n${text}`);
    } catch {
      parts.push(`[Fayl: ${fn} — oxunmadı]`);
    }
  }

  let combined = parts.join('\n\n').trim();
  if (combined.length > MAX_EXTRACT_CHARS) {
    combined = `${combined.slice(0, MAX_EXTRACT_CHARS)}\n\n[... mətn qısaldıldı]`;
  }
  return combined;
}

function buildDraftFeedback({ strengths, weaknesses, recommendations, summary }) {
  const lines = [];
  if (summary) lines.push(summary, '');
  if (strengths?.length) {
    lines.push('Güclü tərəflər:');
    strengths.forEach((s) => lines.push(`- ${s}`));
    lines.push('');
  }
  if (weaknesses?.length) {
    lines.push('Zəif tərəflər:');
    weaknesses.forEach((s) => lines.push(`- ${s}`));
    lines.push('');
  }
  if (recommendations) {
    lines.push('Tövsiyə:');
    lines.push(recommendations);
  }
  return lines.join('\n').trim();
}

function parseAiJson(content) {
  let raw = String(content || '').trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  const parsed = JSON.parse(raw);
  const suggested_score =
    parsed.suggested_score != null && parsed.suggested_score !== ''
      ? Math.round(Number(parsed.suggested_score) * 100) / 100
      : null;
  return {
    suggested_score: Number.isFinite(suggested_score) ? suggested_score : null,
    strengths: Array.isArray(parsed.strengths)
      ? parsed.strengths.map((s) => String(s).trim()).filter(Boolean).slice(0, 8)
      : [],
    weaknesses: Array.isArray(parsed.weaknesses)
      ? parsed.weaknesses.map((s) => String(s).trim()).filter(Boolean).slice(0, 8)
      : [],
    recommendations: parsed.recommendations != null ? String(parsed.recommendations).trim() : '',
    summary: parsed.summary != null ? String(parsed.summary).trim() : '',
  };
}

function buildReviewPrompts(assignment, submissionText) {
  const maxScore = assignment.max_score != null ? Number(assignment.max_score) : 100;
  const system = `Siz Azərbaycan dilində işləyən təhsil köməkçisisiniz. Müəllim üçün ev tapşırığını qiymətləndirmə təklifi hazırlayırsınız. Cavabı YALNIZ JSON obyekti kimi verin (markdown yox).`;
  const user = `Tapşırıq başlığı: ${assignment.title}
Mövzu: ${assignment.topic || '—'}
Təsvir: ${assignment.description || '—'}
Maksimum bal: ${maxScore}

Tələbə təslimi:
${submissionText || '(mətn və oxuna bilən fayl tapılmadı — ümumi qısa rəy verin, balı ehtiyatla təklif edin)'}

JSON formatı:
{
  "suggested_score": number (0 ilə ${maxScore} arası),
  "summary": "1-2 cümlə ümumi qiymət",
  "strengths": ["..."],
  "weaknesses": ["..."],
  "recommendations": "müəllim/tələbə üçün konkret tövsiyə mətni"
}`;
  return { system, user, maxScore };
}

async function callAnthropicReview({ assignment, submissionText }) {
  const apiKey = resolveAnthropicApiKey();
  if (!apiKey) {
    const err = new Error('ANTHROPIC_API_KEY təyin edilməyib');
    err.name = 'OpenAiReviewError';
    err.status = 503;
    throw err;
  }

  const model = resolveGradingModel();
  const { system, user } = buildReviewPrompts(assignment, submissionText);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), gradingTimeoutMs());

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: user }],
      }),
      signal: controller.signal,
    });

    const errBody = !res.ok ? await res.text().catch(() => '') : '';
    if (!res.ok) {
      const err = new Error(`Anthropic API ${res.status}: ${errBody.slice(0, 300)}`);
      err.name = 'OpenAiReviewError';
      err.status = res.status;
      err.rawProvider = { status: res.status, message: err.message };
      throw err;
    }

    const data = await res.json();
    const textBlock = (data.content || []).find((b) => b.type === 'text');
    if (!textBlock?.text) throw new Error('AI cavabı boşdur');
    const parsed = parseAiJson(textBlock.text);
    const promptTokens = Number(data?.usage?.input_tokens) || 0;
    const completionTokens = Number(data?.usage?.output_tokens) || 0;
    return {
      parsed,
      model: String(data?.model || model),
      tokenUsage: {
        prompt: promptTokens,
        completion: completionTokens,
        total: promptTokens + completionTokens,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAiReview({ assignment, submissionText }) {
  const { system, user } = buildReviewPrompts(assignment, submissionText);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const provider = data?.error || {};
    const msg = provider.message || `OpenAI xətası (${res.status})`;
    const err = new Error(msg);
    err.name = 'OpenAiReviewError';
    err.status = res.status;
    err.code = provider.code;
    err.type = provider.type;
    err.rawProvider = {
      status: res.status,
      code: provider.code || null,
      type: provider.type || null,
      message: provider.message || msg,
    };
    throw err;
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI cavabı boşdur');
  return {
    parsed: parseAiJson(content),
    model: OPENAI_MODEL,
    tokenUsage: {
      prompt: Number(data?.usage?.prompt_tokens) || 0,
      completion: Number(data?.usage?.completion_tokens) || 0,
      total: Number(data?.usage?.total_tokens) || 0,
    },
  };
}

async function runAssignmentAiReview(row) {
  const startedAt = new Date().toISOString();
  const submissionText = await collectSubmissionText({
    answer_text: row.answer_text,
    attachment_urls: row.attachment_urls,
  });

  if (!submissionText) {
    throw new Error('Təhlil üçün mətn və ya PDF/DOCX faylı tapılmadı');
  }

  // Prefer Anthropic when configured so instructors do not hit OpenAI for the same flow.
  const result = hasAnthropicKey()
    ? await callAnthropicReview({ assignment: row, submissionText })
    : await callOpenAiReview({ assignment: row, submissionText });

  const parsed = result.parsed;
  const maxScore = row.max_score != null ? Number(row.max_score) : 100;
  let suggested = parsed.suggested_score;
  if (suggested != null) {
    if (suggested < 0) suggested = 0;
    if (suggested > maxScore) suggested = maxScore;
  }

  const draft_feedback = buildDraftFeedback(parsed);

  return {
    status: 'ready',
    model: result.model,
    tokenUsage: result.tokenUsage,
    requested_at: startedAt,
    completed_at: new Date().toISOString(),
    max_score: maxScore,
    suggested_score: suggested,
    summary: parsed.summary,
    strengths: parsed.strengths,
    weaknesses: parsed.weaknesses,
    recommendations: parsed.recommendations,
    draft_feedback,
    excerpt_chars: submissionText.length,
  };
}

module.exports = {
  runAssignmentAiReview,
  collectSubmissionText,
  buildDraftFeedback,
  hasAnthropicKey,
};
