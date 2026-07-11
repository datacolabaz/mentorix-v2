const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateGenerateQuestionsInput,
  parseGenerateQuestionsInput,
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
