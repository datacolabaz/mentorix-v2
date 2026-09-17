# Payment Architecture

## Principles

Marketplace payments are different from Mentorix's current instructor subscription and student enrollment payments. Reuse provider configuration, Payriff integration patterns, billing events and admin payment operations, but introduce an explicit marketplace ledger and payout state machine.

## Payment lifecycle

1. Create an order snapshot from published offer/version.
2. Calculate subtotal, platform commission, processing fee, tax/other deductions and total.
3. Create provider checkout with idempotency key.
4. Verify callback/webhook server-to-server.
5. Append immutable ledger entries and mark order captured.
6. Create or activate relationship only after successful capture (unless founder approves reservation-first policy).
7. Hold mentor payout until completion window/dispute window passes.
8. Release payout through provider adapter or manual payout workflow.

## Provider abstraction

Define `MarketplacePaymentProvider` methods:

- `createCheckout(order)`
- `verifyWebhook(request)`
- `refund(payment, amount, reason)`
- `createPayout(payout)`
- `getPaymentStatus(reference)`

Implement `PayriffProvider` first if supported for the target legal entity; evaluate Epoint as a second adapter. Do not hard-code provider fields into domain tables. [FOUNDER DECISION REQUIRED] Select the first provider and confirm whether the platform can legally collect and split funds to mentors.

## Product support

### One-off
Capture at booking; hold payout until completed or dispute expiry.

### Recurring
Create a provider subscription where possible, otherwise a scheduled invoice/payment intent job. A failed renewal moves relationship to grace/past-due; it must not silently erase evidence or chats.

### Structured program
Charge upfront only if refund policy and delivery capacity are clear. Prefer milestone/period billing for high-value programs to reduce consumer risk.

## Commission model

Configurable settings, not constants:

- default platform rate;
- minimum fixed fee;
- mentor tier overrides;
- promotional/referral adjustments;
- payment processing pass-through policy;
- refund allocation;
- tax/VAT treatment;
- payout reserve days.

Example: mentor list price 50 AZN, platform commission 15%, mentor gross share 42.50 AZN before provider/tax deductions if commission is seller-funded. The checkout response must display the exact breakdown.

Recommended launch economics: 12–18% platform fee for verified founding mentors, with no hidden fees and a temporary cap. One-off sessions can use a small fixed minimum because support cost is not proportional to price. [FOUNDER DECISION REQUIRED] Approve fee ownership (added to buyer vs deducted from mentor) and founding promotion.

## Refunds/cancellations

Store policy snapshot at order time. Support full, partial and credit refunds; never mutate original ledger entries. Cancellation windows should differ for mentee, mentor and platform fault. No-show decisions require evidence and admin override.

## Payout risk

Payout account ownership, sanctions/identity checks, failed payouts and reserve holds are first-class. A mentor can be verified for listing but not payout-ready. Never expose bank/provider secrets to frontend.

## Invoices and reconciliation

Use provider reference, internal order ID, ledger entries and payout ID for reconciliation. Add daily reconciliation job and admin discrepancy queue. Reuse existing billing event patterns but isolate marketplace financial reporting from subscription MRR.
