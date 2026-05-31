const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/assignments');
const MAX_EXTRACT_CHARS = 14000;
const OPENAI_MODEL = process.env.OPENAI_ASSIGNMENT_MODEL || 'gpt-4o-mini';

function stripHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uploadPathFromApiUrl(url) {
  const s = String(url || '').trim();
  const prefix = '/api/uploads/assignments/';
  if (!s.startsWith(prefix)) return null;
  const filename = path.basename(s);
  if (!filename || filename === '.' || filename.includes('..')) return null;
  return path.join(UPLOADS_DIR, filename);
}

async function extractPdfText(filePath) {
  const pdfParse = require('pdf-parse');
  const buf = await fs.promises.readFile(filePath);
  const data = await pdfParse(buf);
  return String(data.text || '').trim();
}

async function extractDocxText(filePath) {
  const mammoth = require('mammoth');
  const result = await mammoth.extractRawText({ path: filePath });
  return String(result.value || '').trim();
}

async function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.pdf') return extractPdfText(filePath);
  if (ext === '.docx') return extractDocxText(filePath);
  if (ext === '.doc') {
    try {
      return await extractDocxText(filePath);
    } catch {
      return '';
    }
  }
  if (['.txt', '.csv'].includes(ext)) {
    return (await fs.promises.readFile(filePath, 'utf8')).trim();
  }
  return '';
}

async function collectSubmissionText({ answer_text, attachment_urls }) {
  const parts = [];
  const answer = stripHtml(answer_text);
  if (answer) parts.push(`[Mətn cavabı]\n${answer}`);

  const urls = Array.isArray(attachment_urls) ? attachment_urls : [];
  for (const url of urls) {
    const fp = uploadPathFromApiUrl(url);
    if (!fp || !fs.existsSync(fp)) continue;
    const ext = path.extname(fp).toLowerCase();
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
      parts.push(`[Şəkil faylı: ${path.basename(fp)} — mətn çıxarılmadı, müəllim fayla baxsın]`);
      continue;
    }
    try {
      const text = await extractTextFromFile(fp);
      if (text) parts.push(`[Fayl: ${path.basename(fp)}]\n${text}`);
    } catch {
      parts.push(`[Fayl: ${path.basename(fp)} — oxunmadı]`);
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

async function callOpenAiReview({ assignment, submissionText }) {
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
    const msg = data?.error?.message || `OpenAI xətası (${res.status})`;
    throw new Error(msg);
  }
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('AI cavabı boşdur');
  return parseAiJson(content);
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

  const parsed = await callOpenAiReview({ assignment: row, submissionText });
  const maxScore = row.max_score != null ? Number(row.max_score) : 100;
  let suggested = parsed.suggested_score;
  if (suggested != null) {
    if (suggested < 0) suggested = 0;
    if (suggested > maxScore) suggested = maxScore;
  }

  const draft_feedback = buildDraftFeedback(parsed);

  return {
    status: 'ready',
    model: OPENAI_MODEL,
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
};
