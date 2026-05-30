-- Qrup dəvəti: paket, qiymət və cədvəl (tələbə təsdiqdə miras alır)

ALTER TABLE instructor_groups
  ADD COLUMN IF NOT EXISTS default_billing_type VARCHAR(32) DEFAULT '8_lessons',
  ADD COLUMN IF NOT EXISTS default_package_fee NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS default_billing_timing VARCHAR(16) DEFAULT 'postpaid',
  ADD COLUMN IF NOT EXISTS default_payment_plan VARCHAR(16) DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS default_lesson_weekdays JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_lesson_times JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_notifications_enabled BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS default_initial_payment_status VARCHAR(32) DEFAULT 'unpaid';
