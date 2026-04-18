-- Aylıq: postpaid (aylıq dövr borcu) və ya prepaid (dərs vahidi ilə balans)
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS billing_timing VARCHAR(20) NOT NULL DEFAULT 'postpaid';

COMMENT ON COLUMN enrollments.billing_timing IS 'monthly: postpaid = ankor ayları × aylıq − ödənişlər; prepaid = ödəniş − (iştirak slotları × aylıq/8)';
