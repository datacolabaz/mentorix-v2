const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { ClaudeProvider, buildGenerationUserPrompt } = require('./aiProviderService');
const { AIGenerationError } = require('./errors');

const VALID_INPUT = {
  requestId: '550e8400-e29b-41d4-a716-446655440000',
  topic: 'Data Analytics fundamentals',
  level: 'intermediate',
  questionCount: 1,
  format: 'mcq',
  difficulty: 'medium',
};

const VALID_QUESTION = {
  text: 'What is the median of a dataset?',
  options: ['Mean value', 'Middle value', 'Largest value', 'Smallest value'],
  correctAnswer: 'Middle value',
  difficulty: 'medium',
};

/**
 * @param {string} text
 * @param {Object} [overrides]
 */
function mockAnthropicResponse(text, overrides = {}) {
  return {
    ok: true,
    text: async () => '',
    json: async () => ({
      model: 'claude-sonnet-5',
      content: [{ type: 'text', text }],
      usage: { input_tokens: 100, output_tokens: 50 },
      ...overrides,
    }),
  };
}

describe('buildGenerationUserPrompt retry suffix', () => {
  it('appends corrective instruction on retry', () => {
    const retryPrompt = buildGenerationUserPrompt(VALID_INPUT, { isRetry: true });
    assert.match(retryPrompt, /CORRECTION REQUIRED/);
    assert.match(retryPrompt, /valid JSON array/);
  });
});

describe('ClaudeProvider.generateQuestions', () => {
  it('returns validated questions on first successful response', async () => {
    let calls = 0;
    const fetchFn = async () => {
      calls += 1;
      return mockAnthropicResponse(JSON.stringify([VALID_QUESTION]));
    };

    const provider = new ClaudeProvider({ apiKey: 'test-key', fetchFn });
    const questions = await provider.generateQuestions(VALID_INPUT);

    assert.equal(calls, 1);
    assert.equal(questions.length, 1);
    assert.equal(questions[0].text, VALID_QUESTION.text);
    assert.equal(provider.lastCallMeta?.tokenUsage.total, 150);
  });

  it('retries once when first response has malformed JSON', async () => {
    let calls = 0;
    const bodies = [];
    const fetchFn = async (_url, init) => {
      calls += 1;
      bodies.push(JSON.parse(String(init?.body || '{}')));
      if (calls === 1) {
        return mockAnthropicResponse('not valid json');
      }
      return mockAnthropicResponse(JSON.stringify([VALID_QUESTION]));
    };

    const provider = new ClaudeProvider({ apiKey: 'test-key', fetchFn });
    const questions = await provider.generateQuestions(VALID_INPUT);

    assert.equal(calls, 2);
    assert.equal(questions.length, 1);
    assert.match(
      bodies[1].messages[0].content,
      /CORRECTION REQUIRED/,
    );
    assert.equal(provider.lastCallMeta?.tokenUsage.total, 300);
  });

  it('retries once when first response fails schema validation', async () => {
    let calls = 0;
    const fetchFn = async () => {
      calls += 1;
      if (calls === 1) {
        return mockAnthropicResponse(JSON.stringify([]));
      }
      return mockAnthropicResponse(JSON.stringify([VALID_QUESTION]));
    };

    const provider = new ClaudeProvider({ apiKey: 'test-key', fetchFn });
    const questions = await provider.generateQuestions(VALID_INPUT);

    assert.equal(calls, 2);
    assert.equal(questions.length, 1);
  });

  it('throws AIGenerationError after two malformed responses', async () => {
    let calls = 0;
    const fetchFn = async () => {
      calls += 1;
      return mockAnthropicResponse('still not json');
    };

    const provider = new ClaudeProvider({ apiKey: 'test-key', fetchFn });

    await assert.rejects(
      () => provider.generateQuestions(VALID_INPUT),
      (err) => {
        assert.ok(err instanceof AIGenerationError);
        assert.equal(err.code, 'AI_GENERATION_ERROR');
        assert.match(err.message, /after one retry/);
        return true;
      },
    );

    assert.equal(calls, 2);
  });

  it('does not retry Anthropic HTTP errors', async () => {
    let calls = 0;
    const fetchFn = async () => {
      calls += 1;
      return {
        ok: false,
        status: 500,
        text: async () => 'server error',
      };
    };

    const provider = new ClaudeProvider({ apiKey: 'test-key', fetchFn });

    await assert.rejects(
      () => provider.generateQuestions(VALID_INPUT),
      (err) => {
        assert.equal(err instanceof AIGenerationError, false);
        assert.match(String(err.message), /Anthropic API 500/);
        return true;
      },
    );

    assert.equal(calls, 1);
  });
});
