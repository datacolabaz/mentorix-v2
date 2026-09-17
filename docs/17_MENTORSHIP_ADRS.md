# Architecture Decision Records

## ADR-001 — Mentorship is a bounded marketplace module
**Status:** Proposed. **Decision:** Add `/api/mentorship` and feature modules without rewriting existing domains. **Why:** reduces regression risk and allows staged launch. **Consequence:** integration adapters are required.

## ADR-002 — One identity, multiple capabilities
**Status:** Proposed. **Decision:** Reuse `users` and `user_roles`; add namespaced mentorship capability/permission records. **Why:** teachers, students and mentors can overlap. **Consequence:** authorization must move beyond one global role string.

## ADR-003 — Offer, not profile, is the transaction object
**Status:** Proposed. **Decision:** A mentor profile can publish versioned one-off, recurring and program offers. **Why:** pricing, deliverables and outcomes vary. **Consequence:** order snapshots offer version.

## ADR-004 — Goal-first discovery with browse fallback
**Status:** Proposed. **Decision:** intake and recommendations are primary; verified browsing remains available. **Why:** differentiates from directories while preserving user agency.

## ADR-005 — Deterministic eligibility before AI
**Status:** Proposed. **Decision:** safety, verification, language, format, budget and availability filters run before scoring; AI only enriches/recommends/explains. **Why:** explainability and safety.

## ADR-006 — Existing communication and scheduling are extended
**Status:** Proposed. **Decision:** reuse chat, notifications and schedule/lesson infrastructure; use external meeting providers. **Why:** avoids duplicate operational systems.

## ADR-007 — Immutable marketplace ledger
**Status:** Proposed. **Decision:** orders, line items, ledger entries, refunds and payouts are append-oriented and separately reconciled. **Why:** commission/refund/payout correctness.

## ADR-008 — Curated 18+ MVP
**Status:** **Founder approval required.** Recommendation: launch invite-only with adults only. **Why:** minors materially increase safeguarding/consent risk.

## ADR-009 — Provider abstraction
**Status:** **Founder approval required.** Recommendation: implement one Azerbaijan provider first (Payriff or Epoint) behind an adapter. **Why:** avoid credential/provider coupling.

## ADR-010 — No vector database at launch
**Status:** Proposed. **Decision:** PostgreSQL taxonomy/full-text plus weighted rules first. **Why:** catalog size and explainability do not justify additional infrastructure initially.

## ADR-011 — Commission is configuration, not code
**Status:** **Founder approval required.** The platform fee, minimum, tier and promo policy are effective-dated and snapshotted per order. **Why:** money, campaigns and refunds change.

## ADR-012 — Mentorship navigation is top-level
**Status:** Proposed. Public nav has `Müəllimlər üçün`, `Mentorluq`, `İmtahanlar`, `Partner ol`, language, login and free-start. Reuse `PublicMarketingNav` and localization.

## ADR-013 — Programs are versioned
**Status:** Proposed. Active enrollments pin a curriculum version. **Why:** editing a public program must not alter a paid learner's contract.

## ADR-014 — Human review for trust-critical actions
**Status:** Proposed. Mentor verification, severe safety reports, refunds and payout holds have human/admin paths and audit records. **Why:** automation errors have high cost.

## Founder approval checklist

- adult-only vs minors;
- launch categories and first mentor cohort;
- fee rate, fee payer, tax/merchant-of-record model;
- Payriff vs Epoint first adapter;
- refund/cancellation/no-show policy;
- whether recurring billing is in MVP;
- payout country/KYC capability;
- outcome/certification claims and legal wording;
- launch KPI thresholds and budget.
