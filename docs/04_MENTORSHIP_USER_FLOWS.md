# User Flows

## Mentee goal-first flow

1. Open Mentorluq.
2. Choose goal: improve language, university preparation, learn technology, become data analyst, career change, interview, AI, business or custom goal.
3. State baseline/current level.
4. State target outcome and target date.
5. Choose language, timezone, online/offline preference, weekly availability, budget and mentor preferences.
6. Receive 3–5 recommendations with reasons, confidence and alternatives.
7. Compare profile, verification, offer scope, availability, reviews and outcomes.
8. Ask a pre-booking question or request a fit call.
9. Book one-off / subscribe / enroll in program.
10. Pay through the provider adapter.
11. Confirm timezone and calendar event.
12. Complete session; mentor marks status and adds notes/action items.
13. Mentee completes task, milestone and review when eligible.

The mentee can always skip matching and browse verified offers.

## One-off session flow

Offer includes fixed topic, duration, price and deliverable. Booking creates a pending reservation; payment authorization/capture is confirmed before the slot is held permanently. Completion requires mentor/mentee status or an admin timeout policy. Review is eligible only after valid completion.

## Ongoing mentorship flow

1. Mentee chooses recurring offer.
2. System creates a relationship and billing schedule after successful first payment.
3. Mentor accepts or auto-accepts according to offer policy.
4. Sessions are booked against availability; chat and task workspace opens.
5. Monthly progress checkpoint records goals, completed sessions, tasks, risk and next plan.
6. Pause, cancel, refund and mentor replacement follow explicit policy.

## Structured program flow

Program has versioned curriculum, weeks, milestones, assignments, session templates and completion criteria. Enrollment pins the program version so later edits do not change an active learner's contract. Completion creates an outcome record and optional certificate/assessment path.

## Mentor onboarding flow

1. Existing user selects “Become a mentor”.
2. Complete public profile and expertise taxonomy.
3. Submit identity, experience, education/certificates, LinkedIn/portfolio and safeguarding declarations.
4. Verification status becomes `PENDING` / `UNDER_REVIEW`.
5. Admin approves, requests changes or rejects with reason.
6. Mentor creates draft offer(s), availability and payout profile.
7. Admin/category rules validate offer.
8. Publish only when profile, verification and payout readiness pass.

## Admin flow

Admin reviews verification evidence, approves or requests changes, monitors booking/dispute/payout queues, moderates reviews, configures commission and category taxonomy, and audits sensitive actions.

## Exception flows

- No match: show closest alternatives and collect a waitlist signal.
- Mentor unavailable: offer reschedule, replacement or refund.
- No-show: collect evidence, apply policy, prevent automatic review until resolved.
- Minor: require guardian consent and restricted communication policy.
- Payment failure: relationship remains `PAYMENT_PAST_DUE`; access is limited according to grace policy.
- Safety report: freeze communication/payout if risk threshold is met and route to admin.
