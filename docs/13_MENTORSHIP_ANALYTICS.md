# Analytics and Measurement

## North-star

Completed outcome-bearing mentorship engagements per active mentee per quarter.

## Funnel events

Track versioned events through the existing analytics/access-event patterns, with actor and anonymous subject separation:

- `mentorship_nav_view`
- `goal_intake_started/completed`
- `match_impression/click/save/request`
- `mentor_profile_view`
- `offer_view`
- `booking_started/created/paid/failed`
- `session_confirmed/rescheduled/cancelled/completed/no_show`
- `relationship_started/paused/completed`
- `goal_created/progressed/completed`
- `task_submitted/feedback_given`
- `review_eligible/submitted/reported`
- `refund_requested/completed`
- `payout_eligible/paid/failed`
- `verification_submitted/approved/rejected/suspended`

## KPI definitions

### Supply

- active mentors: verified and published with availability or active offer;
- activation rate: approved mentors with first published offer within 14 days;
- time to verification;
- offer publish rate;
- mentor utilization and response SLA.

### Demand

- active mentees;
- goal intake completion;
- search/match sessions;
- profile and offer conversion;
- paid bookings;
- repeat booking and recurring renewal.

### Marketplace health

- search → profile conversion;
- profile → request/booking conversion;
- booking → completion rate;
- schedule conflict/reschedule/no-show rate;
- program milestone completion;
- mentor/mentee retention;
- eligible review rate and rating distribution;
- median time to first response.

### Finance

- GMV (captured order subtotal);
- platform revenue (commission less refunds/credits);
- average order value;
- mentor earnings and payout latency;
- refund/chargeback rate;
- take rate;
- contribution margin after provider/support costs.

## Cohorts and dimensions

Analyze by category, offer type, country, UI/session language, currency, acquisition source, mentor cohort, mentee age policy, price band and first-time vs repeat. Avoid exposing sensitive attributes in mentor rankings or public analytics.

## Instrumentation architecture

Reuse `frontend/src/lib/analytics.js`, backend `access_events` and admin analytics services, but add a mentorship event namespace and schema version. Event ingestion must be idempotent and not block checkout/session APIs. Build daily projections for dashboards; financial reports derive from ledger/order facts, not client events.

## Experiments

Safe tests: onboarding question order, match explanation, category landing copy and offer card layout. Do not experiment on safety eligibility, hidden prices, refund rights or verification standards without approval.

## Data quality

Maintain event contracts, required properties, source, actor type, privacy class, retention and owner. Reconcile bookings, captured payments, completed sessions and payouts daily.
