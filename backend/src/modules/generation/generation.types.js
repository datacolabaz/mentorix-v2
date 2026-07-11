/**
 * Epic 1 — AI content generation domain types (BE-01).
 * Types only: JSDoc contracts + shared enum constants. No validation or service logic.
 */

/** @typedef {'beginner' | 'intermediate' | 'advanced'} GenerationLevel */

/** @typedef {'mcq' | 'open' | 'essay'} GenerationFormat */

/** @typedef {'easy' | 'medium' | 'hard'} GenerationDifficulty */

/** @typedef {'draft' | 'published' | 'discarded'} DraftStatus */

/**
 * Teacher request body for POST /api/generation/questions (Technical Spec §5.1).
 * @typedef {Object} GenerationInput
 * @property {string} requestId - Client-supplied idempotency UUID.
 * @property {string} topic - Subject or prompt topic (3–200 chars; validated in BE-02).
 * @property {GenerationLevel} level
 * @property {number} questionCount - Integer count of questions to generate (1–30).
 * @property {GenerationFormat} format
 * @property {GenerationDifficulty} difficulty
 */

/**
 * A single AI-generated question stored on a draft (Technical Spec §5–6).
 * @typedef {Object} GeneratedQuestion
 * @property {string} id - Stable UUID assigned when the question is persisted.
 * @property {string} text - Question prompt text.
 * @property {string[]=} options - MCQ answer choices (2–6 items when format is mcq).
 * @property {string} correctAnswer - Expected or keyed correct answer.
 * @property {GenerationDifficulty} difficulty
 */

/**
 * Successful generation response `data` payload (Technical Spec §5.1).
 * @typedef {Object} GenerationResult
 * @property {string} draftId - `generation_drafts.id` UUID.
 * @property {GeneratedQuestion[]} questions
 */

/**
 * Request body for POST /api/generation/drafts/:draftId/publish (Technical Spec §5.4).
 * @typedef {Object} PublishDraftInput
 * @property {string} groupId - Target instructor_groups.id UUID.
 * @property {string} title - Assignment title shown to students.
 * @property {string} dueDate - Due date in YYYY-MM-DD format.
 */

/**
 * Assignment reference returned after a successful publish.
 * @typedef {Object} PublishedAssignmentReference
 * @property {string} assignmentId - `assignments.id` UUID.
 * @property {string} title
 * @property {string | null} dueDate
 * @property {string | null} groupId
 */

/** @type {readonly GenerationLevel[]} */
const GENERATION_LEVELS = Object.freeze(['beginner', 'intermediate', 'advanced']);

/** @type {readonly GenerationFormat[]} */
const GENERATION_FORMATS = Object.freeze(['mcq', 'open', 'essay']);

/** @type {readonly GenerationDifficulty[]} */
const GENERATION_DIFFICULTIES = Object.freeze(['easy', 'medium', 'hard']);

/** @type {readonly DraftStatus[]} */
const DRAFT_STATUSES = Object.freeze(['draft', 'published', 'discarded']);

module.exports = {
  GENERATION_LEVELS,
  GENERATION_FORMATS,
  GENERATION_DIFFICULTIES,
  DRAFT_STATUSES,
};
