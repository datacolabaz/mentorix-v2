-- Virtual balans: dərs "borclandırıcı" yalnız charges_virtual_balance = true olduqda
ALTER TABLE monthly_attendance_slots
  ADD COLUMN IF NOT EXISTS charges_virtual_balance BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE monthly_attendance_slots
SET charges_virtual_balance = TRUE
WHERE status = 'attended';
