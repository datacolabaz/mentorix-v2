const OPENAI_MODEL = process.env.OPENAI_UNIVERSITY_SCRAPER_MODEL || process.env.OPENAI_ASSIGNMENT_MODEL || 'gpt-4o-mini';
const MAX_PAGE_CHARS = 18000;

function stripHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseAiJson(content) {
  let raw = String(content || '').trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  return JSON.parse(raw);
}

async function callOpenAiProgramExtract({ pageText, target }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY konfiqurasiya olunmayıb');
    err.status = 503;
    throw err;
  }

  const system = `Siz universitet qəbul səhifələrindən strukturlaşdırılmış proqram məlumatı çıxaran köməkçisiniz.
Cavabı YALNIZ JSON obyekti kimi verin (markdown yox).

JSON sxemi:
{
  "university_name": "string",
  "country": "string",
  "city": "string|null",
  "programs": [
    {
      "name": "string",
      "degree_level": "BSc|MSc|PhD",
      "field": "computer_science|data_science|business_administration|...",
      "language": "English|German|...",
      "tuition_fee_eur": number|null,
      "scholarship_available": boolean,
      "duration_years": number|null,
      "deadline_dates": ["YYYY-MM-DD"],
      "requirements": {
        "min_gpa": number|null,
        "min_language": { "ielts": number|null, "toefl": number|null },
        "documents": ["string"]
      },
      "apply_link": "string|null"
    }
  ]
}

Əgər məlumat tapılmırsa, programs boş massiv qaytarın. Tarixləri ISO formatında yazın.`;

  const user = `Universitet: ${target?.university_name || '—'}
Ölkə: ${target?.country || '—'}
URL: ${target?.admission_url || '—'}

Səhifə mətni:
${pageText}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0.1,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`OpenAI xətası: ${res.status} ${body.slice(0, 200)}`);
    err.status = 502;
    throw err;
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  const parsed = parseAiJson(content);
  return { parsed, model: OPENAI_MODEL };
}

async function fetchPageText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MentorixApplyBot/1.0 (+https://mentorix.io)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!res.ok) {
      const err = new Error(`Səhifə yüklənmədi: HTTP ${res.status}`);
      err.status = 502;
      throw err;
    }
    const html = await res.text();
    let text = stripHtml(html);
    if (text.length > MAX_PAGE_CHARS) text = `${text.slice(0, MAX_PAGE_CHARS)}\n\n[... qısaldıldı]`;
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  OPENAI_MODEL,
  stripHtml,
  fetchPageText,
  callOpenAiProgramExtract,
};
