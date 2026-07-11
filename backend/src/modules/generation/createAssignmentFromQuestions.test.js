const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  mapGeneratedQuestionsToExamQuestionRows,
} = require('./createAssignmentFromQuestions');

describe('mapGeneratedQuestionsToExamQuestionRows', () => {
  it('maps MCQ questions to multiple-choice exam rows', () => {
    const rows = mapGeneratedQuestionsToExamQuestionRows([
      {
        id: '550e8400-e29b-41d4-a716-446655440000',
        text: 'What is the median of a dataset?',
        options: ['Mean', 'Middle', 'Max', 'Min'],
        correctAnswer: 'Middle',
        difficulty: 'medium',
      },
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].question_type, 'multiple');
    assert.equal(rows[0].question_text, 'What is the median of a dataset?');
    assert.equal(rows[0].correct_answer, 'Middle');
    assert.equal(rows[0].order_num, 1);
  });

  it('maps open questions without options', () => {
    const rows = mapGeneratedQuestionsToExamQuestionRows([
      {
        id: '550e8400-e29b-41d4-a716-446655440001',
        text: 'Explain the difference between mean and median.',
        correctAnswer: 'Mean is average; median is middle value.',
        difficulty: 'hard',
      },
    ]);

    assert.equal(rows[0].question_type, 'open');
    assert.equal(rows[0].model_answer, 'Mean is average; median is middle value.');
    assert.equal(rows[0].options, null);
  });
});
