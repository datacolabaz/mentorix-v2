const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = process.env.ANTHROPIC_OPEN_GRADING_MODEL || 'claude-sonnet-4-20250514';
const REQUEST_TIMEOUT_MS = Number(process.env.ANTHROPIC_OPEN_GRADING_TIMEOUT_MS || 45000);

function buildGradingPrompt({ questionText, modelAnswer, studentAnswer }) {
  return `Sən imtahan qiymətləndirən köməkçisən. Aşağıda sual, müəllimin yazdığı model cavab, və tələbənin yazdığı cavab var.

Tələbənin cavabının model cavabla KONSEPTUAL (məntiqi/alqoritmik) uyğunluğunu qiymətləndir.
- Sözbəsöz eyni olması vacib DEYİL.
- Dəyişən adları (temp/x, A/a, B/b), simvol böyük/kiçik hərfi, yazı üslubu, cümlə quruluşu FƏRQLİ ola bilər — bunlara görə bal AŞAĞI SALMA.
- Yalnız MƏNTİQ fərqlidirsə balı aşağı sal: əməliyyatların ardıcıllığı səhvdirsə, addım atlanıbsa, nəticədə dəyər itirilirsə, və ya alqoritm yanlışdırsa.
- Eyni alqoritmi fərqli dəyişən adları ilə yazmışsa (məs. "temp=A,A=B,B=temp" vs "x=a,a=b,b=x") bu TAM düzgün sayılır.

0-100 arası faiz ver və 1-2 cümləlik qısa əsaslandırma yaz. YALNIZ bu JSON formatında cavab ver: {"score_percent": N, "reasoning": "..."}

Sual: ${String(questionText || '').trim()}
Model cavab: ${String(modelAnswer || '').trim()}
Tələbənin cavabı: ${String(studentAnswer || '').trim()}`;
}

function parseAiGradingJson(content) {
  let raw = String(content || '').trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  const parsed = JSON.parse(raw);
  const scorePercent = Number(parsed?.score_percent);
  const reasoning = String(parsed?.reasoning || '').trim();
  if (!Number.isFinite(scorePercent) || scorePercent < 0 || scorePercent > 100) {
    throw new Error('AI cavabında score_percent 0-100 arası olmalıdır');
  }
  if (!reasoning) throw new Error('AI cavabında reasoning boşdur');
  return { scorePercent, reasoning };
}

function percentToPoints(scorePercent, maxPoints) {
  const max = Number(maxPoints) || 0;
  if (max <= 0) return 0;
  const pct = Math.min(100, Math.max(0, Number(scorePercent) || 0));
  const pts = (pct / 100) * max;
  return Math.round(pts * 100) / 100;
}

async function gradeOpenAnswerWithAi({ questionText, modelAnswer, studentAnswer, maxPoints }) {
  const apiKey = String(process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY təyin edilməyib');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        max_tokens: 512,
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: buildGradingPrompt({ questionText, modelAnswer, studentAnswer }),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`Anthropic API ${res.status}: ${errBody.slice(0, 300)}`);
    }

    const data = await res.json();
    const textBlock = (data.content || []).find((b) => b.type === 'text');
    const parsed = parseAiGradingJson(textBlock?.text || '');
    const suggestedScore = percentToPoints(parsed.scorePercent, maxPoints);

    return {
      scorePercent: parsed.scorePercent,
      reasoning: parsed.reasoning,
      suggestedScore,
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  gradeOpenAnswerWithAi,
  percentToPoints,
  buildGradingPrompt,
};
