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

module.exports = {
  GenerationServiceError,
  assignQuestionIds,
  generateQuestions,
};
