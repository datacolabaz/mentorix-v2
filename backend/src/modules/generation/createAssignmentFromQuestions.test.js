const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  mapGeneratedQuestionsToExamQuestionRows,
  resolvePublishTeachingGroupId,
  AssignmentPublishNotFoundError,
  AssignmentPublishInvalidGroupError,
} = require('./createAssignmentFromQuestions');
const { SQL_WHERE_TEACHING_GROUP_ONLY } = require('../../services/systemGroupGuards');

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

describe('resolvePublishTeachingGroupId', () => {
  const INSTRUCTOR_ID = '110e8400-e29b-41d4-a716-446655440000';
  const GROUP_ID = '220e8400-e29b-41d4-a716-446655440000';

  it('returns null for empty/missing groupId (link-only)', async () => {
    const client = {
      async query() {
        assert.fail('should not query when groupId is empty');
      },
    };
    assert.equal(await resolvePublishTeachingGroupId(null, INSTRUCTOR_ID, client), null);
    assert.equal(await resolvePublishTeachingGroupId('', INSTRUCTOR_ID, client), null);
    assert.equal(await resolvePublishTeachingGroupId('  ', INSTRUCTOR_ID, client), null);
  });

  it('returns teaching group id when group is real', async () => {
    const client = {
      async query(_sql, params) {
        assert.equal(params[0], GROUP_ID);
        assert.equal(params[1], INSTRUCTOR_ID);
        return { rows: [{ id: GROUP_ID, is_system: false }] };
      },
    };
    assert.equal(await resolvePublishTeachingGroupId(GROUP_ID, INSTRUCTOR_ID, client), GROUP_ID);
  });

  it('rejects system link-participant cohorts', async () => {
    const client = {
      async query() {
        return { rows: [{ id: GROUP_ID, is_system: true }] };
      },
    };
    await assert.rejects(
      () => resolvePublishTeachingGroupId(GROUP_ID, INSTRUCTOR_ID, client),
      (err) => err instanceof AssignmentPublishInvalidGroupError,
    );
  });

  it('rejects unknown group', async () => {
    const client = {
      async query() {
        return { rows: [] };
      },
    };
    await assert.rejects(
      () => resolvePublishTeachingGroupId(GROUP_ID, INSTRUCTOR_ID, client),
      (err) => err instanceof AssignmentPublishNotFoundError,
    );
  });
});

describe('teaching-group SQL guard used by /tasks/groups', () => {
  it('excludes system participant cohorts via is_system', () => {
    assert.match(SQL_WHERE_TEACHING_GROUP_ONLY, /is_system/);
    assert.match(SQL_WHERE_TEACHING_GROUP_ONLY, /FALSE/);
  });
});
