-- Tələbə profili: aylıq ödəniş və ödəniş günü
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS monthly_fee NUMERIC(10,2);
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS payment_day INTEGER;

-- Ödəniş qeydləri: tələbə istinadı və ödəniş tarixi (mövcud enrollment_id saxlanılır)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS student_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_date DATE;

UPDATE payments p
SET student_id = e.student_id
FROM enrollments e
WHERE p.enrollment_id = e.id AND p.student_id IS NULL;

UPDATE payments
SET payment_date = (paid_at AT TIME ZONE 'UTC')::date
WHERE payment_date IS NULL AND paid_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_enrollment_id ON payments (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments (student_id);
