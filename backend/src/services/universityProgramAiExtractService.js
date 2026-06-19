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

async function callOpenAiCatalogExtract({ pageText, target }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY konfiqurasiya olunmayıb');
    err.status = 503;
    throw err;
  }

  const fieldSlug = target?.field_slug || target?.field_hint || 'general';
  const degreeType = target?.degree_type || target?.degree_hint || 'MSc';

  const system = `Siz Studyportals / Mastersportal kataloq axtarış nəticələrindən proqram kartlarını çıxaran köməkçisiniz.
Cavabı YALNIZ JSON obyekti kimi verin.

JSON sxemi:
{
  "programs": [
    {
      "university_name": "string",
      "country": "string",
      "city": "string|null",
      "program_name": "string",
      "degree_level": "BSc|MSc|PhD",
      "field_raw": "string",
      "tuition_fee": number|null,
      "currency": "EUR|USD|GBP|null",
      "language": "string",
      "ielts": number|null,
      "deadline": "YYYY-MM-DD|null",
      "apply_url": "string|null",
      "qs_ranking": number|null,
      "scholarship_available": boolean,
      "duration_years": number|null
    }
  ]
}

Bütün tapılan proqram kartlarını çıxarın. Təkrarları atlayın. field_raw portalda göstərilən sahə adıdır.`;

  const user = `Gözlənilən sahə slug: ${fieldSlug}
Gözlənilən dərəcə: ${degreeType}
Kataloq URL: ${target?.admission_url || '—'}

Axtarış səhifə mətni:
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

async function fetchPageHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MentorixApplyBot/1.0 (+https://mentorix.io)',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    const html = await res.text();
    if (!res.ok) {
      const err = new Error(`Səhifə yüklənmədi: HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return { status: res.status, html };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchPageText(url) {
  const { html } = await fetchPageHtml(url);
  let text = stripHtml(html);
  if (text.length > MAX_PAGE_CHARS) text = `${text.slice(0, MAX_PAGE_CHARS)}\n\n[... qısaldıldı]`;
  return text;
}

module.exports = {
  OPENAI_MODEL,
  stripHtml,
  fetchPageHtml,
  fetchPageText,
  callOpenAiProgramExtract,
  callOpenAiCatalogExtract,
};
