# Technical Architecture

## Existing platform baseline

Mentorix is a React/Vite frontend with React Router, Tailwind, React Query, i18next, Zustand and shared UI; backend is Node/Express/PostgreSQL with JWT auth, service/controller layers, migrations, cron workers, Payriff billing, notifications, chat, LiveKit and admin routes. The architecture is suitable for an additive bounded module.

## REUSE

- `users`, `user_roles`, profiles and auth middleware;
- React Query/API client and role layouts;
- existing instructor/student/org/admin shells;
- `teacher_schedules`, lessons and live provider abstraction;
- direct chat/SSE and notification queue;
- billing/provider configuration, Payriff service patterns and admin finance;
- access events, analytics, audit and localization.

## EXTEND

- permission checks beyond single `req.user.role`;
- schedule/lesson models with session/provider metadata;
- direct chat rooms with mentorship context;
- notification event templates and analytics namespace;
- public nav `LINKS` and translation resources;
- instructor layout with mentor workspace context.

## NEW

Create a `mentorship` backend module with routes, controllers, services, policy/config, repositories/query functions, provider adapters and workers. New domain tables are listed in `07`. Add frontend feature modules under `pages/mentorship`, `components/mentorship`, hooks and locale namespaces. Add a search projection only when query complexity warrants it.

## Service boundaries

- `mentorshipDiscoveryService`
- `mentorshipMatchingService`
- `mentorshipOfferService`
- `mentorshipVerificationService`
- `mentorshipBookingService`
- `mentorshipProgressService`
- `mentorshipReviewService`
- `mentorshipSafetyService`
- `mentorshipCommerceService`
- `mentorshipPayoutService`
- `mentorshipAnalyticsService`

Each service owns invariants; controllers translate HTTP. Payment/webhook and scheduled jobs must be idempotent.

## Search

Start with PostgreSQL category/tag/full-text indexes and availability filters. Maintain a denormalized public offer projection if joins become slow. Add vector retrieval later behind a feature flag; deterministic eligibility always remains authoritative.

## Scheduling/integrations

Use internal availability rules and session rows as source of truth. Google Calendar/Meet/Zoom are adapters that create external events/meeting links. Do not build video infrastructure. Store provider reference, not access tokens in domain rows; use existing provider connection encryption patterns.

## Notifications

Emit domain events to existing notification queue: request received, accepted, reminder, reschedule, cancellation, payment failure, task feedback, milestone due, review eligible and safety case. Email/SMS/in-app delivery remains provider-specific.

## Security

JWT authentication, permission-based authorization, participant checks, signed private attachment URLs, encryption for verification/payout data, rate limits, idempotency, audit log, webhook signature checks and safe error codes. Apply data minimization for minors and reports.

## Deployment/operations

Ship behind feature flags and category/mentor allowlists. Run migrations forward-only. Add health checks for payment webhooks, notification jobs, payout reconciliation and session reminders. Monitor error rate, queue lag, booking conflicts, payment discrepancies and safety SLA.

## Deprecate/avoid

Do not duplicate chat, notifications, auth, calendar/video, billing configuration or user identities. Do not add a standalone mentor app until the shared workspace proves it is necessary.
