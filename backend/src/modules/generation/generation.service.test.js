const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { AIGenerationError } = require('../../providers/errors');
const {
  generateQuestions,
  regenerateQuestionItem,
  GenerationServiceError,
  GenerationForbiddenError,
  GenerationNotFoundError,
  assignQuestionIds,
  mergeRegeneratedQuestion,
} = require('./generation.service');

const TEACHER_ID = '11111111-1111-4111-8111-111111111111';
const REQUEST_ID = '22222222-2222-4222-8222-222222222222';
const DRAFT_ID = '33333333-3333-4333-8333-333333333333';
const QUESTION_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_TEACHER_ID = '99999999-9999-4999-8999-999999999999';

const INPUT = {
  requestId: '550e8400-e29b-41d4-a716-446655440000',
  topic: 'Data Analytics fundamentals',
  level: 'intermediate',
  questionCount: 1,
  format: 'mcq',
  difficulty: 'medium',
};

const PROVIDER_QUESTIONS = [
  {
    text: 'What is the median of a dataset?',
    options: ['Mean', 'Middle', 'Max', 'Min'],
    correctAnswer: 'Middle',
    difficulty: 'medium',
  },
];

function createRepositoryMock() {
  return {
    calls: {
      createGenerationRequest: [],
      updateGenerationRequestStatus: [],
      createDraft: [],
    },
    async createGenerationRequest(data) {
      this.calls.createGenerationRequest.push(data);
      return { id: REQUEST_ID, teacher_id: data.teacherId, status: 'pending' };
    },
    async updateGenerationRequestStatus(id, status, extra = {}) {
      this.calls.updateGenerationRequestStatus.push({ id, status, extra });
      return { id, status, ...extra };
    },
    async createDraft(data) {
      this.calls.createDraft.push(data);
      return {
        id: DRAFT_ID,
        request_id: data.requestId,
        teacher_id: data.teacherId,
        questions: data.questions,
        status: data.status,
      };
    },
  };
}

describe('assignQuestionIds', () => {
  it('adds stable UUID ids to generated questions', () => {
    const result = assignQuestionIds(PROVIDER_QUESTIONS);
    assert.equal(result.length, 1);
    assert.match(result[0].id, /^[0-9a-f-]{36}$/i);
    assert.equal(result[0].text, PROVIDER_QUESTIONS[0].text);
  });
});

describe('generateQuestions', () => {
  it('creates request, calls provider, persists draft on success', async () => {
    const repo = createRepositoryMock();
    const aiProvider = {
      lastCallMeta: {
        model: 'claude-sonnet-5',
        tokenUsage: { prompt: 100, completion: 50, total: 150 },
        latencyMs: 900,
      },
      async generateQuestions() {
        return PROVIDER_QUESTIONS;
      },
    };

    const draft = await generateQuestions(TEACHER_ID, INPUT, {
      repository: repo,
      aiProvider,
    });

    assert.equal(repo.calls.createGenerationRequest.length, 1);
    assert.equal(repo.calls.createGenerationRequest[0].teacherId, TEACHER_ID);
    assert.equal(repo.calls.createGenerationRequest[0].status, 'pending');

    assert.equal(repo.calls.updateGenerationRequestStatus.length, 1);
    assert.equal(repo.calls.updateGenerationRequestStatus[0].id, REQUEST_ID);
    assert.equal(repo.calls.updateGenerationRequestStatus[0].status, 'success');
    assert.equal(repo.calls.updateGenerationRequestStatus[0].extra.modelUsed, 'claude-sonnet-5');
    assert.equal(repo.calls.updateGenerationRequestStatus[0].extra.tokenUsage.total, 150);

    assert.equal(repo.calls.createDraft.length, 1);
    assert.equal(repo.calls.createDraft[0].requestId, REQUEST_ID);
    assert.equal(repo.calls.createDraft[0].teacherId, TEACHER_ID);
    assert.equal(repo.calls.createDraft[0].questions.length, 1);
    assert.match(repo.calls.createDraft[0].questions[0].id, /^[0-9a-f-]{36}$/i);

    assert.equal(draft.id, DRAFT_ID);
    assert.equal(draft.status, 'draft');
  });

  it('marks request failed and rethrows AIGenerationError on provider failure', async () => {
    const repo = createRepositoryMock();
    const providerError = new AIGenerationError('AI generated invalid question output after one retry');
    const aiProvider = {
      lastCallMeta: {
        model: 'claude-sonnet-5',
        tokenUsage: { prompt: 80, completion: 20, total: 100 },
        latencyMs: 500,
      },
      async generateQuestions() {
        throw providerError;
      },
    };

    await assert.rejects(
      () => generateQuestions(TEACHER_ID, INPUT, { repository: repo, aiProvider }),
      (err) => {
        assert.equal(err, providerError);
        return true;
      },
    );

    assert.equal(repo.calls.createGenerationRequest.length, 1);
    assert.equal(repo.calls.updateGenerationRequestStatus.length, 1);
    assert.equal(repo.calls.updateGenerationRequestStatus[0].status, 'failed');
    assert.match(
      repo.calls.updateGenerationRequestStatus[0].extra.errorMessage,
      /invalid question output/i,
    );
    assert.equal(repo.calls.updateGenerationRequestStatus[0].extra.modelUsed, 'claude-sonnet-5');
    assert.equal(repo.calls.createDraft.length, 0);
  });

  it('wraps non-AI failures in GenerationServiceError', async () => {
    const repo = createRepositoryMock();
    const aiProvider = {
      lastCallMeta: null,
      async generateQuestions() {
        throw new Error('Anthropic API 500: server error');
      },
    };

    await assert.rejects(
      () => generateQuestions(TEACHER_ID, INPUT, { repository: repo, aiProvider }),
      (err) => {
        assert.ok(err instanceof GenerationServiceError);
        assert.equal(err.code, 'GENERATION_FAILED');
        return true;
      },
    );

    assert.equal(repo.calls.updateGenerationRequestStatus[0].status, 'failed');
  });
});

function createRegenerateRepositoryMock() {
  const existingQuestion = {
    id: QUESTION_ID,
    text: 'Old question text here?',
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: 'B',
    difficulty: 'medium',
  };

  return {
    calls: {
      getDraftById: [],
      getGenerationRequestById: [],
      updateDraft: [],
    },
    async getDraftById(id) {
      this.calls.getDraftById.push(id);
      return {
        id: DRAFT_ID,
        request_id: REQUEST_ID,
        teacher_id: TEACHER_ID,
        status: 'draft',
        questions: [existingQuestion],
      };
    },
    async getGenerationRequestById(id) {
      this.calls.getGenerationRequestById.push(id);
      return {
        id,
        request_payload: INPUT,
      };
    },
    async updateDraft(id, updates) {
      this.calls.updateDraft.push({ id, updates });
      return {
        id,
        questions: updates.questions,
        updated_at: new Date().toISOString(),
      };
    },
  };
}

describe('regenerateQuestionItem', () => {
  it('replaces one question and preserves its id', async () => {
    const repo = createRegenerateRepositoryMock();
    const aiProvider = {
      lastCallMeta: { model: 'claude-sonnet-5', tokenUsage: { total: 100 }, latencyMs: 200 },
      async regenerateQuestion() {
        return [{
          text: 'New regenerated question text?',
          options: ['One', 'Two', 'Three', 'Four'],
          correctAnswer: 'Two',
          difficulty: 'medium',
        }];
      },
    };

    const question = await regenerateQuestionItem(
      TEACHER_ID,
      DRAFT_ID,
      QUESTION_ID,
      'Make it harder',
      { repository: repo, aiProvider },
    );

    assert.equal(question.id, QUESTION_ID);
    assert.equal(question.text, 'New regenerated question text?');
    assert.equal(repo.calls.updateDraft.length, 1);
    assert.equal(repo.calls.updateDraft[0].id, DRAFT_ID);
    assert.equal(repo.calls.updateDraft[0].updates.questions.length, 1);
    assert.equal(repo.calls.updateDraft[0].updates.questions[0].id, QUESTION_ID);
  });

  it('throws GenerationForbiddenError for non-owner', async () => {
    const repo = createRegenerateRepositoryMock();
    const aiProvider = { async regenerateQuestion() { return []; } };

    await assert.rejects(
      () => regenerateQuestionItem(OTHER_TEACHER_ID, DRAFT_ID, QUESTION_ID, '', {
        repository: repo,
        aiProvider,
      }),
      (err) => err instanceof GenerationForbiddenError,
    );
    assert.equal(repo.calls.updateDraft.length, 0);
  });

  it('throws GenerationNotFoundError when question id is missing', async () => {
    const repo = createRegenerateRepositoryMock();
    const aiProvider = { async regenerateQuestion() { return []; } };

    await assert.rejects(
      () => regenerateQuestionItem(
        TEACHER_ID,
        DRAFT_ID,
        '55555555-5555-4555-8555-555555555555',
        '',
        { repository: repo, aiProvider },
      ),
      (err) => err instanceof GenerationNotFoundError,
    );
  });
});

describe('mergeRegeneratedQuestion', () => {
  it('keeps the existing question id', () => {
    const merged = mergeRegeneratedQuestion(
      { id: QUESTION_ID, text: 'Old', correctAnswer: 'A', difficulty: 'easy' },
      { text: 'New', correctAnswer: 'B', difficulty: 'hard', options: ['B', 'C'] },
    );
    assert.equal(merged.id, QUESTION_ID);
    assert.equal(merged.text, 'New');
    assert.deepEqual(merged.options, ['B', 'C']);
  });
});
