# API Architecture

## Boundary

Add a bounded route family under `/api/mentorship`. Keep controllers thin and place rules in services. Reuse `authenticate`, permission middleware, `frontend/src/lib/api.js`, React Query and existing notification/chat/billing services.

## Public/read APIs

- `GET /api/mentorship/categories?locale=az`
- `GET /api/mentorship/goals`
- `POST /api/mentorship/intakes` — authenticated; creates/replaces a goal intake.
- `POST /api/mentorship/matches` — authenticated; returns ranked offers and explanations.
- `GET /api/mentorship/offers` — filters category, goal, language, price, format, availability.
- `GET /api/mentorship/offers/:id`
- `GET /api/mentorship/mentors/:id`
- `GET /api/mentorship/programs/:slug`

Public responses must exclude private contact data, documents, internal scores and payout information.

## Mentee APIs

- `GET /api/mentorship/me/overview`
- `POST /api/mentorship/offers/:id/requests`
- `POST /api/mentorship/relationships/:id/accept` or mentor-side accept endpoint
- `GET /api/mentorship/relationships/:id`
- `POST /api/mentorship/relationships/:id/sessions`
- `PATCH /api/mentorship/sessions/:id/reschedule`
- `POST /api/mentorship/sessions/:id/cancel`
- `POST /api/mentorship/sessions/:id/attendance`
- `GET/POST /api/mentorship/relationships/:id/goals`
- `GET/PATCH /api/mentorship/tasks/:id`
- `POST /api/mentorship/sessions/:id/review`
- `GET /api/mentorship/me/orders`

## Mentor APIs

- `GET/PATCH /api/mentorship/me/profile`
- `POST /api/mentorship/me/verification`
- `GET/POST/PATCH /api/mentorship/me/offers`
- `POST /api/mentorship/me/offers/:id/publish`
- `GET/POST/PATCH /api/mentorship/me/programs`
- `GET/PATCH /api/mentorship/me/availability`
- `GET /api/mentorship/me/mentees`
- `PATCH /api/mentorship/sessions/:id/complete`
- `POST /api/mentorship/tasks/:id/feedback`
- `GET /api/mentorship/me/earnings`
- `GET/PATCH /api/mentorship/me/payout-account`

## Admin APIs

Use `/api/admin/mentorship/*` with explicit permissions:

- verification queue/decision;
- mentor/offer publication overrides;
- categories and goal templates;
- booking/dispute/refund/payout operations;
- review moderation and safety reports;
- configurable commission/policy settings;
- dashboards and exports.

## API rules

- All mutating payment/booking endpoints require idempotency keys.
- Use optimistic concurrency/version fields for offers, availability and relationships.
- Enforce participant authorization in services, not only route middleware.
- Return stable error codes: `OFFER_UNAVAILABLE`, `SLOT_CONFLICT`, `PAYMENT_REQUIRED`, `VERIFICATION_REQUIRED`, `NOT_ELIGIBLE_TO_REVIEW`, `SAFETY_REVIEW_REQUIRED`.
- Persist audit events for verification, refunds, payout holds, state changes and admin overrides.
- Use cursor pagination for offers, messages, sessions and admin queues.
- Webhooks are provider-authenticated, idempotent and append-only before state projection.

## API-to-existing integration

- Notifications: call existing `notificationQueueService` and `notifications`.
- Messages: create/use direct `chat_rooms` with mentorship relationship metadata.
- Calendar/live: use existing schedule/live provider services; do not expose provider credentials to clients.
- Billing: introduce a marketplace payment adapter beside existing subscription checkout, not inside generic controllers.
