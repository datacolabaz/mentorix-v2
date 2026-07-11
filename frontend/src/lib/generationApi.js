import api from './api'

/**
 * Client for the Epic 1 AI question generation backend (/api/generation).
 * The axios instance already unwraps `res.data`, so each helper returns the
 * backend success envelope ({ success, data, meta }). Errors reject with the
 * wrapped envelope where the human message lives on `error.message`/`message`.
 */

/**
 * Normalises a rejected generation request into a readable message.
 * @param {unknown} err
 * @param {string} fallback
 * @returns {string}
 */
export function generationErrorMessage(err, fallback = 'Xəta baş verdi. Yenidən cəhd edin.') {
  if (err && typeof err === 'object') {
    const wrapped = /** @type {{ error?: { message?: string }, message?: string }} */ (err)
    return wrapped.error?.message || wrapped.message || fallback
  }
  return fallback
}

/** Generates a request id for idempotent generation calls. */
export function newGenerationRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // RFC4122-ish fallback for environments without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * @param {{
 *   requestId: string,
 *   topic: string,
 *   level: string,
 *   questionCount: number,
 *   format: string,
 *   difficulty: string,
 * }} payload
 * @returns {Promise<{ draftId: string, questions: any[] }>}
 */
export async function generateQuestions(payload) {
  const res = await api.post('/generation/questions', payload)
  return res?.data || { draftId: '', questions: [] }
}

/**
 * @param {string} draftId
 * @param {string} questionId
 * @param {string} [instructions]
 * @returns {Promise<{ question: any }>}
 */
export async function regenerateQuestionItem(draftId, questionId, instructions = '') {
  const body = { questionId }
  if (instructions && instructions.trim()) body.instructions = instructions.trim()
  const res = await api.post(`/generation/questions/${draftId}/regenerate-item`, body)
  return res?.data || { question: null }
}

/**
 * Persists the full edited questions array to a draft.
 * @param {string} draftId
 * @param {any[]} questions
 * @returns {Promise<{ draftId: string, questions: any[], status: string }>}
 */
export async function updateDraftContent(draftId, questions) {
  const res = await api.patch(`/generation/drafts/${draftId}`, { questions })
  return res?.data || { draftId, questions, status: 'draft' }
}

/**
 * @param {string} draftId
 * @param {{ groupId: string, title: string, dueDate: string }} payload
 * @returns {Promise<{ assignmentId: string, title: string, dueDate: string, groupId: string }>}
 */
export async function publishDraft(draftId, payload) {
  const res = await api.post(`/generation/drafts/${draftId}/publish`, payload)
  return res?.data || {}
}

/**
 * @param {string} draftId
 * @returns {Promise<{ draftId: string, status: string }>}
 */
export async function discardDraft(draftId) {
  const res = await api.delete(`/generation/drafts/${draftId}`)
  return res?.data || { draftId, status: 'discarded' }
}
