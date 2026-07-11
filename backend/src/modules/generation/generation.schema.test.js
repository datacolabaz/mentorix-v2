const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateGenerateQuestionsInput,
  parseGenerateQuestionsInput,
  validateGeneratedQuestion,
  validateGeneratedQuestionSet,
  parseGeneratedQuestionSet,
} = require('./generation.schema');

const VALID_INPUT = {
  requestId: '550e8400-e29b-41d4-a716-446655440000',
  topic: 'Data Analytics fundamentals',
  level: 'intermediate',
  questionCount: 5,
  format: 'mcq',
  difficulty: 'medium',
};

describe('validateGenerateQuestionsInput', () => {
  it('accepts valid input', () => {
    const result = validateGenerateQuestionsInput(VALID_INPUT);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, {});
  });

  it('rejects missing topic', () => {
    const result = validateGenerateQuestionsInput({ ...VALID_INPUT, topic: '' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.topic);
  });

  it('rejects questionCount of 0', () => {
    const result = validateGenerateQuestionsInput({ ...VALID_INPUT, questionCount: 0 });
    assert.equal(result.valid, false);
    assert.ok(result.errors.questionCount);
  });

  it('rejects questionCount of 31', () => {
    const result = validateGenerateQuestionsInput({ ...VALID_INPUT, questionCount: 31 });
    assert.equal(result.valid, false);
    assert.ok(result.errors.questionCount);
  });

  it('rejects invalid difficulty value', () => {
    const result = validateGenerateQuestionsInput({ ...VALID_INPUT, difficulty: 'extreme' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.difficulty);
  });

  it('rejects missing requestId', () => {
    const result = validateGenerateQuestionsInput({ ...VALID_INPUT, requestId: '' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.requestId);
  });

  it('rejects invalid requestId format', () => {
    const result = validateGenerateQuestionsInput({ ...VALID_INPUT, requestId: 'not-a-uuid' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.requestId);
  });

  it('rejects invalid level enum', () => {
    const result = validateGenerateQuestionsInput({ ...VALID_INPUT, level: 'expert' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.level);
  });

  it('rejects invalid format enum', () => {
    const result = validateGenerateQuestionsInput({ ...VALID_INPUT, format: 'true-false' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.format);
  });

  it('rejects non-integer questionCount', () => {
    const result = validateGenerateQuestionsInput({ ...VALID_INPUT, questionCount: 2.5 });
    assert.equal(result.valid, false);
    assert.ok(result.errors.questionCount);
  });
});

describe('parseGenerateQuestionsInput', () => {
  it('returns coerced GenerationInput on success', () => {
    const parsed = parseGenerateQuestionsInput({
      ...VALID_INPUT,
      topic: '  Trimmed topic  ',
      questionCount: '10',
    });
    assert.equal(parsed.requestId, VALID_INPUT.requestId);
    assert.equal(parsed.topic, 'Trimmed topic');
    assert.equal(parsed.questionCount, 10);
    assert.equal(parsed.level, 'intermediate');
    assert.equal(parsed.format, 'mcq');
    assert.equal(parsed.difficulty, 'medium');
  });

  it('throws VALIDATION_ERROR on invalid input', () => {
    assert.throws(() => parseGenerateQuestionsInput({ ...VALID_INPUT, questionCount: 0 }), (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      assert.ok(err.details?.questionCount);
      return true;
    });
  });
});

const VALID_CLAUDE_QUESTION = {
  text: 'What is the median of a dataset?',
  options: ['Mean value', 'Middle value', 'Largest value', 'Smallest value'],
  correctAnswer: 'Middle value',
  difficulty: 'medium',
};

const VALID_CLAUDE_SET = [
  VALID_CLAUDE_QUESTION,
  {
    text: 'Which SQL clause filters rows before grouping?',
    options: ['WHERE', 'GROUP BY', 'ORDER BY', 'HAVING'],
    correctAnswer: 'WHERE',
    difficulty: 'easy',
  },
];

describe('validateGeneratedQuestionSet', () => {
  it('accepts a valid Claude-shaped question array', () => {
    const result = validateGeneratedQuestionSet(VALID_CLAUDE_SET);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, {});
  });

  it('rejects an empty array', () => {
    const result = validateGeneratedQuestionSet([]);
    assert.equal(result.valid, false);
    assert.ok(result.errors.questions);
  });

  it('rejects a question missing correctAnswer', () => {
    const result = validateGeneratedQuestionSet([
      { ...VALID_CLAUDE_QUESTION, correctAnswer: '' },
    ]);
    assert.equal(result.valid, false);
    assert.ok(result.errors['questions[0].correctAnswer']);
  });

  it('rejects text shorter than minimum length', () => {
    const result = validateGeneratedQuestion(VALID_CLAUDE_QUESTION);
    assert.equal(result.valid, true);

    const short = validateGeneratedQuestion({ ...VALID_CLAUDE_QUESTION, text: 'Hi' });
    assert.equal(short.valid, false);
    assert.ok(short.errors['questions[0].text']);
  });

  it('rejects options array with too few items', () => {
    const result = validateGeneratedQuestion({
      ...VALID_CLAUDE_QUESTION,
      options: ['Only one'],
    });
    assert.equal(result.valid, false);
    assert.ok(result.errors['questions[0].options']);
  });

  it('rejects invalid difficulty enum', () => {
    const result = validateGeneratedQuestionSet([
      { ...VALID_CLAUDE_QUESTION, difficulty: 'extreme' },
    ]);
    assert.equal(result.valid, false);
    assert.ok(result.errors['questions[0].difficulty']);
  });

  it('accepts open-format question without options', () => {
    const result = validateGeneratedQuestion({
      text: 'Explain the difference between mean and median.',
      correctAnswer: 'Mean is the average; median is the middle value.',
      difficulty: 'hard',
    });
    assert.equal(result.valid, true);
  });
});

describe('parseGeneratedQuestionSet', () => {
  it('returns coerced question objects on success', () => {
    const parsed = parseGeneratedQuestionSet([
      {
        ...VALID_CLAUDE_QUESTION,
        text: '  Trimmed question text  ',
        options: [' A ', 'B', 'C', 'D'],
      },
    ]);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].text, 'Trimmed question text');
    assert.deepEqual(parsed[0].options, ['A', 'B', 'C', 'D']);
    assert.equal(parsed[0].correctAnswer, 'Middle value');
    assert.equal(parsed[0].difficulty, 'medium');
  });

  it('throws VALIDATION_ERROR for malformed set', () => {
    assert.throws(() => parseGeneratedQuestionSet([]), (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      assert.ok(err.details?.questions);
      return true;
    });
  });
});
