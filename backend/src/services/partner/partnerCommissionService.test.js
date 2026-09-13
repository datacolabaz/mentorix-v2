const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { discountForfeitedByPlanHistory } = require('./partnerCommissionService');

describe('discountForfeitedByPlanHistory', () => {
  it('allows first paid checkout (no history)', () => {
    assert.equal(discountForfeitedByPlanHistory([], 'pro'), false);
  });

  it('allows renewals on original package', () => {
    assert.equal(discountForfeitedByPlanHistory(['pro'], 'pro'), false);
    assert.equal(discountForfeitedByPlanHistory(['pro', 'pro'], 'pro'), false);
  });

  it('forfeits on upgrade checkout', () => {
    assert.equal(discountForfeitedByPlanHistory(['pro'], 'growth'), true);
  });

  it('forfeits permanently after leaving original package', () => {
    assert.equal(discountForfeitedByPlanHistory(['pro', 'growth'], 'pro'), true);
    assert.equal(discountForfeitedByPlanHistory(['pro', 'growth'], null), true);
  });
});
