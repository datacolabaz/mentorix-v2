/**
 * Publishes AI-generated draft questions into the existing assignments domain (BE-11).
 * exam_questions mapping is exposed as an interface for the exams epic; rows are not inserted here.
 */

const db = require('../../utils/db');
const { resolveGroupStudentIds } = require('../../services/assignmentHomeworkService');

/**
 * @typedef {import('./generation.types').GeneratedQuestion} GeneratedQuestion
 */

/**
 * @typedef {Object} CreateAssignmentFromQuestionsInput
 * @property {string} instructorId
 * @property {string} groupId
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
 */

class AssignmentPublishNotFoundError extends Error {
  constructor(message = 'Qrup tapılmadı') {
    super(message);
    this.name = 'AssignmentPublishNotFoundError';
    this.code = 'NOT_FOUND';
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
 * @param {CreateAssignmentFromQuestionsInput} input
 * @param {typeof db} [client]
 * @returns {Promise<CreatedAssignmentReference>}
 */
async function createAssignmentFromQuestions(input, client = db) {
  const { instructorId, groupId, title, dueDate, questions, topic } = input;

  const { rows: groupRows } = await client.query(
    `SELECT id
     FROM instructor_groups
     WHERE id = $1::uuid
       AND instructor_id = $2::uuid
     LIMIT 1`,
    [groupId, instructorId],
  );
  if (!groupRows[0]) {
    throw new AssignmentPublishNotFoundError();
  }

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
      groupId,
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

  const studentIds = await resolveGroupStudentIds(instructorId, groupId);
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
  };
}

module.exports = {
  AssignmentPublishNotFoundError,
  mapGeneratedQuestionsToExamQuestionRows,
  createAssignmentFromQuestions,
};
