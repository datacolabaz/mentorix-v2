/**
 * Açıq sual AI qiymətləndirmə testi (mock və ya real API).
 * Usage:
 *   node scripts/test-open-ai-grading.js
 *   node scripts/test-open-ai-grading.js --live   # ANTHROPIC_API_KEY lazımdır
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { percentToPoints, buildGradingPrompt, gradeOpenAnswerWithAi } = require('../src/services/openAiGradingService');

const TEMP_QUESTION = {
  question_text:
    'İki dəyişənin dəyərini bir-biri ilə necə dəyişirsiniz (swap)? temp dəyişəni olmadan hansı problem yaranır?',
  model_answer:
    'Əvvəlcə temp adlı boş qutuya A-nın dəyərini qoyuruq, sonra A-ya B-nin dəyərini veririk, B-yə isə temp-də olanı.',
  max_points: 10,
};

const GOOD_ANSWER =
  'A-nın dəyərini müvəqqəti yadda saxlayırıq, sonra B-ni A-ya yazırıq, sonra müvəqqəti yaddaşdakı dəyəri B-yə qoyuruq. Temp olmadan bir dəyər itir.';
const BAD_ANSWER = 'Sadəcə A = B yazırıq və bitiririk.';

async function runMock() {
  console.log('\n=== Mock test (prompt + percentToPoints) ===\n');
  console.log(buildGradingPrompt({
    questionText: TEMP_QUESTION.question_text,
    modelAnswer: TEMP_QUESTION.model_answer,
    studentAnswer: GOOD_ANSWER,
  }).slice(0, 400) + '...\n');

  const goodPts = percentToPoints(92, TEMP_QUESTION.max_points);
  const badPts = percentToPoints(15, TEMP_QUESTION.max_points);
  console.log('Gözlənilən (mock): düzgün məntiq → ~9.2/10, səhv → ~1.5/10');
  console.log(`percentToPoints(92, 10) = ${goodPts}`);
  console.log(`percentToPoints(15, 10) = ${badPts}`);
}

async function runLive() {
  console.log('\n=== Live Anthropic test ===\n');
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY yoxdur — yalnız mock test edildi.');
    return;
  }

  const good = await gradeOpenAnswerWithAi({
    questionText: TEMP_QUESTION.question_text,
    modelAnswer: TEMP_QUESTION.model_answer,
    studentAnswer: GOOD_ANSWER,
    maxPoints: TEMP_QUESTION.max_points,
  });
  console.log('Düzgün məntiqli cavab:', good);

  const bad = await gradeOpenAnswerWithAi({
    questionText: TEMP_QUESTION.question_text,
    modelAnswer: TEMP_QUESTION.model_answer,
    studentAnswer: BAD_ANSWER,
    maxPoints: TEMP_QUESTION.max_points,
  });
  console.log('Səhv cavab:', bad);
}

(async () => {
  await runMock();
  if (process.argv.includes('--live')) {
    await runLive();
  } else {
    console.log('\nReal API test üçün: node scripts/test-open-ai-grading.js --live\n');
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
