/**
 * Reads AI-generated questions persisted on an assignment's `ai_metadata`
 * (see backend createAssignmentFromQuestions: { source: 'ai_generation', questions }).
 * Tolerates a raw object or a JSON string and always returns a clean array.
 *
 * @param {unknown} aiMetadata
 * @param {{ includeAnswers?: boolean }} [opts]
 * @returns {Array<{ id?: string, text: string, correctAnswer?: string, difficulty?: string, options?: string[], explanation?: string }>}
 */
export function extractGeneratedQuestions(aiMetadata, opts = {}) {
  const includeAnswers = opts.includeAnswers !== false
  let meta = aiMetadata
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta)
    } catch {
      return []
    }
  }
  if (!meta || typeof meta !== 'object') return []
  const questions = Array.isArray(meta.questions) ? meta.questions : []
  return questions
    .filter((q) => q && typeof q === 'object' && String(q.text ?? '').trim())
    .map((q, index) => {
      const base = {
        id: q.id != null ? String(q.id) : `q-${index}`,
        text: String(q.text ?? '').trim(),
        difficulty: q.difficulty != null ? String(q.difficulty) : '',
        ...(Array.isArray(q.options) && q.options.length
          ? { options: q.options.map((o) => String(o ?? '').trim()).filter(Boolean) }
          : {}),
      }
      if (!includeAnswers) return base
      return {
        ...base,
        correctAnswer: q.correctAnswer != null ? String(q.correctAnswer).trim() : '',
        ...(q.explanation ? { explanation: String(q.explanation).trim() } : {}),
      }
    })
}

/**
 * Student-safe extractor — never includes correctAnswer or explanation.
 * @param {unknown} aiMetadata
 */
export function extractGeneratedQuestionsForStudent(aiMetadata) {
  return extractGeneratedQuestions(aiMetadata, { includeAnswers: false })
}

/**
 * True when an assignment was produced by the AI generator.
 * @param {unknown} aiMetadata
 */
export function isAiGeneratedAssignment(aiMetadata) {
  let meta = aiMetadata
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta)
    } catch {
      return false
    }
  }
  return Boolean(meta && typeof meta === 'object' && meta.source === 'ai_generation')
}
