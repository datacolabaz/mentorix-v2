const {
  parseGenerateQuestionsInput,
  parsePersistedQuestionSet,
  parsePublishDraftInput,
  isUuid,
} = require('../modules/generation/generation.schema');
const {
  generateQuestions,
  regenerateQuestionItem,
  updateDraftContent,
  publishDraft,
  GenerationServiceError,
  GenerationForbiddenError,
  GenerationNotFoundError,
  GenerationConflictError,
  AssignmentPublishNotFoundError,
} = require('../modules/generation/generation.service');
const { AIGenerationError } = require('../providers/errors');
const { defaultClaudeProvider } = require('../providers/aiProviderService');
const { resolveCorrelationId } = require('../middleware/generationRateLimit');

/**
 * @param {unknown} body
 * @returns {{ questionId: string, instructions: string }}
 */
function parseRegenerateItemBody(body) {
  const record = body && typeof body === 'object' ? body : {};
  const questionId = String(record.questionId ?? '').trim();
  if (!questionId) {
    const err = new Error('questionId mütləqdir.');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  if (!isUuid(questionId)) {
    const err = new Error('questionId etibarlı UUID olmalıdır.');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const instructions = record.instructions == null ? '' : String(record.instructions).trim();
  if (instructions.length > 500) {
    const err = new Error('instructions ən çoxu 500 simvol ola bilər.');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  return { questionId, instructions };
}

/**
 * @param {unknown} body
 * @returns {import('../modules/generation/generation.types').GeneratedQuestion[]}
 */
function parseUpdateDraftBody(body) {
  const record = body && typeof body === 'object' ? body : {};
  if (!Array.isArray(record.questions)) {
    const err = new Error('questions massiv olmalıdır.');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }
  return parsePersistedQuestionSet(record.questions);
}

function mapGenerationError(err, res, correlationId) {
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

  if (err instanceof GenerationForbiddenError) {
    return res.status(403).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        correlationId,
      },
    });
  }

  if (err instanceof GenerationNotFoundError || err instanceof AssignmentPublishNotFoundError) {
    return res.status(404).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        correlationId,
      },
    });
  }

  if (err instanceof GenerationConflictError) {
    return res.status(409).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        correlationId,
      },
    });
  }

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
    return mapGenerationError(err, res, correlationId);
  }
}

/**
 * POST /api/generation/questions/:draftId/regenerate-item
 */
async function postRegenerateQuestionItem(req, res) {
  const correlationId = resolveCorrelationId(req);

  let body;
  try {
    body = parseRegenerateItemBody(req.body);
  } catch (err) {
    return mapGenerationError(err, res, correlationId);
  }

  try {
    const question = await regenerateQuestionItem(
      req.user.id,
      req.params.draftId,
      body.questionId,
      body.instructions,
    );

    return res.status(200).json({
      success: true,
      data: { question },
      meta: {
        regeneratedAt: new Date().toISOString(),
        model: defaultClaudeProvider.lastCallMeta?.model || null,
      },
    });
  } catch (err) {
    return mapGenerationError(err, res, correlationId);
  }
}

/**
 * PATCH /api/generation/drafts/:draftId
 */
async function patchDraftContent(req, res) {
  const correlationId = resolveCorrelationId(req);

  let questions;
  try {
    questions = parseUpdateDraftBody(req.body);
  } catch (err) {
    return mapGenerationError(err, res, correlationId);
  }

  try {
    const draft = await updateDraftContent(req.user.id, req.params.draftId, questions);

    return res.status(200).json({
      success: true,
      data: {
        draftId: draft.id,
        questions: draft.questions,
        status: draft.status,
      },
      meta: {
        updatedAt: draft.updated_at || new Date().toISOString(),
      },
    });
  } catch (err) {
    return mapGenerationError(err, res, correlationId);
  }
}

/**
 * POST /api/generation/drafts/:draftId/publish
 */
async function postPublishDraft(req, res) {
  const correlationId = resolveCorrelationId(req);

  let publishInput;
  try {
    publishInput = parsePublishDraftInput(req.body);
  } catch (err) {
    return mapGenerationError(err, res, correlationId);
  }

  try {
    const result = await publishDraft(req.user.id, req.params.draftId, publishInput);

    return res.status(201).json({
      success: true,
      data: {
        draftId: result.draft.id,
        assignmentId: result.assignment.assignmentId,
        title: result.assignment.title,
        dueDate: result.assignment.dueDate,
        groupId: result.assignment.groupId,
        status: result.draft.status,
      },
      meta: {
        publishedAt: result.draft.updated_at || new Date().toISOString(),
      },
    });
  } catch (err) {
    return mapGenerationError(err, res, correlationId);
  }
}

module.exports = {
  postGenerateQuestions,
  postRegenerateQuestionItem,
  patchDraftContent,
  postPublishDraft,
};
