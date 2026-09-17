# Database Design

## Existing schema to reuse

Repository inspection shows PostgreSQL with incremental migrations (`backend/src/models/migrations/`) and centralized access in `backend/src/utils/db.js`. Reuse `users`, `user_roles`, `instructor_profiles`, `student_profiles`, `enrollments`, `teacher_schedules`, `lessons`, `enrollment_lessons`, `attendance`, `instructor_tasks`, `student_assignments`, `chat_rooms`, `chat_messages`, `notifications`, billing records, `access_events` and organization RBAC. Do not treat `schema.sql` as complete; migrations are authoritative.

## New tables (MVP)

### Taxonomy and goals

- `mentorship_categories(id, slug, parent_id, status, sort_order)`
- `mentorship_category_locales(category_id, locale, name, description)`
- `mentorship_goal_templates(id, category_id, slug, status)`
- `mentorship_goal_template_locales(goal_id, locale, label, prompts_json)`
- `mentorship_goal_intakes(id, user_id, category_id, goal_id, baseline_json, target_json, target_date, locale, timezone, budget_min, budget_max, availability_json, preferences_json, status)`

### Mentor and offer

- `mentor_profiles(id, user_id UNIQUE, headline, bio, professional_title, years_experience, timezone, location_json, languages_json, links_json, intro_video_url, verification_status, publication_status, response_time_minutes, created_at, updated_at)`
- `mentor_experiences(id, mentor_profile_id, organization, title, start_date, end_date, description, verification_status)`
- `mentor_credentials(id, mentor_profile_id, type, issuer, title, document_ref, url, verification_status, reviewed_by, reviewed_at)`
- `mentor_offers(id, mentor_profile_id, type, status, title, audience, outcome, duration_weeks, session_count, cadence_json, inclusions_json, price_amount, currency, trial_policy, cancellation_policy, timezone_policy, version, published_at)`
- `mentor_offer_categories(offer_id, category_id)`
- `mentorship_programs(id, owner_mentor_id, status, slug, title, description, outcome, duration_weeks, version, price_amount, currency)`
- `mentorship_program_weeks(id, program_id, week_number, title, objectives, session_template_json)`
- `mentorship_program_milestones(id, program_id, title, description, ordinal, completion_rule_json)`
- `mentorship_program_tasks(id, milestone_id, title, instructions, due_offset_days, rubric_json)`

### Delivery and commerce

- `mentorship_relationships(id, mentor_user_id, mentee_user_id, offer_id, program_id, offer_version, state, source, started_at, ended_at, timezone, goal_snapshot_json, policy_snapshot_json)`
- `mentorship_availability_rules(id, mentor_user_id, timezone, weekday, start_time, end_time, booking_window_days, buffer_minutes, status)`
- `mentorship_availability_exceptions(id, mentor_user_id, starts_at, ends_at, kind, reason)`
- `mentorship_sessions(id, relationship_id, starts_at, ends_at, timezone, provider, external_event_id, meeting_url, state, attendance_status, cancellation_reason, completed_at, notes_visibility)`
- `mentorship_goals(id, relationship_id, title, baseline, target, unit, due_date, state, progress_value, updated_by)`
- `mentorship_milestones(id, relationship_id, template_id, title, due_at, state, completed_at)`
- `mentorship_task_instances(id, relationship_id, program_task_id, title, due_at, state, submission_json, feedback_json, reviewed_at)`
- `mentorship_orders(id, buyer_user_id, seller_user_id, relationship_id, currency, subtotal, platform_fee, processing_fee, tax_amount, total, state, provider, provider_reference, idempotency_key UNIQUE)`
- `mentorship_order_items(id, order_id, offer_id, program_id, quantity, unit_amount, amount, offer_version_snapshot_json)`
- `mentorship_ledger_entries(id, order_id, entry_type, amount, currency, beneficiary_user_id, state, reference, created_at)`
- `mentorship_payout_accounts(id, mentor_user_id UNIQUE, provider, external_account_ref_encrypted, state, verified_at)`
- `mentorship_payouts(id, mentor_user_id, order_id, amount, currency, eligible_at, state, provider_reference, failure_reason)`

### Trust and analytics

- `mentorship_reviews(id, relationship_id, session_id, reviewer_id, reviewee_id, rating, body, state, mentor_response, created_at, UNIQUE(session_id, reviewer_id))`
- `mentorship_reports(id, reporter_id, target_type, target_id, reason, severity, state, assigned_to, resolution_json)`
- `mentorship_verification_cases(id, mentor_profile_id, status, submitted_at, reviewer_id, decision_reason, decided_at)`
- `mentorship_verification_items(id, case_id, type, value_json, document_ref, state, reviewer_note)`
- `mentorship_audit_events(id, actor_id, action, target_type, target_id, before_json, after_json, request_id, created_at)`
- `mentorship_events(id, actor_id, event_name, anonymous_subject_id, properties_json, occurred_at)`

## Constraints and indexes

Use UUIDs, foreign keys and soft-state rather than deletes for money/trust records. Index public queries on `(publication_status, verification_status)`, category joins, offer type/status, mentor timezone/availability, session start, relationship participants, payment state and event name/time. Enforce currency and amount precision with numeric types; never use floating point.

## Data retention/security

Credentials and identity documents must be encrypted at rest or stored through a restricted object store; normal APIs return only verification summaries. Define retention/deletion policies for reports, chat attachments, payment references and minors' data. [FOUNDER DECISION REQUIRED] Approve legal retention periods and data residency requirements.
