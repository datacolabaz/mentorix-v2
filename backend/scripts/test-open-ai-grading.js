/**
 * Açıq sual AI qiymətləndirmə testi — dəyişən adı mübadiləsi ssenarisi.
 *
 * Usage:
 *   node scripts/test-open-ai-grading.js
 *   node scripts/test-open-ai-grading.js --live   # ANTHROPIC_API_KEY lazımdır
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { gradeOpenAnswerWithAi } = require('../src/services/openAiGradingService');

const SWAP_QUESTION = {
  question_text:
    'İki dəyişənin dəyərini bir-biri ilə necə dəyişirsiniz (swap)? Müvəqqəti (temp) dəyişənindən istifadə edin.',
  model_answer: 'temp = A, A = B, B = temp',
  max_points: 10,
};

/** Eyni məntiq, tam fərqli dəyişən adları — TAM BAL gözlənilir (90-100%) */
const CORRECT_DIFFERENT_NAMES = 'x = a, a = b, b = x';

/** Sıra səhv — B-nin köhnə dəyəri itir — AŞAĞI BAL gözlənilir */
const WRONG_ORDER = 'temp = A, B = temp, A = B';

function passHigh(scorePercent, label) {
  const ok = scorePercent >= 90;
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'} — ${label}: ${scorePercent}% (gözlənilən ≥90%)`);
  return ok;
}

function passLow(scorePercent, label) {
  const ok = scorePercent <= 40;
  console.log(`${ok ? '✅ PASS' : '❌ FAIL'} — ${label}: ${scorePercent}% (gözlənilən ≤40%)`);
  return ok;
}

async function runLive() {
  console.log('\n=== Swap ssenarisi — Live Anthropic test ===\n');
  console.log('Model cavab:', SWAP_QUESTION.model_answer);
  console.log('');

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY yoxdur — Railway-də təyin edib yenidən işlədin.');
    process.exit(1);
  }

  const model = process.env.ANTHROPIC_OPEN_GRADING_MODEL || 'claude-sonnet-4-20250514';
  console.log('Model:', model);
  console.log('');

  console.log('--- Test 1: Düzgün məntiq, fərqli dəyişən adları ---');
  console.log('Tələbə:', CORRECT_DIFFERENT_NAMES);
  const good = await gradeOpenAnswerWithAi({
    questionText: SWAP_QUESTION.question_text,
    modelAnswer: SWAP_QUESTION.model_answer,
    studentAnswer: CORRECT_DIFFERENT_NAMES,
    maxPoints: SWAP_QUESTION.max_points,
  });
  console.log('AI nəticəsi:', JSON.stringify(good, null, 2));
  const t1 = passHigh(good.scorePercent, 'Düzgün/fərqli adlar');
  console.log('');

  console.log('--- Test 2: Səhv ardıcıllıq (məntiq xətası) ---');
  console.log('Tələbə:', WRONG_ORDER);
  const bad = await gradeOpenAnswerWithAi({
    questionText: SWAP_QUESTION.question_text,
    modelAnswer: SWAP_QUESTION.model_answer,
    studentAnswer: WRONG_ORDER,
    maxPoints: SWAP_QUESTION.max_points,
  });
  console.log('AI nəticəsi:', JSON.stringify(bad, null, 2));
  const t2 = passLow(bad.scorePercent, 'Səhv sıra');
  console.log('');

  console.log('=== XÜLASƏ ===');
  if (t1 && t2) {
    console.log('✅ Hər iki test keçdi — AI məntiqə görə qiymətləndirir.');
    process.exit(0);
  }
  console.log('❌ Test uğursuz — promptu yenidən tənzimləyin və ya modeli dəyişin.');
  process.exit(1);
}

(async () => {
  if (process.argv.includes('--live')) {
    await runLive();
  } else {
    console.log('Swap ssenarisi testi (--live olmadan yalnız təlimat):');
    console.log('  node scripts/test-open-ai-grading.js --live');
    console.log('');
    console.log('Test 1:', CORRECT_DIFFERENT_NAMES, '→ gözlənilən ≥90%');
    console.log('Test 2:', WRONG_ORDER, '→ gözlənilən ≤40%');
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
