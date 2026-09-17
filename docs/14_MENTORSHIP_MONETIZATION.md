# Monetization

## Revenue models evaluated

| Model | Revenue potential | Complexity | Trust/liquidity impact | Recommendation |
|---|---:|---:|---|---|
| Transaction commission | High and aligned with value | Medium/high: refunds, payouts, reconciliation | Good if transparent; lowers mentor net | Primary MVP model |
| Mentor Pro subscription | Medium recurring | Medium | Can tax supply before demand exists | Phase 3, only for real tooling value |
| Featured placement | Low/medium | Medium, ranking conflict | Risky if it looks like pay-to-win | Sponsored label and limited phase 3 |
| Program commission | High AOV | Medium | Strong if outcomes and refund rules are clear | MVP for selected programs |
| Corporate/B2B programs | High contract value | High sales/permissions/reporting | Adds stable demand and cohorts | Phase 3 pilot |
| Affiliate/referral | Medium incremental | Medium | Can create attribution/fraud issues | Use carefully, phase 2 |
| Certification/assessment add-ons | Medium | Medium | Fits existing exams/certificates | Phase 2/3 attachment |

## Recommended model

Start with transparent commission on completed/captured marketplace transactions. Do not charge mentors to list, and do not make mentees subscribe merely to contact a mentor. Founding mentors receive a temporary lower rate or capped fee to seed supply.

Example: a 50 AZN offer, 15% platform commission, 42.50 AZN mentor gross before provider/tax deductions. Always show buyer total, platform fee policy, provider fee treatment, refund treatment and mentor net estimate.

## Configurable commission policy

Store effective-dated policies with category, offer type, mentor tier, campaign, referral source and currency conditions. Each order snapshots the policy. Never use a single environment variable as the source of historical truth.

Potential tiers:

- founding verified mentor;
- standard verified mentor;
- high-performing mentor after minimum completed sessions and quality thresholds;
- sponsored/organization contract.

Tier must never be based only on paid promotion; preserve quality/safety gates.

## Unit economics guardrails

Before expansion, measure contribution margin per completed relationship:

`platform commission - payment fees - refunds/chargebacks - support cost - payout cost - acquisition cost`.

One-off sessions can be uneconomic at very low price points; use minimum fees or bundles without forcing a subscription. Programs should support deposits/milestone billing until completion evidence improves.

[FOUNDER DECISION REQUIRED] Approve marketplace fee range, fee payer, founding cohort incentive, tax treatment and whether the platform acts as merchant of record or disclosed marketplace agent.
