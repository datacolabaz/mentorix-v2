# Recommended Final Architecture — Mentorix Mentorship Marketplace

## A. Recommended product

A curated, verified, goal-first mentorship marketplace where a learner chooses an outcome, receives a small explainable set of mentor offers, books one-off guidance or an ongoing/structured program, and completes the work through sessions, chat, milestones, tasks and feedback.

Mentorix should position this as **outcome mentorship**, not generic tutoring. The existing platform becomes the execution advantage: Learn + Manage + Grow.

## B. What not to build

Do not initially build a generic tutor directory, native video stack, separate mentor accounts/app, automatic AI assignment, global payout network, all categories, complex cohort marketplace, unrestricted minors product, mentor social feed or an elaborate vector search system.

## C. MVP scope

- first-class public Mentorluq nav item;
- Career/Technology, AI & Data, University & Education, English/IELTS;
- 20–50 invite-only verified mentors;
- goal intake, deterministic recommendations and browse fallback;
- profile, versioned one-off/recurring offers;
- availability, booking, timezone, external meeting link;
- one provider adapter, configurable commission, ledger and controlled payouts;
- direct chat context, notifications, simple goals/milestones and completed-session reviews;
- admin verification, moderation, refunds, disputes and funnel/finance analytics;
- AZ/EN/RU resources with safe fallback for TR/DE.

## D. Target users

Existing Mentorix teachers and students; Azerbaijani university applicants; technology learners and career changers; verified professionals in Azerbaijan and abroad.

## E. Initial categories

Career & Technology; AI & Data; University & Education; English/IELTS. Expand only after supply and completion data support it.

## F. Business model

Transparent transaction commission, initially recommended 12–18% with founding-mentor relief and effective-dated configuration. Add program commission in MVP if payment/delivery are manageable. Defer mentor subscription, featured placement and B2B until liquidity is demonstrated.

[FOUNDER DECISION REQUIRED] Fee payer, merchant-of-record/tax model, provider and final rates.

## G–J. User journeys

**Mentee:** goal → baseline/target/schedule/budget → recommendations → choose offer → pay → schedule → session/task/milestone → review/renew.

**Mentor:** become mentor → profile/evidence → human verification → offer/availability → accept relationship → deliver sessions/feedback → complete outcome → payout/reputation.

**Admin:** review verification → moderate offers → monitor bookings/payments/safety → resolve refunds/disputes → release payouts → analyze category liquidity.

## K. Database architecture

Reuse users, multi-role assignments, profiles, enrollment/task/lesson primitives, chat, notifications, billing/provider settings, access events, admin audit and org RBAC. Add focused mentorship tables for categories/intakes, mentor profiles/evidence, offers/program versions, relationships, availability/sessions, goals/tasks, orders/ledger/payouts, reviews, verification cases, reports and events. See `07_MENTORSHIP_DATABASE_DESIGN.md`.

## L. API architecture

A bounded `/api/mentorship` route family with public discovery, authenticated mentee, mentor and admin namespaces. Services own policy; APIs use participant checks, pagination, idempotency, stable error codes and audit. See `08_MENTORSHIP_API_ARCHITECTURE.md`.

## M. Security model

One identity, capability/permission-based access, least privilege, verified documents in private storage, signed URLs, webhook authentication, rate limits, audit events, moderation and adult-only recommendation for MVP. Minors require founder-approved guardian/safeguarding design.

## N. Payment architecture

Provider adapter for Payriff or Epoint, immutable order/ledger, explicit commission/refund/payout states, payout reserve and reconciliation. Existing subscription billing is reused for patterns/configuration, not overloaded with marketplace facts.

## O. Matching architecture

Hard eligibility first, weighted explainable ranking second, diversity/fairness third. AI can normalize goals and explain matches, never invent evidence or override safety/price. Start with PostgreSQL search; add vectors only with evidence.

## P. Launch strategy

Invite founding mentors from existing teachers, alumni, tech communities and admissions networks. Concierge-match the first cohort. Use existing student network, university partnerships, SEO goal pages, referrals and free intro/diagnostic sessions selectively. Measure supply activation and completed outcomes before expanding.

## Q. Risks

Cold-start liquidity; mentor quality variance; local payment/payout/legal limitations; minor safety; off-platform leakage; schedule conflicts; false credentials; refunds/no-shows; poor outcome definition; localization gaps; overloaded existing role model.

## R. Open questions

- Adult-only MVP?
- Which legal entity/merchant model?
- Payriff or Epoint first?
- Who handles mentor tax/KYC/payouts?
- What outcomes can Mentorix verify without overclaiming?
- Does recurring billing ship in MVP?
- Refund/no-show windows?
- Required launch supply/demand and financial thresholds?
- Dedicated operator/support capacity?

## S. ADRs requiring founder approval

Adult/minor scope, launch categories, provider, commission and fee payer, payout/KYC, recurring billing, refunds, certification claims, KPI gates and acquisition budget. See `17_MENTORSHIP_ADRS.md`.

## Final recommendation

Approve discovery and design for the curated adult MVP, not implementation of the full marketplace. The next artifact should be a clickable UX prototype and operational policy pack, followed by a thin vertical slice: one category, verified mentors, one-off booking, payment, session completion, review and admin reconciliation. Only after that slice produces real completion and repeat data should Mentorix expand to programs, recurring billing and AI-assisted matching.
