# Role and Identity Model

## Principle

Do not create a second account for a mentor. Mentorix already has `users`, `user_roles` (`backend/src/models/migrations/081_user_roles.sql`) and persona/authorization separation (`backend/src/config/personas.js`). Mentorship should extend this model.

## Recommended concepts

- **Identity:** one `users` row, credentials, email/phone, locale and account status.
- **Authorization role:** permission-bearing role such as `admin`, `instructor`, `student`, `parent`, `course`.
- **Product capability:** `mentor`, `mentee`, `mentor_admin`, `mentor_moderator`; stored in a capability/role assignment table rather than overloading `users.role`.
- **Persona:** current use context; a teacher can be a mentor and a student can later become a mentor.
- **Relationship role:** `mentor` or `mentee` inside a specific mentorship relationship.

## Proposed tables

`user_roles` remains the source for global active roles. Add either a `mentorship_user_roles` table or extend `user_roles` with a namespaced role/capability and metadata. Recommended namespaced values:

- `mentorship_mentor`
- `mentorship_mentee`
- `mentorship_moderator`
- `mentorship_finance_admin`

Use scoped organization roles for sponsored programs through existing `org_memberships`, `org_roles` and permissions.

## Permission examples

- `mentorship.discover.read`: public/authenticated discovery.
- `mentorship.relationship.read`: participant or authorized guardian.
- `mentorship.relationship.manage`: assigned mentor, mentee, support admin.
- `mentorship.offer.create`: verified mentor with marketplace onboarding complete.
- `mentorship.offer.publish`: verified mentor plus category policy.
- `mentorship.verification.review`: admin/moderator only.
- `mentorship.payment.refund`: finance/admin under policy.
- `mentorship.payout.view`: mentor own data, finance/admin.
- `mentorship.safety.resolve`: trust/safety admin.

## Multi-role behavior

- Authentication continues to produce one `req.user`; authorization middleware should support permission checks, not only one `role` string.
- Frontend should expose a workspace/context switcher where the user has multiple capabilities.
- Never infer mentorship access from `users.role === 'instructor'`; an instructor may be a mentor, but not every instructor has a published offer.
- A user may be mentor and mentee simultaneously.

## Minors and guardians

A minor mentee may have a parent/guardian relationship through existing `student_profiles.parent_id`. [FOUNDER DECISION REQUIRED] Decide whether minors can transact directly, whether guardian approval is mandatory, and whether mentor messaging is constrained to platform-only channels.

## Migration strategy

Reuse existing identities and add capability rows. Backfill no mentor role automatically. Existing instructors receive an invitation/CTA and must submit verification before being listed. This preserves least privilege and avoids accidental marketplace publication.
