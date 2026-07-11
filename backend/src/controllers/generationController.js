const { parseGenerateQuestionsInput } = require('../modules/generation/generation.schema');
const {
  generateQuestions,
  GenerationServiceError,
} = require('../modules/generation/generation.service');
const { AIGenerationError } = require('../providers/errors');
const { defaultClaudeProvider } = require('../providers/aiProviderService');
const { resolveCorrelationId } = require('../middleware/generationRateLimit');

/**
 * POST /api/generation/questions
 * Validates input, delegates to generation.service, returns standard envelope.
 */
async function postGenerateQuestions(req, res) {
  const correlationId = resolveCorrelationId(req);

  let input;
  try {
    input = parseGenerateQuestionsInput(req.body);
  } catch (err) {
    if (/** @type {{ code?: string }} */ (err).code === 'VALIDATION_ERROR') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: err.message,
          correlationId,
        },
      });
    }
    throw err;
  }

  try {
    const draft = await generateQuestions(req.user.id, input);

    return res.status(201).json({
      success: true,
      data: {
        draftId: draft.id,
        questions: draft.questions,
      },
      meta: {
        generatedAt: draft.created_at || new Date().toISOString(),
        model: defaultClaudeProvider.lastCallMeta?.model || null,
      },
    });
  } catch (err) {
    if (err instanceof AIGenerationError) {
      return res.status(502).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          correlationId,
        },
      });
    }

    if (err instanceof GenerationServiceError) {
      return res.status(500).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          correlationId,
        },
      });
    }

    return res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: err instanceof Error ? err.message : 'Server xətası',
        correlationId,
      },
    });
  }
}

module.exports = {
  postGenerateQuestions,
};
