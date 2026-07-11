const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  getGenerationRateLimitPerHour,
  DEFAULT_LIMIT_PER_HOUR,
} = require('../services/generationRateLimitService');
const {
  createGenerationRateLimit,
  resolveCorrelationId,
} = require('../middleware/generationRateLimit');

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('getGenerationRateLimitPerHour', () => {
  it('defaults to 20 when env unset', () => {
    const prev = process.env.GENERATION_RATE_LIMIT_PER_HOUR;
    delete process.env.GENERATION_RATE_LIMIT_PER_HOUR;
    assert.equal(getGenerationRateLimitPerHour(), DEFAULT_LIMIT_PER_HOUR);
    if (prev !== undefined) process.env.GENERATION_RATE_LIMIT_PER_HOUR = prev;
  });

  it('reads positive integer from env', () => {
    const prev = process.env.GENERATION_RATE_LIMIT_PER_HOUR;
    process.env.GENERATION_RATE_LIMIT_PER_HOUR = '15';
    assert.equal(getGenerationRateLimitPerHour(), 15);
    if (prev !== undefined) process.env.GENERATION_RATE_LIMIT_PER_HOUR = prev;
    else delete process.env.GENERATION_RATE_LIMIT_PER_HOUR;
  });
});

describe('generationRateLimit middleware', () => {
  it('blocks when count reaches limit with standard error envelope', async () => {
    const limit = 20;
    const middleware = createGenerationRateLimit({
      limitFn: () => limit,
      countFn: async () => limit,
    });
    const req = { user: { id: 'teacher-1' }, headers: {} };
    const res = mockRes();
    let nextCalled = false;

    await middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 429);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'RATE_LIMIT_EXCEEDED');
    assert.ok(res.body.error.message);
    assert.ok(res.body.error.correlationId);
  });

  it('allows request when under limit', async () => {
    const middleware = createGenerationRateLimit({
      limitFn: () => 20,
      countFn: async () => 19,
    });
    const req = { user: { id: 'teacher-1' }, headers: {} };
    const res = mockRes();
    let nextCalled = false;

    await middleware(req, res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(res.body, null);
  });

  it('allows again after window count drops (simulated reset)', async () => {
    let count = 20;
    const middleware = createGenerationRateLimit({
      limitFn: () => 20,
      countFn: async () => count,
    });
    const req = { user: { id: 'teacher-1' }, headers: {} };

    const blocked = mockRes();
    await middleware(req, blocked, () => {});
    assert.equal(blocked.statusCode, 429);

    count = 0;
    const allowed = mockRes();
    let nextCalled = false;
    await middleware(req, allowed, () => {
      nextCalled = true;
    });
    assert.equal(nextCalled, true);
  });

  it('reuses incoming correlation header', () => {
    const req = { headers: { 'x-correlation-id': 'corr-abc' } };
    assert.equal(resolveCorrelationId(req), 'corr-abc');
  });
});
