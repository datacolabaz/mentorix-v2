-- Lower partner minimum payout from 20 AZN (2000 cents) to 5 AZN (500 cents).

BEGIN;

ALTER TABLE partner_campaigns
  ALTER COLUMN minimum_payout_cents SET DEFAULT 500;

UPDATE partner_campaigns
SET
  minimum_payout_cents = 500,
  description = REPLACE(description, '20 AZN min payout', '5 AZN min payout'),
  updated_at = NOW()
WHERE minimum_payout_cents = 2000
   OR description LIKE '%20 AZN min payout%';

COMMIT;
