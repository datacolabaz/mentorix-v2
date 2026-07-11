const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  validateGenerateQuestionsInput,
  parseGenerateQuestionsInput,
  validateGeneratedQuestion,
  validateGeneratedQuestionSet,
  parseGeneratedQuestionSet,
  validatePersistedQuestion,
  validatePersistedQuestionSet,
  parsePersistedQuestionSet,
  validatePublishDraftInput,
  parsePublishDraftInput,
  parseListDraftsStatusFilter,
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

const PERSISTED_QUESTION_ID = '550e8400-e29b-41d4-a716-446655440000';

const VALID_PERSISTED_SET = [
  {
    id: PERSISTED_QUESTION_ID,
    ...VALID_CLAUDE_QUESTION,
  },
];

describe('validatePersistedQuestionSet', () => {
  it('accepts valid persisted questions with ids', () => {
    const result = validatePersistedQuestionSet(VALID_PERSISTED_SET);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, {});
  });

  it('rejects questions missing id', () => {
    const result = validatePersistedQuestionSet([{ ...VALID_CLAUDE_QUESTION }]);
    assert.equal(result.valid, false);
    assert.ok(result.errors['questions[0].id']);
  });

  it('rejects invalid question id format', () => {
    const result = validatePersistedQuestionSet([
      { ...VALID_PERSISTED_SET[0], id: 'not-a-uuid' },
    ]);
    assert.equal(result.valid, false);
    assert.ok(result.errors['questions[0].id']);
  });

  it('rejects more than 30 questions', () => {
    const oversized = Array.from({ length: 31 }, (_, index) => ({
      id: `550e8400-e29b-41d4-a716-44665544${String(index).padStart(4, '0')}`,
      ...VALID_CLAUDE_QUESTION,
      text: `Question number ${index + 1} for validation`,
    }));
    const result = validatePersistedQuestionSet(oversized);
    assert.equal(result.valid, false);
    assert.ok(result.errors.questions);
  });
});

describe('parsePersistedQuestionSet', () => {
  it('returns coerced persisted questions on success', () => {
    const parsed = parsePersistedQuestionSet(VALID_PERSISTED_SET);
    assert.equal(parsed.length, 1);
    assert.equal(parsed[0].id, PERSISTED_QUESTION_ID);
    assert.equal(parsed[0].text, VALID_CLAUDE_QUESTION.text);
  });

  it('throws VALIDATION_ERROR when questions is not an array', () => {
    assert.throws(() => parsePersistedQuestionSet(null), (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      return true;
    });
  });
});

const VALID_PUBLISH_INPUT = {
  groupId: '660e8400-e29b-41d4-a716-446655440000',
  title: 'Data Analytics Quiz',
  dueDate: '2026-08-15',
};

describe('validatePublishDraftInput', () => {
  it('accepts valid publish input', () => {
    const result = validatePublishDraftInput(VALID_PUBLISH_INPUT);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, {});
  });

  it('rejects missing groupId', () => {
    const result = validatePublishDraftInput({ ...VALID_PUBLISH_INPUT, groupId: '' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.groupId);
  });

  it('rejects invalid dueDate format', () => {
    const result = validatePublishDraftInput({ ...VALID_PUBLISH_INPUT, dueDate: '15-08-2026' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.dueDate);
  });

  it('rejects empty title', () => {
    const result = validatePublishDraftInput({ ...VALID_PUBLISH_INPUT, title: '   ' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.title);
  });
});

describe('parsePublishDraftInput', () => {
  it('returns coerced publish input on success', () => {
    const parsed = parsePublishDraftInput({
      ...VALID_PUBLISH_INPUT,
      title: '  Trimmed title  ',
    });
    assert.equal(parsed.groupId, VALID_PUBLISH_INPUT.groupId);
    assert.equal(parsed.title, 'Trimmed title');
    assert.equal(parsed.dueDate, '2026-08-15');
  });
});

describe('parseListDraftsStatusFilter', () => {
  it('returns null when status is omitted', () => {
    assert.equal(parseListDraftsStatusFilter({}), null);
    assert.equal(parseListDraftsStatusFilter({ status: '' }), null);
  });

  it('returns valid draft status values', () => {
    assert.equal(parseListDraftsStatusFilter({ status: 'draft' }), 'draft');
    assert.equal(parseListDraftsStatusFilter({ status: ' published ' }), 'published');
  });

  it('throws VALIDATION_ERROR for invalid status', () => {
    assert.throws(() => parseListDraftsStatusFilter({ status: 'archived' }), (err) => {
      assert.equal(err.code, 'VALIDATION_ERROR');
      return true;
    });
  });
});
