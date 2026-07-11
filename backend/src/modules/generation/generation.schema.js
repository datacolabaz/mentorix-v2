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

/** Zod-style alias for controller use in BE-08+. */
const GenerateQuestionsSchema = {
  validate: validateGenerateQuestionsInput,
  parse: parseGenerateQuestionsInput,
};

module.exports = {
  UUID_RE,
  MIN_TOPIC_LENGTH,
  MAX_TOPIC_LENGTH,
  MIN_QUESTION_COUNT,
  MAX_QUESTION_COUNT,
  isUuid,
  validateGenerateQuestionsInput,
  parseGenerateQuestionsInput,
  GenerateQuestionsSchema,
};
