-- Tələbə silinəndə ödənişlər səhvən soft-delete olunmuşdu; illik/aylıq gəlir üçün bərpa et.
-- Yalnız enrollment silinmiş, ödəniş isə yalnız həmin səbəbdən deleted_at dolu olanlar.
UPDATE payments p
SET deleted_at = NULL
FROM enrollments e
WHERE p.enrollment_id = e.id
  AND e.deleted_at IS NOT NULL
  AND p.deleted_at IS NOT NULL
  AND (p.notes IS NULL OR TRIM(p.notes) NOT LIKE '[Balans düzəlişi]%');
