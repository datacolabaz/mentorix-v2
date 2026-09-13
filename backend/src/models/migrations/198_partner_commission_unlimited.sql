-- Partner economics V2:
-- - commission_duration_months = 0 means unlimited (recurring while customer pays)
-- - discount_duration_months stays 3 (first 3 paid months on original package)
-- - Campaign copy updated; default launch campaign commission window → unlimited

BEGIN;

COMMENT ON COLUMN partner_campaigns.commission_duration_months IS
  'Paid-period window for partner commission. 0 = unlimited (recurring while customer keeps paying). Positive N = first N paid plan periods only.';

COMMENT ON COLUMN partner_campaigns.discount_duration_months IS
  'Paid-period window for referred-user discount (typically 3). Discount applies only on the original joined package; upgrade forfeits remaining discount.';

ALTER TABLE partner_campaigns
  ALTER COLUMN commission_duration_months SET DEFAULT 0;

UPDATE partner_campaigns
SET
  commission_duration_months = 0,
  description = 'V2: 21-day trial, 10% user discount for first 3 paid months on original package (lost on upgrade), 20% partner commission on every approved payment while customer pays, 90-day attribution, 20 AZN min payout.',
  updated_at = NOW()
WHERE slug = 'mentorix-partner-launch';

COMMIT;
