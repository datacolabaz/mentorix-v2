# Domain Model

## Bounded contexts

1. **Discovery:** goals, taxonomy, search, recommendations.
2. **Trust:** mentor verification, credentials, moderation, reports.
3. **Commerce:** offers, orders, subscriptions, invoices, refunds, commissions and payouts.
4. **Delivery:** relationships, sessions, availability, tasks, milestones and messages.
5. **Outcome:** reviews, progress, completion and evidence.
6. **Platform operations:** admin policy, audit, analytics and notifications.

## Core aggregates

### MentorProfile
One per eligible identity. Contains headline, bio, languages, timezone, location, background, links, media, verification summary, safety settings and publication state.

### MentorOffer
Owned by a mentor and versioned. Has offer type (`ONE_OFF`, `RECURRING`, `PROGRAM`), goal/category tags, audience, duration, cadence, deliverables, price, currency, cancellation rules and expected outcome.

### MentorshipProgram
A versioned curriculum: weeks, milestones, sessions, assignments, resources, completion criteria and optional certificate. A program may be public and reused by many enrollments; enrollment pins a version.

### MentorshipRelationship
A contract between one mentor and one mentee (or a sponsored cohort later). Records accepted offer/version, start/end, state, goals, cadence, communication rules and matching provenance.

### Session
A bookable delivery occurrence linked to a relationship/order. Contains slot, timezone, provider, meeting reference, status, attendance, cancellation/no-show reason and completion notes.

### Goal/Milestone
A measurable desired outcome and checkpoints. Mentee and mentor can update progress; changes are audited.

### Order/Payment/Payout
Commerce records are immutable financial facts. Use an order with line items and ledger entries; never derive mentor earnings from mutable profile prices.

### Review
Only generated from eligible completed delivery. One reviewer per completed session/program milestone under policy; moderation state and mentor response are separate.

## Relationship summary

`User 1—1 MentorProfile`; `MentorProfile 1—N MentorOffer`; `MentorOffer 0—1 Program`; `Mentee User 1—N Relationship`; `Relationship 1—N Session`; `Relationship 1—N Goal/Milestone`; `Relationship 1—N Task`; `Order 1—1 relationship/order item`; `Completed Session 0—1 Review`.

## State machines

- Verification: `PENDING → UNDER_REVIEW → VERIFIED | REJECTED`; `VERIFIED → SUSPENDED → VERIFIED` only by admin decision.
- Offer: `DRAFT → PENDING_REVIEW → PUBLISHED → PAUSED → ARCHIVED`.
- Relationship: `REQUESTED → ACCEPTED → ACTIVE → PAUSED | COMPLETED | CANCELLED | DISPUTED`.
- Session: `HELD → CONFIRMED → COMPLETED | CANCELLED | NO_SHOW | DISPUTED`.
- Payment: `REQUIRES_ACTION → AUTHORIZED → CAPTURED → REFUNDED | PARTIALLY_REFUNDED | FAILED`.
- Payout: `PENDING → ELIGIBLE → PROCESSING → PAID | FAILED | HELD`.

All transitions require actor, timestamp, reason and idempotency key where money or scheduling is involved.
