-- Köhnə profillər: discover fənlərini public subject sahəsinə köçür
UPDATE instructor_profiles ip
SET subject = sub.label
FROM (
  SELECT ic.user_id,
         LEFT(string_agg(c.name_az, ', ' ORDER BY c.name_az), 255) AS label
  FROM instructor_categories ic
  INNER JOIN categories c ON c.id = ic.category_id
  GROUP BY ic.user_id
  HAVING COUNT(*) > 0
) sub
WHERE ip.user_id = sub.user_id
  AND (
    ip.subject IS NULL
    OR TRIM(ip.subject) = ''
    OR TRIM(ip.subject) = '—'
  );
