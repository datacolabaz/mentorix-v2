-- Köhnə DB-lərdə payment_method üçün dar CHECK (məs. yalnız nağd/kart) olub;
-- müəllim UI "manual" və ya digər qeydiyyat üsullarını INSERT edəndə xəta verirdi.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
