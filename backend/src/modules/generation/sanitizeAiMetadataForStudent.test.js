const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeAiMetadataForStudent } = require('./sanitizeAiMetadataForStudent');

describe('sanitizeAiMetadataForStudent', () => {
  it('removes correctAnswer and explanation from each question', () => {
    const input = {
      source: 'ai_generation',
      questions: [
        {
          id: 'q1',
          text: 'What is 2+2?',
          correctAnswer: '4',
          explanation: 'Basic arithmetic',
          difficulty: 'easy',
          options: ['3', '4', '5'],
        },
      ],
    };

    const out = sanitizeAiMetadataForStudent(input);
    assert.equal(out.questions[0].text, 'What is 2+2?');
    assert.equal(out.questions[0].difficulty, 'easy');
    assert.deepEqual(out.questions[0].options, ['3', '4', '5']);
    assert.equal('correctAnswer' in out.questions[0], false);
    assert.equal('explanation' in out.questions[0], false);
  });

  it('leaves non-question metadata intact', () => {
    const input = { source: 'ai_generation', draftId: 'abc' };
    const out = sanitizeAiMetadataForStudent(input);
    assert.deepEqual(out, input);
  });

  it('parses JSON strings', () => {
    const input = JSON.stringify({
      source: 'ai_generation',
      questions: [{ id: 'q1', text: 'Q?', correctAnswer: 'A' }],
    });
    const out = sanitizeAiMetadataForStudent(input);
    assert.equal(out.questions[0].text, 'Q?');
    assert.equal('correctAnswer' in out.questions[0], false);
  });
});
