# Information Architecture

## Public navigation

Top-level public navigation must remain:

- Müəllimlər üçün
- Mentorluq
- İmtahanlar
- Partner ol
- AZ / language selector
- Daxil ol
- Pulsuz başla

`Mentorluq` and `İmtahanlar` are first-class siblings, never nested under `Müəllimlər üçün`. Reuse `frontend/src/components/public/PublicMarketingNav.jsx`, `LINKS`, responsive menu and existing i18next keys. Add equivalent keys to AZ/EN/RU and maintain TR/DE fallback until dedicated resources exist.

## Public mentorship IA

- `/mentorship` — marketplace landing: goals, trust, categories, how it works, featured offers.
- `/mentorship/goals` — goal-first onboarding.
- `/mentorship/matches` — recommended mentors/offers with explanation.
- `/mentorship/mentors` — browse/search fallback.
- `/mentorship/mentors/:id` — public mentor profile.
- `/mentorship/offers/:id` — offer detail and package comparison.
- `/mentorship/programs/:slug` — public structured program page.
- `/mentorship/book/:offerId` — booking/payment entry.
- `/mentorship/safety` — trust, minors, refund and conduct policies.

## Authenticated mentee IA

- `/student/mentorship` — overview.
- `/student/mentorship/discover` — goals and recommendations.
- `/student/mentorship/relationships/:id` — active relationship.
- `/student/mentorship/sessions` — sessions/calendar.
- `/student/mentorship/tasks` — assignments and feedback.
- `/student/mentorship/messages` — reuse direct chat context.
- `/student/mentorship/payments` — purchases, invoices, refunds.
- `/student/mentorship/reviews` — eligible reviews.

## Authenticated mentor IA

- `/instructor/mentorship` — mentor dashboard for existing instructors; a separate role workspace can come later.
- `/instructor/mentorship/profile` — mentor identity, expertise and verification.
- `/instructor/mentorship/offers` — one-off, recurring and programs.
- `/instructor/mentorship/availability` — schedule rules and exceptions.
- `/instructor/mentorship/mentees` — active relationships.
- `/instructor/mentorship/sessions` — calendar and status.
- `/instructor/mentorship/tasks` — feedback queue.
- `/instructor/mentorship/earnings` — balance, payouts and reports.

## Admin IA

- `/admin/mentorship/overview`
- `/admin/mentorship/verification`
- `/admin/mentorship/mentors`
- `/admin/mentorship/offers`
- `/admin/mentorship/bookings`
- `/admin/mentorship/disputes`
- `/admin/mentorship/payouts`
- `/admin/mentorship/reviews`
- `/admin/mentorship/categories`
- `/admin/mentorship/analytics`

## Navigation principles

- Goal context must persist from onboarding through search, booking and dashboard.
- A user can switch active persona/role without creating another account.
- “Mentor” is a capability and relationship role, not a replacement for `instructor`.
- Every commercial surface shows price, currency, duration, deliverables, cancellation terms and expected outcome before checkout.
