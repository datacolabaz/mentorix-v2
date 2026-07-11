const { randomUUID } = require('crypto');
const { defaultClaudeProvider } = require('../../providers/aiProviderService');
const { AIGenerationError } = require('../../providers/errors');
const repository = require('./generation.repository');

/**
 * @typedef {import('./generation.types').GenerationInput} GenerationInput
 * @typedef {import('./generation.repository').GenerationDraftRow} GenerationDraftRow
 */

class GenerationServiceError extends Error {
  /**
   * @param {string} message
   * @param {Object} [options]
   * @param {unknown} [options.cause]
   */
  constructor(message, { cause } = {}) {
    super(message);
    this.name = 'GenerationServiceError';
    this.code = 'GENERATION_FAILED';
    if (cause !== undefined) this.cause = cause;
  }
}

class GenerationForbiddenError extends Error {
  /**
   * @param {string} [message]
   */
  constructor(message = 'Bu draft üzərində icazəniz yoxdur') {
    super(message);
    this.name = 'GenerationForbiddenError';
    this.code = 'FORBIDDEN';
  }
}

class GenerationNotFoundError extends Error {
  /**
   * @param {string} [message]
   */
  constructor(message = 'Tapılmadı') {
    super(message);
    this.name = 'GenerationNotFoundError';
    this.code = 'NOT_FOUND';
  }
}

/**
 * @param {import('./generation.schema').ClaudeGeneratedQuestion[]} questions
 * @returns {import('./generation.types').GeneratedQuestion[]}
 */
function assignQuestionIds(questions) {
  return questions.map((question) => ({
    id: randomUUID(),
    text: question.text,
    correctAnswer: question.correctAnswer,
    difficulty: question.difficulty,
    ...(question.options != null ? { options: question.options } : {}),
  }));
}

/**
 * @param {string} teacherId
 * @param {GenerationInput} input
 * @param {Object} [deps]
 * @param {typeof repository} [deps.repository]
 * @param {import('../../providers/aiProviderService').AIProvider} [deps.aiProvider]
 * @param {import('../../utils/db')} [deps.client]
 * @returns {Promise<GenerationDraftRow>}
 */
async function generateQuestions(
  teacherId,
  input,
  { repository: repo = repository, aiProvider = defaultClaudeProvider, client } = {},
) {
  const requestRow = await repo.createGenerationRequest(
    {
      teacherId,
      requestPayload: input,
      status: 'pending',
    },
    client,
  );

  try {
    const generatedQuestions = await aiProvider.generateQuestions(input);
    const meta = aiProvider.lastCallMeta;
    const questions = assignQuestionIds(generatedQuestions);

    await repo.updateGenerationRequestStatus(
      requestRow.id,
      'success',
      {
        modelUsed: meta?.model,
        tokenUsage: meta?.tokenUsage,
        latencyMs: meta?.latencyMs,
      },
      client,
    );

    return repo.createDraft(
      {
        requestId: requestRow.id,
        teacherId,
        questions,
        status: 'draft',
      },
      client,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failureExtra = {
      errorMessage: message,
    };

    if (aiProvider.lastCallMeta) {
      failureExtra.modelUsed = aiProvider.lastCallMeta.model;
      failureExtra.tokenUsage = aiProvider.lastCallMeta.tokenUsage;
      failureExtra.latencyMs = aiProvider.lastCallMeta.latencyMs;
    }

    await repo.updateGenerationRequestStatus(requestRow.id, 'failed', failureExtra, client);

    if (err instanceof AIGenerationError) {
      throw err;
    }

    throw new GenerationServiceError(message, { cause: err });
  }
}

/**
 * @param {import('./generation.types').GeneratedQuestion} existingQuestion
 * @param {import('./generation.schema').ClaudeGeneratedQuestion} generated
 * @returns {import('./generation.types').GeneratedQuestion}
 */
function mergeRegeneratedQuestion(existingQuestion, generated) {
  return {
    id: existingQuestion.id,
    text: generated.text,
    correctAnswer: generated.correctAnswer,
    difficulty: generated.difficulty,
    ...(generated.options != null ? { options: generated.options } : {}),
  };
}

/**
 * @param {string} teacherId
 * @param {string} draftId
 * @param {string} questionId
 * @param {string} [instructions]
 * @param {Object} [deps]
 * @param {typeof repository} [deps.repository]
 * @param {import('../../providers/aiProviderService').ClaudeProvider} [deps.aiProvider]
 * @param {import('../../utils/db')} [deps.client]
 * @returns {Promise<import('./generation.types').GeneratedQuestion>}
 */
async function regenerateQuestionItem(
  teacherId,
  draftId,
  questionId,
  instructions = '',
  { repository: repo = repository, aiProvider = defaultClaudeProvider, client } = {},
) {
  const draft = await repo.getDraftById(draftId, client);
  if (!draft) {
    throw new GenerationNotFoundError('Draft tapılmadı');
  }
  if (draft.teacher_id !== teacherId) {
    throw new GenerationForbiddenError();
  }

  const questions = Array.isArray(draft.questions) ? draft.questions : [];
  const questionIndex = questions.findIndex((question) => question.id === questionId);
  if (questionIndex < 0) {
    throw new GenerationNotFoundError('Sual tapılmadı');
  }

  const requestRow = await repo.getGenerationRequestById(draft.request_id, client);
  const baseInput = requestRow?.request_payload;
  if (!baseInput || typeof baseInput !== 'object') {
    throw new GenerationServiceError('Generation konteksti tapılmadı');
  }

  const existingQuestion = questions[questionIndex];
  const generatedQuestions = await aiProvider.regenerateQuestion({
    baseInput: /** @type {GenerationInput} */ (baseInput),
    existingQuestion,
    instructions,
  });

  const generated = generatedQuestions[0];
  if (!generated) {
    throw new GenerationServiceError('AI replacement question missing from provider response');
  }

  const updatedQuestion = mergeRegeneratedQuestion(existingQuestion, generated);
  const nextQuestions = [...questions];
  nextQuestions[questionIndex] = updatedQuestion;

  await repo.updateDraft(draftId, { questions: nextQuestions }, client);

  return updatedQuestion;
}

module.exports = {
  GenerationServiceError,
  GenerationForbiddenError,
  GenerationNotFoundError,
  assignQuestionIds,
  mergeRegeneratedQuestion,
  generateQuestions,
  regenerateQuestionItem,
};
