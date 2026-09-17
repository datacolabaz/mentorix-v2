# Mentor Verification System

## Statuses

`PENDING → UNDER_REVIEW → VERIFIED | REJECTED`; `VERIFIED → SUSPENDED`; suspension can be temporary or permanent and requires an admin reason. A mentor profile may be public only when required verification items are complete.

## Verification levels

- **Identity verified:** government ID/selfie or trusted identity provider, subject to legal feasibility.
- **Experience verified:** employment/portfolio/LinkedIn evidence or references.
- **Education/certification verified:** document or issuer evidence.
- **Category qualified:** reviewer confirms competence for selected offer category.
- **Safety cleared:** conduct and safeguarding acknowledgements; enhanced checks for minors where required.
- **Payout ready:** provider/KYC requirements complete.

Do not imply that “verified” means guaranteed outcomes. UI should show exactly what was verified and when.

## Workflow

1. Mentor submits profile, claims and evidence.
2. System validates required fields and file types.
3. Case enters review queue with risk flags.
4. Admin checks identity, credentials, experience and offer scope.
5. Reviewer approves, requests changes or rejects with structured reason.
6. Mentor can appeal once with additional evidence.
7. Periodic recheck on expiry, report threshold or material profile changes.

## Admin controls

- queue filters by category, country, risk, age and SLA;
- evidence viewer with restricted access;
- approve/request-change/reject/suspend;
- reviewer notes not visible to mentor unless selected;
- dual review for high-risk/minor-facing categories;
- full audit trail and reviewer identity.

## Public trust signals

Show badges such as `Identity verified`, `Experience reviewed`, `Certificate reviewed`, `Completed 42 sessions`, `4.8 from 27 eligible reviews`, `Responds within 4h`. Avoid unqualified “expert” claims.

## Privacy and security

Documents live in private storage with signed, short-lived admin URLs. Encrypt sensitive references, redact logs, enforce least privilege and record every access. Do not store ID images in general profile JSON. [FOUNDER DECISION REQUIRED] Confirm which identity/credential vendor and legal entity will process documents.

## Quality after verification

Verification is not one-time approval. Monitor cancellations, no-shows, response time, disputes, review distributions, off-platform solicitation reports and outcome completion. Use warning/visibility reduction/suspension states with human review for severe actions.
