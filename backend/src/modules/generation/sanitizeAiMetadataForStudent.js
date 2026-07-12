/**
 * Strips instructor-only answer keys from AI assignment metadata before
 * returning it to students. correctAnswer stays in the DB for grading.
 *
 * @param {unknown} aiMetadata
 * @returns {unknown}
 */
function sanitizeAiMetadataForStudent(aiMetadata) {
  if (aiMetadata == null) return aiMetadata;

  let meta = aiMetadata;
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch {
      return aiMetadata;
    }
  }

  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return meta;
  if (!Array.isArray(meta.questions)) return meta;

  return {
    ...meta,
    questions: meta.questions.map((q) => {
      if (!q || typeof q !== 'object' || Array.isArray(q)) return q;
      const { correctAnswer: _ca, explanation: _ex, ...safe } = q;
      return safe;
    }),
  };
}

module.exports = {
  sanitizeAiMetadataForStudent,
};
