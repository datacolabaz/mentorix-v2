-- Proqram ixtisas slug-ları (geniş kataloq ilə uyğunluq)

BEGIN;

UPDATE programs SET field = 'computer_science' WHERE field IN ('CS', 'cs');
UPDATE programs SET field = 'data_science' WHERE name ILIKE '%data science%';
UPDATE programs SET field = 'software_engineering' WHERE name ILIKE '%computer engineering%' OR name ILIKE '%informatics%';
UPDATE programs SET field = 'business_administration' WHERE field = 'Business' AND name ILIKE '%management%';
UPDATE programs SET field = 'finance' WHERE field = 'Business' AND name ILIKE '%finance%';
UPDATE programs SET field = 'business_administration' WHERE field = 'Business';
UPDATE programs SET field = 'electrical_engineering' WHERE field = 'Engineering';
UPDATE programs SET field = 'biology' WHERE field = 'Life Sciences';

COMMIT;
