const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  applyDiscountCents,
  computeCommissionCents,
  splitPaymentCents,
  isWithinDurationMonths,
  resolveDurationMonths,
  clampPct,
} = require('./partnerMath');

describe('partnerMath — money in qəpik', () => {
  it('Standard 5 AZN → 4.50 / 0.90 / 3.60 with 10% discount + 20% commission', () => {
    const s = splitPaymentCents(500, 10, 20);
    assert.equal(s.user_pays_cents, 450);
    assert.equal(s.commission_cents, 90);
    assert.equal(s.mentorix_cents, 360);
  });

  it('Professional 10 AZN → 9.00 / 1.80 / 7.20', () => {
    const s = splitPaymentCents(1000, 10, 20);
    assert.equal(s.user_pays_cents, 900);
    assert.equal(s.commission_cents, 180);
    assert.equal(s.mentorix_cents, 720);
  });

  it('Premium 19 AZN → 17.10 / 3.42 / 13.68', () => {
    const s = splitPaymentCents(1900, 10, 20);
    assert.equal(s.user_pays_cents, 1710);
    assert.equal(s.commission_cents, 342);
    assert.equal(s.mentorix_cents, 1368);
  });

  it('floors commission (no float drift)', () => {
    // 333 * 10% = 33.3 → floor 33 discount; net 300; 20% of 300 = 60
    const d = applyDiscountCents(333, 10);
    assert.equal(d.discount_cents, 33);
    assert.equal(d.net_cents, 300);
    assert.equal(computeCommissionCents(d.net_cents, 20), 60);
  });

  it('clamps percent', () => {
    assert.equal(clampPct(-5), 0);
    assert.equal(clampPct(150), 100);
  });

  it('duration window: first 3 periods only; 0 = unlimited', () => {
    assert.equal(isWithinDurationMonths(1, 3), true);
    assert.equal(isWithinDurationMonths(3, 3), true);
    assert.equal(isWithinDurationMonths(4, 3), false);
    assert.equal(isWithinDurationMonths(1, 0), true);
    assert.equal(isWithinDurationMonths(99, 0), true);
    assert.equal(isWithinDurationMonths(1, null), false);
  });

  it('resolveDurationMonths treats 0 as valid unlimited', () => {
    assert.equal(resolveDurationMonths(0, 3), 0);
    assert.equal(resolveDurationMonths(null, 0), 0);
    assert.equal(resolveDurationMonths(undefined, 3), 3);
    assert.equal(resolveDurationMonths(5, 0), 5);
  });
});
