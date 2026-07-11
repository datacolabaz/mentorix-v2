const {
  GENERATION_LEVELS,
  GENERATION_FORMATS,
  GENERATION_DIFFICULTIES,
} = require('./generation.types');

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MIN_TOPIC_LENGTH = 3;
const MAX_TOPIC_LENGTH = 200;
const MIN_QUESTION_COUNT = 1;
const MAX_QUESTION_COUNT = 30;

const MIN_GENERATED_TEXT_LENGTH = 5;
const MIN_GENERATED_OPTIONS = 2;
const MAX_GENERATED_OPTIONS = 6;
const MIN_GENERATED_SET_LENGTH = 1;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

/**
 * @param {unknown} input
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
function validateGenerateQuestionsInput(input) {
  /** @type {Record<string, string>} */
  const errors = {};
  const body = input && typeof input === 'object' ? input : {};

  const requestId = body.requestId;
  if (requestId == null || String(requestId).trim() === '') {
    errors.requestId = 'requestId mütləqdir.';
  } else if (!isUuid(requestId)) {
    errors.requestId = 'requestId etibarlı UUID olmalıdır.';
  }

  const topic = String(body.topic ?? '').trim();
  if (!topic) {
    errors.topic = 'Mövzu mütləqdir.';
  } else if (topic.length < MIN_TOPIC_LENGTH) {
    errors.topic = `Mövzu ən azı ${MIN_TOPIC_LENGTH} simvol olmalıdır.`;
  } else if (topic.length > MAX_TOPIC_LENGTH) {
    errors.topic = `Mövzu ən çoxu ${MAX_TOPIC_LENGTH} simvol ola bilər.`;
  }

  const level = String(body.level ?? '');
  if (!level) {
    errors.level = 'Səviyyə mütləqdir.';
  } else if (!GENERATION_LEVELS.includes(level)) {
    errors.level = 'Düzgün səviyyə seçin (beginner, intermediate, advanced).';
  }

  const rawCount = body.questionCount;
  const count = rawCount === '' || rawCount == null ? NaN : Number(rawCount);
  if (!Number.isFinite(count) || !Number.isInteger(count)) {
    errors.questionCount = 'Sual sayı tam ədəd olmalıdır.';
  } else if (count < MIN_QUESTION_COUNT) {
    errors.questionCount = `Sual sayı ən azı ${MIN_QUESTION_COUNT} olmalıdır.`;
  } else if (count > MAX_QUESTION_COUNT) {
    errors.questionCount = `Sual sayı ən çoxu ${MAX_QUESTION_COUNT} ola bilər.`;
  }

  const format = String(body.format ?? '');
  if (!format) {
    errors.format = 'Format mütləqdir.';
  } else if (!GENERATION_FORMATS.includes(format)) {
    errors.format = 'Düzgün format seçin (mcq, open, essay).';
  }

  const difficulty = String(body.difficulty ?? '');
  if (!difficulty) {
    errors.difficulty = 'Çətinlik mütləqdir.';
  } else if (!GENERATION_DIFFICULTIES.includes(difficulty)) {
    errors.difficulty = 'Düzgün çətinlik seçin (easy, medium, hard).';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * @param {unknown} input
 * @returns {import('./generation.types').GenerationInput}
 */
function parseGenerateQuestionsInput(input) {
  const { valid, errors } = validateGenerateQuestionsInput(input);
  if (!valid) {
    const message = Object.values(errors).join(' ');
    const err = new Error(message);
    err.code = 'VALIDATION_ERROR';
    err.details = errors;
    throw err;
  }

  const body = /** @type {Record<string, unknown>} */ (input);
  return {
    requestId: String(body.requestId).trim(),
    topic: String(body.topic).trim(),
    level: String(body.level),
    questionCount: Number(body.questionCount),
    format: String(body.format),
    difficulty: String(body.difficulty),
  };
}

/**
 * Validate a single Claude-generated question object (Technical Spec §6.2).
 * Does not require `id` — assigned when persisted to a draft.
 *
 * @param {unknown} question
 * @param {number} [index=0]
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
function validateGeneratedQuestion(question, index = 0) {
  /** @type {Record<string, string>} */
  const errors = {};
  const prefix = `questions[${index}]`;
  const item = question && typeof question === 'object' ? question : null;

  if (!item) {
    errors[prefix] = 'Sual obyekti düzgün formatda deyil.';
    return { valid: false, errors };
  }

  const text = String(item.text ?? '').trim();
  if (!text) {
    errors[`${prefix}.text`] = 'Sual mətni mütləqdir.';
  } else if (text.length < MIN_GENERATED_TEXT_LENGTH) {
    errors[`${prefix}.text`] = `Sual mətni ən azı ${MIN_GENERATED_TEXT_LENGTH} simvol olmalıdır.`;
  }

  if (item.options != null) {
    if (!Array.isArray(item.options)) {
      errors[`${prefix}.options`] = 'Variantlar massiv olmalıdır.';
    } else {
      const options = item.options.map((opt) => String(opt ?? '').trim()).filter(Boolean);
      if (options.length < MIN_GENERATED_OPTIONS || options.length > MAX_GENERATED_OPTIONS) {
        errors[`${prefix}.options`] =
          `Variant sayı ${MIN_GENERATED_OPTIONS}–${MAX_GENERATED_OPTIONS} arasında olmalıdır.`;
      }
    }
  }

  const correctAnswer = String(item.correctAnswer ?? '').trim();
  if (!correctAnswer) {
    errors[`${prefix}.correctAnswer`] = 'Düzgün cavab mütləqdir.';
  }

  const difficulty = String(item.difficulty ?? '');
  if (!difficulty) {
    errors[`${prefix}.difficulty`] = 'Çətinlik mütləqdir.';
  } else if (!GENERATION_DIFFICULTIES.includes(difficulty)) {
    errors[`${prefix}.difficulty`] = 'Düzgün çətinlik seçin (easy, medium, hard).';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validate Claude output: a non-empty array of generated questions.
 *
 * @param {unknown} input
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
function validateGeneratedQuestionSet(input) {
  /** @type {Record<string, string>} */
  const errors = {};

  if (!Array.isArray(input)) {
    errors.questions = 'Sual siyahısı massiv olmalıdır.';
    return { valid: false, errors };
  }

  if (input.length < MIN_GENERATED_SET_LENGTH) {
    errors.questions = 'Ən azı bir sual tələb olunur.';
    return { valid: false, errors };
  }

  for (let i = 0; i < input.length; i += 1) {
    const result = validateGeneratedQuestion(input[i], i);
    if (!result.valid) {
      Object.assign(errors, result.errors);
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * @typedef {Object} ClaudeGeneratedQuestion
 * @property {string} text
 * @property {string[]=} options
 * @property {string} correctAnswer
 * @property {import('./generation.types').GenerationDifficulty} difficulty
 */

/**
 * @param {unknown} input
 * @returns {ClaudeGeneratedQuestion[]}
 */
function parseGeneratedQuestionSet(input) {
  const { valid, errors } = validateGeneratedQuestionSet(input);
  if (!valid) {
    const message = Object.values(errors).join(' ');
    const err = new Error(message);
    err.code = 'VALIDATION_ERROR';
    err.details = errors;
    throw err;
  }

  return input.map((question) => {
    const item = /** @type {Record<string, unknown>} */ (question);
    const parsed = {
      text: String(item.text).trim(),
      correctAnswer: String(item.correctAnswer).trim(),
      difficulty: String(item.difficulty),
    };
    if (item.options != null) {
      parsed.options = item.options
        .map((opt) => String(opt ?? '').trim())
        .filter(Boolean);
    }
    return parsed;
  });
}

/**
 * Validate a persisted draft question (includes stable `id` per Technical Spec §5–6).
 *
 * @param {unknown} question
 * @param {number} [index=0]
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
function validatePersistedQuestion(question, index = 0) {
  /** @type {Record<string, string>} */
  const errors = {};
  const prefix = `questions[${index}]`;
  const item = question && typeof question === 'object' ? question : null;

  const id = item ? String(item.id ?? '').trim() : '';
  if (!id) {
    errors[`${prefix}.id`] = 'Sual id mütləqdir.';
  } else if (!isUuid(id)) {
    errors[`${prefix}.id`] = 'Sual id etibarlı UUID olmalıdır.';
  }

  const base = validateGeneratedQuestion(question, index);
  if (!base.valid) {
    Object.assign(errors, base.errors);
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validate a full questions array for PATCH draft content updates.
 *
 * @param {unknown} input
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
function validatePersistedQuestionSet(input) {
  /** @type {Record<string, string>} */
  const errors = {};

  if (!Array.isArray(input)) {
    errors.questions = 'Sual siyahısı massiv olmalıdır.';
    return { valid: false, errors };
  }

  if (input.length < MIN_GENERATED_SET_LENGTH) {
    errors.questions = 'Ən azı bir sual tələb olunur.';
    return { valid: false, errors };
  }

  if (input.length > MAX_QUESTION_COUNT) {
    errors.questions = `Sual sayı ən çoxu ${MAX_QUESTION_COUNT} ola bilər.`;
    return { valid: false, errors };
  }

  for (let i = 0; i < input.length; i += 1) {
    const result = validatePersistedQuestion(input[i], i);
    if (!result.valid) {
      Object.assign(errors, result.errors);
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * @param {unknown} input
 * @returns {import('./generation.types').GeneratedQuestion[]}
 */
function parsePersistedQuestionSet(input) {
  const { valid, errors } = validatePersistedQuestionSet(input);
  if (!valid) {
    const message = Object.values(errors).join(' ');
    const err = new Error(message);
    err.code = 'VALIDATION_ERROR';
    err.details = errors;
    throw err;
  }

  return input.map((question) => {
    const item = /** @type {Record<string, unknown>} */ (question);
    const parsed = {
      id: String(item.id).trim(),
      text: String(item.text).trim(),
      correctAnswer: String(item.correctAnswer).trim(),
      difficulty: String(item.difficulty),
    };
    if (item.options != null) {
      parsed.options = item.options
        .map((opt) => String(opt ?? '').trim())
        .filter(Boolean);
    }
    return parsed;
  });
}

const MIN_PUBLISH_TITLE_LENGTH = 1;
const MAX_PUBLISH_TITLE_LENGTH = 255;

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function parsePublishDueDate(value) {
  if (value === undefined || value === null || value === '') return null;
  const dueDate = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const [year, month, day] = dueDate.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return dueDate;
}

/**
 * @param {unknown} input
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
function validatePublishDraftInput(input) {
  /** @type {Record<string, string>} */
  const errors = {};
  const body = input && typeof input === 'object' ? input : {};

  const groupId = String(body.groupId ?? '').trim();
  if (!groupId) {
    errors.groupId = 'groupId mütləqdir.';
  } else if (!isUuid(groupId)) {
    errors.groupId = 'groupId etibarlı UUID olmalıdır.';
  }

  const title = String(body.title ?? '').trim();
  if (!title) {
    errors.title = 'Tapşırığın adı mütləqdir.';
  } else if (title.length < MIN_PUBLISH_TITLE_LENGTH) {
    errors.title = `Tapşırığın adı ən azı ${MIN_PUBLISH_TITLE_LENGTH} simvol olmalıdır.`;
  } else if (title.length > MAX_PUBLISH_TITLE_LENGTH) {
    errors.title = `Tapşırığın adı ən çoxu ${MAX_PUBLISH_TITLE_LENGTH} simvol ola bilər.`;
  }

  const dueDate = parsePublishDueDate(body.dueDate);
  if (!dueDate) {
    errors.dueDate = 'dueDate YYYY-MM-DD formatında olmalıdır.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * @param {unknown} input
 * @returns {import('./generation.types').PublishDraftInput}
 */
function parsePublishDraftInput(input) {
  const { valid, errors } = validatePublishDraftInput(input);
  if (!valid) {
    const message = Object.values(errors).join(' ');
    const err = new Error(message);
    err.code = 'VALIDATION_ERROR';
    err.details = errors;
    throw err;
  }

  const body = /** @type {Record<string, unknown>} */ (input);
  return {
    groupId: String(body.groupId).trim(),
    title: String(body.title).trim(),
    dueDate: parsePublishDueDate(body.dueDate),
  };
}

/** Zod-style alias for controller use in BE-08+. */
const GenerateQuestionsSchema = {
  validate: validateGenerateQuestionsInput,
  parse: parseGenerateQuestionsInput,
};

/** Zod-style alias for Claude output validation in BE-05+. */
const GeneratedQuestionSchema = {
  validate: validateGeneratedQuestion,
};

const GeneratedQuestionSetSchema = {
  validate: validateGeneratedQuestionSet,
  parse: parseGeneratedQuestionSet,
};

const PersistedQuestionSchema = {
  validate: validatePersistedQuestion,
};

const PersistedQuestionSetSchema = {
  validate: validatePersistedQuestionSet,
  parse: parsePersistedQuestionSet,
};

const PublishDraftSchema = {
  validate: validatePublishDraftInput,
  parse: parsePublishDraftInput,
};

module.exports = {
  UUID_RE,
  MIN_TOPIC_LENGTH,
  MAX_TOPIC_LENGTH,
  MIN_QUESTION_COUNT,
  MAX_QUESTION_COUNT,
  MIN_GENERATED_TEXT_LENGTH,
  MIN_GENERATED_OPTIONS,
  MAX_GENERATED_OPTIONS,
  MIN_GENERATED_SET_LENGTH,
  isUuid,
  validateGenerateQuestionsInput,
  parseGenerateQuestionsInput,
  GenerateQuestionsSchema,
  validateGeneratedQuestion,
  validateGeneratedQuestionSet,
  parseGeneratedQuestionSet,
  GeneratedQuestionSchema,
  GeneratedQuestionSetSchema,
  validatePersistedQuestion,
  validatePersistedQuestionSet,
  parsePersistedQuestionSet,
  PersistedQuestionSchema,
  PersistedQuestionSetSchema,
  MIN_PUBLISH_TITLE_LENGTH,
  MAX_PUBLISH_TITLE_LENGTH,
  parsePublishDueDate,
  validatePublishDraftInput,
  parsePublishDraftInput,
  PublishDraftSchema,
};
