/**
 * Typed provider errors for Epic 1 generation (BE-05).
 */

class AIGenerationError extends Error {
  /**
   * @param {string} message
   * @param {Object} [options]
   * @param {unknown} [options.cause]
   * @param {Record<string, string>} [options.details]
   */
  constructor(message, { cause, details } = {}) {
    super(message);
    this.name = 'AIGenerationError';
    this.code = 'AI_GENERATION_ERROR';
    if (cause !== undefined) this.cause = cause;
    if (details !== undefined) this.details = details;
  }
}

/**
 * Whether Claude output parsing/validation can be retried once.
 *
 * @param {unknown} err
 * @returns {boolean}
 */
function isRetriableOutputError(err) {
  if (err instanceof SyntaxError) return true;
  if (/** @type {{ code?: string }} */ (err)?.code === 'VALIDATION_ERROR') return true;

  const message = String(/** @type {{ message?: string }} */ (err)?.message || '');
  return (
    message.includes('Claude cavabı') ||
    message.includes('JSON') ||
    message.includes('Unexpected token')
  );
}

module.exports = {
  AIGenerationError,
  isRetriableOutputError,
};
