/**
 * Publishes AI-generated draft questions into the existing assignments domain (BE-11).
 * exam_questions mapping is exposed as an interface for the exams epic; rows are not inserted here.
 */

const db = require('../../utils/db');
const {
  resolveGroupStudentIds,
  notifyStudentsOfNewAssignment,
} = require('../../services/assignmentHomeworkService');
const { SYSTEM_GROUP_IMMUTABLE_MSG } = require('../../services/systemGroupGuards');

/**
 * @typedef {import('./generation.types').GeneratedQuestion} GeneratedQuestion
 */

/**
 * @typedef {Object} CreateAssignmentFromQuestionsInput
 * @property {string} instructorId
 * @property {string | null | undefined} groupId - Real teaching group, or null/omit for link-only.
 * @property {string} title
 * @property {string} dueDate - YYYY-MM-DD
 * @property {GeneratedQuestion[]} questions
 * @property {string=} topic
 */

/**
 * @typedef {Object} CreatedAssignmentReference
 * @property {string} assignmentId
 * @property {string} title
 * @property {string | null} dueDate
 * @property {string | null} groupId
 * @property {string[]} studentIds
 */

class AssignmentPublishNotFoundError extends Error {
  constructor(message = 'Qrup tapılmadı') {
    super(message);
    this.name = 'AssignmentPublishNotFoundError';
    this.code = 'NOT_FOUND';
  }
}

class AssignmentPublishInvalidGroupError extends Error {
  constructor(message = SYSTEM_GROUP_IMMUTABLE_MSG) {
    super(message);
    this.name = 'AssignmentPublishInvalidGroupError';
    this.code = 'SYSTEM_GROUP_IMMUTABLE';
    this.statusCode = 400;
  }
}

/**
 * Maps generation draft questions to exam_questions row payloads (interface only).
 *
 * @param {GeneratedQuestion[]} questions
 * @returns {Array<{
 *   question_text: string,
 *   question_type: string,
 *   options: string[] | null,
 *   correct_answer: string,
 *   points: number,
 *   order_num: number,
 *   model_answer: string | null,
 * }>}
 */
function mapGeneratedQuestionsToExamQuestionRows(questions) {
  return questions.map((question, index) => {
    const hasOptions = Array.isArray(question.options) && question.options.length > 0;
    return {
      question_text: question.text,
      question_type: hasOptions ? 'multiple' : 'open',
      options: hasOptions ? question.options : null,
      correct_answer: question.correctAnswer,
      points: 10,
      order_num: index + 1,
      model_answer: hasOptions ? null : question.correctAnswer,
    };
  });
}

/**
 * Resolves an optional teaching-group target. Empty/null → link-only publish.
 * System link-participant cohorts are never valid publish targets.
 *
 * @param {string | null | undefined} groupId
 * @param {string} instructorId
 * @param {typeof db} client
 * @returns {Promise<string | null>}
 */
async function resolvePublishTeachingGroupId(groupId, instructorId, client) {
  const trimmed = groupId != null ? String(groupId).trim() : '';
  if (!trimmed) return null;

  const { rows } = await client.query(
    `SELECT ig.id, COALESCE(ig.is_system, FALSE) AS is_system
     FROM instructor_groups ig
     WHERE ig.id = $1::uuid
       AND ig.instructor_id = $2::uuid
     LIMIT 1`,
    [trimmed, instructorId],
  );
  const group = rows[0];
  if (!group) {
    throw new AssignmentPublishNotFoundError();
  }
  // System link/exam/assignment participant cohorts are not teaching groups.
  if (group.is_system) {
    throw new AssignmentPublishInvalidGroupError();
  }
  return group.id;
}

/**
 * @param {CreateAssignmentFromQuestionsInput} input
 * @param {typeof db} [client]
 * @returns {Promise<CreatedAssignmentReference>}
 */
async function createAssignmentFromQuestions(input, client = db) {
  const { instructorId, groupId, title, dueDate, questions, topic } = input;

  const resolvedGroupId = await resolvePublishTeachingGroupId(groupId, instructorId, client);

  // Interface hook for exams epic — maps rows without persisting to exam_questions yet.
  mapGeneratedQuestionsToExamQuestionRows(questions);

  const { rows: assignmentRows } = await client.query(
    `INSERT INTO assignments (instructor_id, title, topic, due_date, group_id, ai_metadata)
     VALUES ($1::uuid, $2, NULLIF($3, ''), $4::date, $5::uuid, $6::jsonb)
     RETURNING id, title, due_date, group_id`,
    [
      instructorId,
      title,
      topic ?? null,
      dueDate,
      resolvedGroupId,
      JSON.stringify({
        source: 'ai_generation',
        questions,
      }),
    ],
  );
  const assignment = assignmentRows[0];
  if (!assignment) {
    throw new Error('assignments insert failed');
  }

  const {
    ensureAssignmentParticipantGroup,
    addStudentToAssignmentParticipantGroup,
  } = require('../../services/participantGroupService');
  await ensureAssignmentParticipantGroup(client, instructorId, assignment.id, assignment.title);

  const studentIds = resolvedGroupId
    ? await resolveGroupStudentIds(instructorId, resolvedGroupId)
    : [];
  if (studentIds.length) {
    await client.query(
      `INSERT INTO student_assignments (assignment_id, student_id, status)
       SELECT $1::uuid, x::uuid, 'pending'
       FROM UNNEST($2::uuid[]) AS x
       ON CONFLICT (assignment_id, student_id) DO NOTHING`,
      [assignment.id, studentIds],
    );

    for (const studentId of studentIds) {
      await addStudentToAssignmentParticipantGroup(client, assignment.id, studentId);
    }
  }

  return {
    assignmentId: assignment.id,
    title: assignment.title,
    dueDate: assignment.due_date,
    groupId: assignment.group_id,
    studentIds,
  };
}

/**
 * Best-effort student notifications after a successful publish transaction.
 * Kept separate so it never rolls back the assignment insert.
 *
 * @param {CreatedAssignmentReference} assignment
 * @param {string} instructorId
 * @param {typeof db} [database]
 */
async function notifyStudentsAfterAiPublish(assignment, instructorId, database = db) {
  const studentIds = Array.isArray(assignment?.studentIds) ? assignment.studentIds : [];
  if (!studentIds.length || !assignment?.assignmentId) return;

  const { rows: iu } = await database.query(
    `SELECT full_name FROM users WHERE id = $1::uuid LIMIT 1`,
    [instructorId],
  );
  await notifyStudentsOfNewAssignment(
    {
      id: assignment.assignmentId,
      title: assignment.title,
      due_date: assignment.dueDate,
    },
    studentIds,
    iu[0]?.full_name || '',
  );
}

module.exports = {
  AssignmentPublishNotFoundError,
  AssignmentPublishInvalidGroupError,
  mapGeneratedQuestionsToExamQuestionRows,
  resolvePublishTeachingGroupId,
  createAssignmentFromQuestions,
  notifyStudentsAfterAiPublish,
};
