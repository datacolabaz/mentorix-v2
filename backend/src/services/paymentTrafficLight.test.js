const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { classifyPaymentTrafficLight, attachPaymentTrafficLights } = require('./paymentTrafficLight');

describe('classifyPaymentTrafficLight', () => {
  it('marks students without debt as paid', () => {
    const r = classifyPaymentTrafficLight({
      pendingDebt: 0,
      todayYmd: '2026-09-08',
    });
    assert.equal(r.status, 'paid');
    assert.equal(r.amount, 0);
  });

  it('treats unpaid current period as due soon when the date is today', () => {
    const r = classifyPaymentTrafficLight({
      pendingDebt: 80,
      monthlyFee: 80,
      todayYmd: '2026-09-08',
      dueYmd: '2026-09-08',
    });
    assert.equal(r.status, 'due_soon');
    assert.equal(r.amount, 80);
  });

  it('marks past due dates as overdue', () => {
    const r = classifyPaymentTrafficLight({
      pendingDebt: 80,
      monthlyFee: 80,
      todayYmd: '2026-09-08',
      dueYmd: '2026-09-01',
    });
    assert.equal(r.status, 'overdue');
  });

  it('marks multi-period unpaid balances as overdue even without a due date', () => {
    const r = classifyPaymentTrafficLight({
      pendingDebt: 160,
      monthlyFee: 80,
      todayYmd: '2026-09-08',
    });
    assert.equal(r.status, 'overdue');
    assert.equal(r.amount, 160);
  });

  it('uses unpaid pack amount and overdue flag', () => {
    const soon = classifyPaymentTrafficLight({
      unpaidPackAmount: 120,
      todayYmd: '2026-09-08',
      dueYmd: '2026-09-10',
    });
    assert.equal(soon.status, 'due_soon');
    assert.equal(soon.amount, 120);

    const late = classifyPaymentTrafficLight({
      unpaidPackAmount: 120,
      todayYmd: '2026-09-08',
      dueYmd: '2026-09-01',
      packOverdue: true,
    });
    assert.equal(late.status, 'overdue');
  });
});

describe('attachPaymentTrafficLights', () => {
  it('summarizes board rows into paid / due soon / overdue buckets', () => {
    const { students, status_summary } = attachPaymentTrafficLights(
      [
        { enrollment_id: 'a', pending_debt: 0, monthly_fee: 50 },
        { enrollment_id: 'b', pending_debt: 50, monthly_fee: 50 },
        { enrollment_id: 'c', pending_debt: 0, monthly_fee: 90 },
      ],
      {
        todayYmd: '2026-09-08',
        dueConfirmations: [{ enrollment_id: 'b', due_ymd: '2026-09-08', overdue: false, amount: 50 }],
        packConfirmations: [
          { enrollment_id: 'c', due_ymd: '2026-08-20', overdue: true, amount: 90 },
        ],
      }
    );
    assert.equal(students[0].status_light, 'paid');
    assert.equal(students[1].status_light, 'due_soon');
    assert.equal(students[2].status_light, 'overdue');
    assert.equal(status_summary.paid.count, 1);
    assert.equal(status_summary.due_soon.count, 1);
    assert.equal(status_summary.due_soon.amount, 50);
    assert.equal(status_summary.overdue.count, 1);
    assert.equal(status_summary.overdue.amount, 90);
  });
});
